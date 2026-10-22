// Where someone was going when we asked them to sign in (a job they wanted to send an offer on, the
// post form...). Kept on the device so it survives the trip through sign-up, Google and the confirmation
// mail; whoever lands on a plain start page (home, account) right after signing in is taken back there.
const KEY = 'zadatak-after-auth'
const FRESH_MS = 24 * 60 * 60 * 1000

/** Only paths inside the app (never another site). */
export const safeNext = (value) => (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '')

export function rememberReturn(path) {
  const next = safeNext(path)
  if (!next) return
  try { localStorage.setItem(KEY, JSON.stringify({ path: next, at: Date.now() })) } catch { /* private mode */ }
}

/** The remembered path (once): it is cleared as it is read. */
export function takeReturn() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    localStorage.removeItem(KEY)
    return saved && Date.now() - saved.at < FRESH_MS ? safeNext(saved.path) : ''
  } catch {
    return ''
  }
}

export const forgetReturn = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }

// the pages a sign-in lands on by itself (Google callback, the confirmation mail's link, the default after sign-up)
export const LANDING_PATHS = ['/', '/dashboard', '/account', '/account/profil']
