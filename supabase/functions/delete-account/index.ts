// Deploy: supabase functions deploy delete-account --no-verify-jwt
// (the function checks the user's token itself; the gateway must let the CORS preflight through)
// Requires project secrets SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Niste prijavljeni.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Sesija nije važeća.' }, 401)
  const userId = userData.user.id

  const admin = createClient(supabaseUrl, serviceRoleKey)
  // money in escrow must be settled first — deleting now would erase the payment record
  const { count: openPayments } = await admin.from('job_payments').select('id', { count: 'exact', head: true })
    .or(`client_id.eq.${userId},provider_id.eq.${userId}`).in('status', ['funded', 'requested', 'disputed'])
  if ((openPayments || 0) > 0) return json({ error: 'Imaš posao sa osiguranom uplatom u toku. Završi ga ili otkaži, pa obriši nalog.' }, 409)

  // photos of their jobs (the rows cascade with the profile)
  const { data: jobs } = await admin.from('listings').select('id').eq('user_id', userId)
  const jobIds = (jobs || []).map((job) => job.id)
  if (jobIds.length > 0) {
    const { data: images } = await admin.from('listing_images').select('path').in('listing_id', jobIds)
    const paths = (images || []).map((image) => image.path).filter(Boolean)
    if (paths.length > 0) await admin.storage.from('media').remove(paths)
  }
  // things that should not linger after the person is gone (the rest cascades from auth.users)
  await admin.from('push_subscriptions').delete().eq('user_id', userId)
  await admin.from('task_alerts').delete().eq('user_id', userId)
  await admin.from('notifications').delete().eq('user_id', userId)
  await admin.from('profiles').delete().eq('user_id', userId)

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error('deleteUser failed', deleteError.message)
    return json({ error: 'Brisanje naloga nije uspjelo. Pokušajte ponovo.' }, 400)
  }
  return json({ success: true })
})
