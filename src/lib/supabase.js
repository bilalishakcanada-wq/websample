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
