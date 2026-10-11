import { brandedEmailEvents } from './brandedEmail.ts'

export function createBrandedEmailHandler(sweepKey: () => Promise<string | null>, deliver: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const json = (error: string, status: number) => Response.json({ error }, { status })
    if (request.method !== 'POST') return json('METHOD_NOT_ALLOWED', 405)
    try {
      const key = request.headers.get('x-sweep-key')
      if (!key || key !== await sweepKey()) return json('FORBIDDEN', 403)
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json('INVALID_PAYLOAD', 400)
      if (!brandedEmailEvents.includes(body.event_type)) return json('EVENT_TYPE_INVALID', 400)
      // Auth email delivery belongs to Supabase SMTP. Accepting raw confirmation/reset
      // URLs here would create a second delivery path and an unnecessary phishing relay.
      if (body.event_type === 'WELCOME_CONFIRM' || body.event_type === 'PASSWORD_RESET') return json('AUTH_USES_SUPABASE_SMTP', 409)
      const data = body.dynamic_data
      if (!data || typeof data !== 'object' || Array.isArray(data)) return json('DYNAMIC_DATA_INVALID', 400)
      return await deliver(new Request(request.url, { method: 'POST', headers: request.headers,
        body: JSON.stringify({ event_type: body.event_type, event_id: data.event_id, recipient_email: data.recipient_email }) }))
    } catch { return json('SERVER_UNAVAILABLE', 503) }
  }
}
