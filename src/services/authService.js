import { isNativeApp, openInSystemBrowser } from '../utils/native'
import { isStandaloneWebApp, startHandoff } from '../utils/authHandoff'
import { supabase } from '../lib/supabase'
import { isStrongPassword, isValidEmail, publicError, sanitizeText } from '../utils/validation'
import { withBase } from '../utils/paths'
import { assertAllowed, clearAttempts, recordAttempt } from '../utils/authThrottle'

const RATE_LIMITED = 'Previše pokušaja u kratkom periodu. Sačekajte par minuta i pokušajte ponovo.'
const WEAK_PASSWORD = 'Lozinka mora imati najmanje 8 znakova i sadržavati veliko, malo slovo i broj.'
const isRateLimited = (error) => error?.status === 429 || /rate_limit/.test(error?.code || '')
// Supabase couldn't send the email (its built-in sender only reaches the project team until our own mail server is set)
export const EMAIL_DOWN = 'Email trenutno ne možemo poslati. Javi nam se preko stranice Kontakt i pomoći ćemo ti.'
const isEmailDown = (error) => error?.code === 'email_address_not_authorized' || /error sending .*email/i.test(error?.message || '')

let enabledProvidersPromise = null

/** Supabase's English refusals for a new password, in plain Bosnian. */
export const passwordUpdateError = (error) => {
  if (error?.code === 'same_password') return 'Nova lozinka mora biti drugačija od stare.'
  if (error?.code === 'weak_password') return WEAK_PASSWORD
  if (error?.code === 'reauthentication_needed') return 'Iz sigurnosnih razloga se ponovo prijavi pa promijeni lozinku.'
  if (isRateLimited(error)) return RATE_LIMITED
  return 'Promjena lozinke nije uspjela. Pokušaj ponovo.'
}

export const authService = {
  async signUp({ fullName, email, password, city, phone, captchaToken, accountType = 'client', trades = [] }) {
    const cleanedName = sanitizeText(fullName)
    const cleanedEmail = sanitizeText(email).toLowerCase()

    if (!cleanedName) throw new Error('Ime je obavezno.')
    // the same rule as the database (is_valid_full_name): with one word or a digit, the ID check later fails
    if (!/^\p{L}[\p{L}'’.-]*(\s+\p{L}[\p{L}'’.-]*)+$/u.test(cleanedName)) throw new Error('Upiši ime i prezime, samo slovima (npr. Amra Hodžić).')
    if (!isValidEmail(cleanedEmail)) throw new Error('Unesite validan email.')
    if (!isStrongPassword(password)) throw new Error(WEAK_PASSWORD)
    if (password.length > 72) throw new Error('Lozinka može imati najviše 72 znaka.')
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) throw new Error('Potvrdite sigurnosnu provjeru.')
    assertAllowed('register', 'device')

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
      if (isRateLimited(error)) throw new Error(RATE_LIMITED)
      if (isEmailDown(error)) throw new Error(EMAIL_DOWN)
      if (error.code === 'captcha_failed') throw new Error('Sigurnosna provjera nije prošla. Osvježite stranicu i pokušajte ponovo.')
      if (error.code === 'email_address_invalid') throw new Error('Ova email adresa nije prihvaćena. Provjerite da li je ispravno unesena.')
      throw publicError()
    }
    recordAttempt('register', 'device')
    return data
  },

  async signIn({ email, password, captchaToken }) {
    const cleanedEmail = sanitizeText(email).toLowerCase()

    if (!isValidEmail(cleanedEmail)) throw new Error('Unesite validan email.')
    if (!password) throw new Error('Lozinka je obavezna.')
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) throw new Error('Potvrdite sigurnosnu provjeru.')
    assertAllowed('login', cleanedEmail)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })

    if (error) {
      console.error('Supabase login failed', { message: error.message, code: error.code, status: error.status })
      if (error.code === 'invalid_credentials') {
        recordAttempt('login', cleanedEmail)
        throw new Error('Pogrešan email ili lozinka.')
      }
      if (error.code === 'email_not_confirmed') throw new Error('Molimo potvrdite svoj email prije prijave. Provjerite inbox (i spam folder).')
      if (isRateLimited(error)) throw new Error(RATE_LIMITED)
      if (error.code === 'captcha_failed') throw new Error('Sigurnosna provjera nije prošla. Osvježite stranicu i pokušajte ponovo.')
      throw publicError()
    }
    clearAttempts('login', cleanedEmail)
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
    // Inside the iOS/Android app Google refuses to sign in from an embedded web view, so the
    // consent screen opens in the system browser. It comes back to the site with ?native=1, and
    // index.html immediately hands the session over to the app (ba.poso.app://auth/callback,
    // handled in utils/native.js).
    const native = isNativeApp()
    // installed web app: the callback lands in an in-app browser view, so park the session under a nonce
    const handoff = !native && isStandaloneWebApp() ? startHandoff() : ''
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: native
        ? { redirectTo: `${window.location.origin}${withBase('/dashboard')}?native=1`, skipBrowserRedirect: true }
        : { redirectTo: `${window.location.origin}${withBase(window.matchMedia?.('(max-width: 768px)').matches ? '/' : '/dashboard')}${handoff ? `?handoff=${handoff}` : ''}` },
    })
    if (!error && native && data?.url) await openInSystemBrowser(data.url)

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
    assertAllowed('reset', cleanedEmail)

    const { data, error } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
      redirectTo: `${window.location.origin}${withBase('/reset-password')}`,
    })

    if (error) {
      if (isRateLimited(error)) throw new Error(RATE_LIMITED)
      if (isEmailDown(error)) throw new Error(EMAIL_DOWN)
      throw publicError()
    }
    recordAttempt('reset', cleanedEmail)
    return data
  },

  async updatePassword(password) {
    if (!isStrongPassword(password)) throw new Error(WEAK_PASSWORD)
    if (password.length > 72) throw new Error('Lozinka može imati najviše 72 znaka.')

    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(passwordUpdateError(error))
    return data
  },

  async deleteAccount() {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw publicError()

    const { error } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) {
      // the function explains refusals (e.g. money still in escrow) — show that instead of a generic error
      let detail = ''
      try { detail = (await error.context?.json?.())?.error || '' } catch { /* not json */ }
      console.error('delete-account failed', error.message)
      throw new Error(detail || 'Brisanje naloga nije uspjelo. Pokušaj ponovo ili piši podršci.')
    }
    await supabase.auth.signOut()
  },
}
