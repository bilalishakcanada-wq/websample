// Deploy: supabase functions deploy delete-account
// Requires project secrets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (set these with
// `supabase secrets set`, never commit the service role key to the repo).
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Niste prijavljeni.' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Sesija nije važeća.' }), { status: 401 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  await admin.from('profiles').delete().eq('user_id', userData.user.id)

  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id)
  if (deleteError) {
    return new Response(JSON.stringify({ error: 'Brisanje naloga nije uspjelo. Pokušajte ponovo.' }), { status: 400 })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
