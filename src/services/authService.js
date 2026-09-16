import { supabase } from '../lib/supabase'
import { isStrongPassword, isValidEmail, publicError, sanitizeText } from '../utils/validation'

let enabledProvidersPromise = null

export const authService = {
  async signUp({ fullName, email, password, city, phone, captchaToken, accountType = 'client', trades = [] }) {
    const cleanedName = sanitizeText(fullName)
    const cleanedEmail = sanitizeText(email).toLowerCase()

    if (!cleanedName) throw new Error('Ime je obavezno.')
    if (!isValidEmail(cleanedEmail)) throw new Error('Unesite validan email.')
    if (!isStrongPassword(password)) throw new Error('Lozinka mora imati najmanje 8 znakova i sadržavati veliko, malo slovo i broj.')
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) throw new Error('Potvrdite sigurnosnu provjeru.')

    const { data, error } = await supabase.auth.signUp({
      email: cleanedEmail,
      password,
      options: {
        ...(captchaToken ? { captchaToken } : {}),
        data: {
          full_name: cleanedName,
          city: sanitizeText(city),
          phone: sanitizeText(phone),
          role: 'USER',
          account_type: ['client', 'provider', 'both'].includes(accountType) ? accountType : 'client',
          trades: Array.isArray(trades) ? trades.slice(0, 10).map((trade) => sanitizeText(trade)).filter(Boolean) : [],
        },
      },
    })

    if (error) {
      console.error('Supabase signup failed', { message: error.message, code: error.code, status: error.status })
      if (error.code === 'user_already_exists') throw new Error('Nalog sa ovim emailom već postoji. Pokušajte se prijaviti.')
      if (error.code === 'weak_password') throw new Error('Lozinka je preslaba. Koristite najmanje 8 znakova, veliko i malo slovo i broj.')
      if (error.code === 'over_email_send_rate_limit') throw new Error('Previše pokušaja u kratkom periodu. Sačekajte par minuta i pokušajte ponovo.')
      if (error.code === 'email_address_invalid') throw new Error('Ova email adresa nije prihvaćena. Provjerite da li je ispravno unesena.')
      throw publicError()
    }
    return data
  },

  async signIn({ email, password, captchaToken }) {
    const cleanedEmail = sanitizeText(email).toLowerCase()

    if (!isValidEmail(cleanedEmail)) throw new Error('Unesite validan email.')
    if (!password) throw new Error('Lozinka je obavezna.')
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) throw new Error('Potvrdite sigurnosnu provjeru.')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })

    if (error) {
      console.error('Supabase login failed', { message: error.message, code: error.code, status: error.status })
      if (error.code === 'invalid_credentials') throw new Error('Pogrešan email ili lozinka.')
      if (error.code === 'email_not_confirmed') throw new Error('Molimo potvrdite svoj email prije prijave. Provjerite inbox (i spam folder).')
      if (error.code === 'over_email_send_rate_limit' || error.status === 429) throw new Error('Previše pokušaja u kratkom periodu. Sačekajte par minuta i pokušajte ponovo.')
      throw publicError()
    }
    return data
  },

  // Supabase publishes which OAuth providers are turned on, so the UI can hide
  // a provider button instead of bouncing the user to a raw JSON error page.
  async isProviderEnabled(provider) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) return false

    if (!enabledProvidersPromise) {
      enabledProvidersPromise = fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
        .then((response) => (response.ok ? response.json() : null))
        .then((settings) => settings?.external || {})
        .catch(() => ({}))
    }

    const providers = await enabledProvidersPromise
    return providers[provider] === true
  },

  async signInWithProvider(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })

    if (error) {
      console.error('Supabase OAuth sign-in failed', { provider, message: error.message, code: error.code, status: error.status })
      if (error.message?.includes('provider is not enabled')) {
        throw new Error('Ova prijava još nije aktivirana. Pokušajte emailom i lozinkom.')
      }
      throw publicError()
    }
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw publicError()
  },

  async refreshSession() {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw publicError()
    return data
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw publicError()
    return data
  },

  async resetPassword(email) {
    const cleanedEmail = sanitizeText(email).toLowerCase()
    if (!isValidEmail(cleanedEmail)) throw new Error('Unesite validan email.')

    const { data, error } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) throw publicError()
    return data
  },

  async updatePassword(password) {
    if (!isStrongPassword(password)) throw new Error('Lozinka mora imati najmanje 8 znakova i sadržavati veliko, malo slovo i broj.')

    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    return data
  },

  async deleteAccount() {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw publicError()

    const { error } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) throw publicError()
    await supabase.auth.signOut()
  },
}
