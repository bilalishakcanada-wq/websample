import { renderBrandedEmail } from './brandedEmail.ts'
import { configuredEmailSender } from './emailSender.ts'

export const emailEvents = ['JOB_PUBLISHED', 'NEW_BID_RECEIVED', 'JOB_ACCEPTED', 'JOB_COMPLETED', 'NEW_MESSAGE', 'NOTIFICATION', 'EMAIL_CONFIRM'] as const
export type EventType = typeof emailEvents[number]
export type Data = { listing_id?: string; title: string; amount?: number | string; user_name?: string; provider_name?: string; link?: string; message?: string; token?: string }
export type Event = { id: string; event_type: EventType; recipient_email: string; payload_data: Data; claim_id: string; mail_request?: Record<string, unknown>; recipient_id?: string; source_id?: string }

// older SQL notification texts carry long dashes and emoji; mails go out in the site's plain style
const plain = (text?: string) => text?.replace(/\s*—\s*/g, ', ').replace(/\s*\p{Extended_Pictographic}\uFE0F?/gu, '').trim()

export function renderTransactionalEmail(type: EventType, data: Data, siteUrl: string) {
  const site = new URL(siteUrl)
  if (site.protocol !== 'https:' || site.username || site.password) throw new Error('SITE_URL_INVALID')
  site.search = ''; site.hash = ''
  const settingsUrl = site.href.replace(/\/$/, '') + '/account/postavke-obavijesti'
  if (type === 'EMAIL_CONFIRM') {
    // the link opens /potvrdi-email, which hands the token to public.confirm_email
    if (!/^[a-f0-9]{64}$/.test(data.token || '')) throw new Error('TOKEN_INVALID')
    return renderBrandedEmail('WELCOME_CONFIRM', { userName: data.user_name, actionUrl: site.href.replace(/\/$/, '') + '/potvrdi-email?t=' + data.token })
  }
  if (type === 'NEW_MESSAGE' || type === 'NOTIFICATION') {
    const link = data.link || '/account/obavijesti'
    if (!link.startsWith('/') || link.startsWith('//') || link.includes('\\') || Array.from(link).some(char => char.charCodeAt(0) <= 32)) throw new Error('NOTIFICATION_LINK_INVALID')
    const target = new URL(site.href.replace(/\/$/, '') + link)
    if (target.origin !== site.origin) throw new Error('NOTIFICATION_LINK_INVALID')
    return renderBrandedEmail(type, { actionUrl: target.href, settingsUrl, notificationTitle: plain(data.title), notificationBody: plain(data.message) })
  }
  if (!/^[a-f0-9-]{36}$/i.test(data.listing_id || '')) throw new Error('LISTING_ID_INVALID')
  return renderBrandedEmail(type, { jobTitle: data.title, price: data.amount, userName: data.user_name,
    providerName: data.provider_name, actionUrl: site.href.replace(/\/$/, '') + '/listings/' + data.listing_id, settingsUrl })
}

type Repository = {
  sweepKey: () => Promise<string | null>
  claim: (id: string, type: string, email: string) => Promise<Event | null>
  prepare: (id: string, claim: string, request: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  finish: (id: string, claim: string, state: string, provider: string | null, error: string | null) => Promise<boolean>
}
export function createTransactionalEmailHandler({ repo, getEnv, fetchImpl = fetch }: { repo: Repository; getEnv: (name: string) => string | undefined; fetchImpl?: typeof fetch }) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  return async (request: Request) => {
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
    try {
      const key = request.headers.get('x-sweep-key')
      if (!key || key !== await repo.sweepKey()) return json({ error: 'FORBIDDEN' }, 403)
      const input = await request.json().catch(() => null)
      if (!input || typeof input !== 'object') return json({ error: 'INVALID_PAYLOAD' }, 400)
      const apiKey = getEnv('RESEND_API_KEY')
      const from = configuredEmailSender(getEnv('RESEND_FROM'))
      const configured = { apiKey: Boolean(apiKey), sender: Boolean(from), retryStore: true }
      if (input.mode === 'health') return json({ configured })
      if (!apiKey || !from) return json({ error: 'EMAIL_NOT_CONFIGURED', configured }, 503)
      if (!/^[a-f0-9-]{36}$/i.test(input.event_id || '') || !emailEvents.includes(input.event_type) || typeof input.recipient_email !== 'string') return json({ error: 'INVALID_EVENT' }, 400)
      // Browser payloads cannot create arbitrary emails; only a real, matching DB event can be claimed.
      const event = await repo.claim(input.event_id, input.event_type, input.recipient_email)
      if (!event) return json({ state: 'already_handled_or_unavailable' })
      let proposed: Record<string, unknown>
      try {
        // A retry must retain the original body even after configuration/template changes.
        proposed = event.mail_request || { from, to: [event.recipient_email],
          ...renderTransactionalEmail(event.event_type, event.payload_data, getEnv('SITE_URL') || 'https://bilalishakcanada-wq.github.io/websample'),
          tags: [{ name: 'event', value: event.event_type }] }
      } catch {
        await repo.finish(event.id, event.claim_id, 'failed', null, 'TEMPLATE_OR_REQUEST_INVALID')
        return json({ error: 'TEMPLATE_OR_REQUEST_INVALID' }, 422)
      }
      let mail: Record<string, unknown> | null
      try { mail = await repo.prepare(event.id, event.claim_id, proposed) }
      catch {
        await repo.finish(event.id, event.claim_id, 'retry', null, 'EMAIL_STORE_UNAVAILABLE')
        return json({ state: 'queued_for_retry' }, 503)
      }
      if (!mail) return json({ state: 'claim_changed' }, 409)
      // Changing a frozen request under an existing provider idempotency key is unsafe.
      // Hold legacy requests for reconciliation instead of sending from an old identity.
      if (mail.from !== from) {
        await repo.finish(event.id, event.claim_id, 'retry', null, 'SENDER_MIGRATION_REQUIRED')
        return json({ state: 'sender_migration_required' }, 503)
      }
      try {
        const result = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `zadatak/${event.id}` },
          body: JSON.stringify(mail), signal: AbortSignal.timeout(15000),
        })
        const body = await result.json().catch(() => ({}))
        if (result.ok && typeof body.id === 'string') {
          const recorded = await repo.finish(event.id, event.claim_id, 'sent', body.id, null)
          return json({ state: recorded ? 'accepted' : 'accepted_pending_record' }, recorded ? 200 : 202)
        }
        const retryable = result.ok || result.status === 429 || result.status === 408 || result.status >= 500
          || (result.status === 409 && body.name === 'concurrent_idempotent_requests')
        await repo.finish(event.id, event.claim_id, retryable ? 'retry' : 'failed', null, `RESEND_HTTP_${result.status}`)
        return json({ state: retryable ? 'queued_for_retry' : 'failed' }, retryable ? 503 : 422)
      } catch {
        await repo.finish(event.id, event.claim_id, 'retry', null, 'DELIVERY_RESULT_UNKNOWN')
        return json({ state: 'queued_for_retry' }, 503)
      }
    } catch { return json({ error: 'SERVER_UNAVAILABLE' }, 503) }
  }
}
