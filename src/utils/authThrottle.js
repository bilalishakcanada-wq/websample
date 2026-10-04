/*
 * Limits on how often this device may try to log in, register or ask for a password-reset email.
 * The real limit is Supabase Auth's own per-IP rate limit (and CAPTCHA when it is turned on):
 * anyone can skip this file by calling the API directly. This only stops guessing from the form
 * itself and tells people how long to wait instead of showing a raw "429".
 * Attempts are kept per action and email in localStorage, so a reload does not reset them.
 */
const KEY = 'poso-auth-throttle'

const RULES = {
  // failed logins for one email: 5 in 15 minutes, then wait until the oldest one is 15 minutes old
  login: { max: 5, windowMs: 15 * 60 * 1000 },
  // reset emails for one address: one a minute, 5 an hour
  reset: { max: 5, windowMs: 60 * 60 * 1000, gapMs: 60 * 1000 },
  // new accounts from this device: 5 an hour
  register: { max: 5, windowMs: 60 * 60 * 1000 },
}

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} }
}

const write = (state) => {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode: the server limit still applies */ }
}

const slot = (action, subject) => `${action}:${String(subject || '').trim().toLowerCase()}`

const recent = (state, key, windowMs, now) => (Array.isArray(state[key]) ? state[key] : []).filter((at) => typeof at === 'number' && now - at < windowMs && at <= now)

const minutesText = (ms) => {
  const minutes = Math.max(1, Math.ceil(ms / 60000))
  if (minutes === 1) return '1 minutu'
  return minutes < 5 ? `${minutes} minute` : `${minutes} minuta`
}

/** Throws a Bosnian "wait N minutes" error when this action is over its limit; otherwise does nothing. */
export function assertAllowed(action, subject, now = Date.now()) {
  const rule = RULES[action]
  if (!rule) return
  const hits = recent(read(), slot(action, subject), rule.windowMs, now)
  if (rule.gapMs && hits.length && now - hits[hits.length - 1] < rule.gapMs) {
    throw new Error(`Email je već poslan. Novi možeš zatražiti za ${minutesText(rule.gapMs - (now - hits[hits.length - 1]))}.`)
  }
  if (hits.length >= rule.max) {
    throw new Error(`Previše pokušaja. Pokušaj ponovo za ${minutesText(rule.windowMs - (now - hits[0]))}.`)
  }
}

/** Counts one attempt (a failed login, a sent reset email, a new account). */
export function recordAttempt(action, subject, now = Date.now()) {
  const rule = RULES[action]
  if (!rule) return
  const state = read()
  const key = slot(action, subject)
  // drop anything that has expired, for every key, so the stored list never grows
  for (const name of Object.keys(state)) {
    const kind = RULES[name.split(':')[0]]
    state[name] = kind ? recent(state, name, kind.windowMs, now) : []
    if (!state[name].length) delete state[name]
  }
  state[key] = [...(state[key] || []), now].slice(-rule.max)
  write(state)
}

/** A successful login clears that email's failed attempts. */
export function clearAttempts(action, subject) {
  const state = read()
  delete state[slot(action, subject)]
  write(state)
}
