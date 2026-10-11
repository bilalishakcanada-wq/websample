import { BUSINESS_EMAIL_FROM } from './emailSender.ts'

type SendResult = { data: { id: string } | null; error: { name?: string; statusCode?: number | null } | null }
type ResendMail = { from: string; to: string[]; subject: string; html: string; text?: string; tags?: { name: string; value: string }[] }
type Send = (mail: ResendMail, options: { idempotencyKey: string }) => Promise<SendResult>

function isMail(value: unknown): value is ResendMail {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const mail = value as Record<string, unknown>
  return mail.from === BUSINESS_EMAIL_FROM && typeof mail.subject === 'string' && typeof mail.html === 'string'
    && Array.isArray(mail.to) && mail.to.length > 0 && mail.to.every(item => typeof item === 'string')
    && (mail.text === undefined || typeof mail.text === 'string')
    && (mail.tags === undefined || (Array.isArray(mail.tags) && mail.tags.every(tag => tag && typeof tag.name === 'string' && typeof tag.value === 'string')))
}

// Adapts the SDK to the existing outbox handler, preserving its retry classification.
export function createResendTransport(send: Send): typeof fetch {
  return async (_url, init) => {
    const key = new Headers(init?.headers).get('Idempotency-Key')
    if (!key || typeof init?.body !== 'string') throw new Error('MAIL_REQUEST_INVALID')
    const mail: unknown = JSON.parse(init.body)
    if (!isMail(mail)) throw new Error('MAIL_REQUEST_INVALID')
    const signal = init.signal || AbortSignal.timeout(15000)
    signal.throwIfAborted()
    let abort: (() => void) | undefined
    try {
      const result = await Promise.race([
        send(mail, { idempotencyKey: key }),
        new Promise<never>((_, reject) => {
          abort = () => reject(new Error('PROVIDER_TIMEOUT'))
          signal.addEventListener('abort', abort, { once: true })
        }),
      ])
      if (result.error) {
        const code = result.error.statusCode
        return Response.json({ name: result.error.name }, { status: typeof code === 'number' && code >= 400 && code <= 599 ? code : 503 })
      }
      return Response.json({ id: result.data?.id })
    } finally { if (abort) signal.removeEventListener('abort', abort) }
  }
}
