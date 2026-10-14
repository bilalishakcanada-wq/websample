import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.109.0'
import type { Event } from './transactionalEmail.ts'

export function createEmailRepository(admin: SupabaseClient) {
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(name, args)
    if (error) throw new Error('EMAIL_STORE_UNAVAILABLE')
    return data
  }
  const displayName = async (id?: string): Promise<string | undefined> => {
    if (!id) return undefined
    const { data } = await admin.from('public_profiles').select('display_name').eq('user_id', id).maybeSingle()
    return typeof data?.display_name === 'string' ? data.display_name : undefined
  }
  return {
    sweepKey: async () => {
      const { data, error } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').maybeSingle()
      if (error) throw new Error('AUTH_STORE_UNAVAILABLE')
      return data?.value || null
    },
    claim: async (id: string, type: string, email: string): Promise<Event | null> => {
      const event = await rpc('claim_transactional_email', { p_id: id, p_type: type, p_email: email }) as Event | null
      if (!event || event.mail_request) return event
      // Names are display data only, obtained from DB relationships, never from the request.
      // Once prepared, the entire email is frozen so retries retain exactly the same body.
      try {
        const [userName, providerName] = await Promise.all([
          displayName(event.recipient_id),
          (async () => {
            if (['JOB_PUBLISHED', 'NEW_MESSAGE', 'NOTIFICATION', 'EMAIL_CONFIRM'].includes(event.event_type)) return undefined
            if (event.event_type === 'JOB_COMPLETED') {
              const { data } = await admin.from('job_payments').select('provider_id').eq('listing_id', event.payload_data.listing_id).eq('status', 'released').maybeSingle()
              return displayName(data?.provider_id)
            }
            const { data } = await admin.from('bids').select('bidder_id').eq('id', event.source_id).maybeSingle()
            return displayName(data?.bidder_id)
          })(),
        ])
        return { ...event, payload_data: { ...event.payload_data, user_name: userName, provider_name: providerName } }
      } catch { return event } // Missing optional profile data must not block the notification.
    },
    prepare: (id: string, claim: string, request: Record<string, unknown>) => rpc('prepare_transactional_email', { p_id: id, p_claim: claim, p_request: request }),
    finish: (id: string, claim: string, state: string, provider: string | null, error: string | null) => rpc('finish_transactional_email', { p_id: id, p_claim: claim, p_status: state, p_provider: provider, p_error: error }),
  }
}
