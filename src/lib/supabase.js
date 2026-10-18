import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const clientUrl = supabaseUrl || 'https://placeholder.supabase.co'
const clientKey = supabaseAnonKey || 'placeholder-anon-key'

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // implicit flow: the session comes back in the URL hash, so an OAuth round trip that starts
    // in the installed app / PWA and finishes in the system browser still logs the user in
    // (PKCE keeps a verifier in the starting context, which the browser never sees)
    flowType: 'implicit',
  },
})

export const getSupabaseClient = () => supabase

/**
 * supabase.rpc for points sent with Zadatak in the background (Lokacija uživo, "Krećem"): after ~5 min
 * in the background Android holds back the WebView's own requests, so in the app they go through
 * Capacitor's native HTTP instead. Same { data, error } as supabase.rpc.
 */
export async function rpcFromBackground(name, args) {
  const http = window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.CapacitorHttp
  if (!http || document.visibilityState === 'visible') return supabase.rpc(name, args)
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) return { data: null, error: { message: 'Prijavi se' } }
  try {
    const res = await http.post({
      url: `${clientUrl}/rest/v1/rpc/${name}`,
      headers: { apikey: clientKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: args,
    })
    if (res.status >= 200 && res.status < 300) return { data: res.data ?? null, error: null }
    const body = typeof res.data === 'object' && res.data ? res.data : { message: String(res.data || res.status) }
    return { data: null, error: body }
  } catch (error) {
    return { data: null, error: { message: error?.message || 'network' } }
  }
}
