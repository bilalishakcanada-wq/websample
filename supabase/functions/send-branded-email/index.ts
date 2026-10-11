import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { Resend } from 'npm:resend@6.32.1'
import { createEmailRepository } from '../_shared/emailRepository.ts'
import { createTransactionalEmailHandler } from '../_shared/transactionalEmail.ts'
import { createBrandedEmailHandler } from '../_shared/brandedEmailHandler.ts'
import { createResendTransport } from '../_shared/resendTransport.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
})
const repo = createEmailRepository(admin)
const deliver = createTransactionalEmailHandler({ repo, getEnv: name => Deno.env.get(name),
  fetchImpl: createResendTransport((mail, options) => new Resend(Deno.env.get('RESEND_API_KEY')).emails.send(mail, options)),
})
Deno.serve(createBrandedEmailHandler(repo.sweepKey, deliver))
