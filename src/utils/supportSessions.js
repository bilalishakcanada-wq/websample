// Support chat sessions. Every user has one support_messages thread; it is split into
// conversations by time: 25 minutes without a message ends a conversation and the
// next message starts a fresh one. "Novi razgovor" starts one by hand (stored per user).

export const SUPPORT_IDLE_MS = 25 * 60 * 1000

const at = (value) => new Date(value).getTime()

/** Groups messages (oldest first) into conversations: [{ start, end, messages }]. */
export function splitSessions(messages, resetAt = 0) {
  const sessions = []
  let current = null
  for (const message of messages) {
    const time = at(message.created_at)
    const idle = current && time - current.end > SUPPORT_IDLE_MS
    const manual = current && resetAt && current.end < resetAt && time >= resetAt
    if (!current || idle || manual) {
      current = { start: time, end: time, messages: [] }
      sessions.push(current)
    }
    current.messages.push(message)
    current.end = time
  }
  return sessions
}

/**
 * The open conversation and the closed ones before it. The last conversation stays open
 * until 25 minutes pass without a message or the user starts a new one.
 */
export function currentSession(messages, { now = Date.now(), resetAt = 0 } = {}) {
  const sessions = splitSessions(messages, resetAt)
  const last = sessions[sessions.length - 1]
  const lastOpen = last && now - last.end <= SUPPORT_IDLE_MS && !(resetAt && last.end < resetAt)
  if (lastOpen) return { current: last, past: sessions.slice(0, -1), expired: false }
  // expired: the last conversation was closed by inactivity (not by "Novi razgovor")
  return { current: { start: null, end: null, messages: [] }, past: sessions, expired: Boolean(last) && !(resetAt && last.end < resetAt) }
}

/** A person (or the assistant's hand-off) is in this conversation: new messages go to the team. */
export const humanInSession = (session) => session.messages.some((item) => item.sender === 'admin' || (item.sender === 'assistant' && item.handoff))

const RESET_KEY = (userId) => `zadatak:support-reset:${userId}`

export function readReset(userId) {
  try { return Number(window.localStorage.getItem(RESET_KEY(userId))) || 0 } catch { return 0 }
}

/** Starts a new conversation right after the last stored message (server time, so clock skew can't misplace it). */
export function writeReset(userId, lastMessage) {
  const value = lastMessage ? at(lastMessage.created_at) + 1 : Date.now()
  try { window.localStorage.setItem(RESET_KEY(userId), String(value)) } catch { /* private mode: the reset lasts for this visit */ }
  return value
}
