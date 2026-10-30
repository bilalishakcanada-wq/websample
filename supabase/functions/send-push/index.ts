// Zadatak.ba: Web Push delivery.
//
// Called by the on_notification_push trigger (x-sweep-key) for every in-app
// notification whose user has at least one subscribed device. Encrypts the
// payload per device with the VAPID key stored in Vault and drops devices
// that the push service reports as gone (404/410).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'
import { createNativePushSender } from '../_shared/nativePush.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') || 'https://bilalishakcanada-wq.github.io/websample').replace(/\/$/, '')
const CONTACT = Deno.env.get('VAPID_CONTACT') || 'mailto:podrska@zadatak.ba'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const nativePush = createNativePushSender({ getEnv: (name: string) => Deno.env.get(name) })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
// older SQL notification texts carry long dashes and emoji; pushes go out in the site's plain style
const plain = (text: string | null) => (text || '').replace(/\s*—\s*/g, ', ').replace(/\s*\p{Extended_Pictographic}️?/gu, '').trim()

type Payload = { notification_id: string; user_id?: string; web_only?: boolean }

let appServerPromise: Promise<webpush.ApplicationServer> | null = null
async function appServer() {
  if (!appServerPromise) {
    appServerPromise = (async () => {
      const { data: jwk, error } = await admin.rpc('vapid_private_jwk')
      if (error || !jwk) throw new Error('VAPID key missing: ' + (error?.message || 'empty'))
      const priv = JSON.parse(jwk)
      const pub = { ...priv, key_ops: ['verify'] }
      delete pub.d
      const vapidKeys = await webpush.importVapidKeys({ publicKey: pub, privateKey: priv }, { extractable: false })
      return webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys })
    })().catch((error) => { appServerPromise = null; throw error })
  }
  return appServerPromise
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const sweepKey = req.headers.get('x-sweep-key')
  const { data: setting } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').single()
  if (!sweepKey || !setting || setting.value !== sweepKey) return json({ error: 'forbidden' }, 403)

  const payload = (await req.json().catch(() => ({}))) as Payload
  if (!payload.notification_id) return json({ error: 'bad payload' }, 400)
  // The trusted row is the source of recipient/content; a request cannot override them.
  const { data: row, error: noteError } = await admin.from('notifications').select('id,user_id,type,title,message,link').eq('id', payload.notification_id).maybeSingle()
  if (noteError) return json({ error: 'notification lookup failed' }, 503)
  if (!row || (payload.user_id && payload.user_id !== row.user_id)) return json({ skipped: 'notification unavailable' })
  const note = { ...row, title: plain(row.title), message: plain(row.message) }

  const { data: profile } = await admin.from('profiles').select('notify_push').eq('user_id', note.user_id).maybeSingle()
  if (profile && profile.notify_push === false) return json({ skipped: 'opted out' })

  const [{ data: webSubs, error: webError }, { data: devices, error: nativeError }] = await Promise.all([
    admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', note.user_id),
    payload.web_only ? Promise.resolve({ data: [], error: null }) : admin.from('native_push_devices').select('id,token,platform,environment').eq('user_id', note.user_id),
  ])
  if (webError || nativeError) return json({ error: 'device lookup failed' }, 503)
  const subs = webSubs || []
  if (subs.length === 0 && (!devices || devices.length === 0)) return json({ skipped: 'no devices' })

  const link = note.link?.startsWith('/') && !note.link.startsWith('//') && !note.link.includes('\\') && !Array.from(note.link as string).some((char) => char.charCodeAt(0) < 32) ? note.link : '/account/obavijesti'
  const url = `${SITE_URL}${link}`
  const body = JSON.stringify({
    title: note.title,
    body: note.message || '',
    url,
    tag: note.type || 'zadatak',
    id: note.id,
  })

  const webDelivery = Promise.all(subs.map(async (sub) => {
    try {
      const server = await appServer()
      const subscriber = server.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
      await subscriber.pushTextMessage(body, { ttl: 60 * 60 * 24, urgency: webpush.Urgency.High, topic: (note.type || 'zadatak').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) })
      await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
      return 'sent'
    } catch (error) {
      const status = (error as { response?: Response })?.response?.status
      const text = String((error as Error)?.message || error)
      if (status === 404 || status === 410 || /410|404|gone|expired|unsubscribed/i.test(text)) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
        return 'removed'
      }
      return 'failed'
    }
  }))

  const nativeDelivery = Promise.all((devices || []).map(async (device) => {
    try {
      const provider = device.platform === 'android' || !/^[a-f0-9]{64}$/i.test(device.token) ? 'fcm' : 'apns'
      const result = await nativePush.send({ ...device, provider }, note)
      if (result.state === 'expired') await admin.from('native_push_devices').delete().eq('id', device.id)
      else if (result.state === 'sent') await admin.from('native_push_devices').update({ last_used_at: new Date().toISOString() }).eq('id', device.id)
      return result
    } catch { return { state: 'failed', provider: device.platform === 'ios' ? 'apns' : 'fcm' } }
  }))
  const [results, nativeResults] = await Promise.all([webDelivery, nativeDelivery])
  return json({ web: results, native: nativeResults })
})
