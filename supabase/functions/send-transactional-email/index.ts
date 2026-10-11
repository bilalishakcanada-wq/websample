import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { createTransactionalEmailHandler } from '../_shared/transactionalEmail.ts'
import { createEmailRepository } from '../_shared/emailRepository.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
})
Deno.serve(createTransactionalEmailHandler({
  getEnv: name => Deno.env.get(name), repo: createEmailRepository(admin),
}))
