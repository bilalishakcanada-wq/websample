// Poso.ba — Web Push delivery.
//
// Called by the on_notification_push trigger (x-sweep-key) for every in-app
// notification whose user has at least one subscribed device. Encrypts the
// payload per device with the VAPID key stored in Vault and drops devices
// that the push service reports as gone (404/410).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@^0.5.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') || 'https://bilalishakcanada-wq.github.io/websample').replace(/\/$/, '')
const CONTACT = Deno.env.get('VAPID_CONTACT') || 'mailto:podrska@poso.ba'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Payload = { notification_id?: string; user_id: string; type?: string; title: string; message?: string; link?: string }

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
    })()
  }
  return appServerPromise
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const sweepKey = req.headers.get('x-sweep-key')
  const { data: setting } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').single()
  if (!sweepKey || !setting || setting.value !== sweepKey) return json({ error: 'forbidden' }, 403)

  const payload = (await req.json().catch(() => ({}))) as Payload
  if (!payload.user_id || !payload.title) return json({ error: 'bad payload' }, 400)

  const { data: profile } = await admin.from('profiles').select('notify_push').eq('user_id', payload.user_id).maybeSingle()
  if (profile && profile.notify_push === false) return json({ skipped: 'opted out' })

  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', payload.user_id)
  if (!subs || subs.length === 0) return json({ skipped: 'no devices' })

  const server = await appServer()
  const url = payload.link ? `${SITE_URL}${payload.link.startsWith('/') ? payload.link : `/${payload.link}`}` : `${SITE_URL}/account/obavijesti`
  const body = JSON.stringify({
    title: payload.title,
    body: payload.message || '',
    url,
    tag: payload.type || 'poso',
    id: payload.notification_id || null,
  })

  const results = await Promise.all(subs.map(async (sub) => {
    try {
      const subscriber = server.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
      await subscriber.pushTextMessage(body, { ttl: 60 * 60 * 24, urgency: 'high', topic: (payload.type || 'poso').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) })
      await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
      return 'sent'
    } catch (error) {
      const status = (error as { response?: Response })?.response?.status
      const text = String((error as Error)?.message || error)
      if (status === 404 || status === 410 || /410|404|gone|expired|unsubscribed/i.test(text)) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
        return 'removed'
      }
      return `error: ${text.slice(0, 160)}`
    }
  }))

  return json({ results })
})
