/** Where the job behind a chat stands, for the strip at the top of the thread. */
export function jobStatus(chatState, contactsAllowed) {
  if (chatState === 'readonly') return { label: 'Završen', tone: 'done' }
  if (chatState === 'locked') return { label: 'Čeka prihvatanje', tone: 'wait' }
  if (contactsAllowed) return { label: 'Ponuda prihvaćena', tone: 'ok' }
  return { label: 'Otvoren', tone: 'open' }
}
