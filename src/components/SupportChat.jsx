import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronUp, History, LifeBuoy, RotateCcw, Send, Sparkles, UserRound, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supportService } from '../services/supportService'
import { HELP_ARTICLES } from '../data/helpArticles'
import { SITE_GUIDE } from '../data/siteGuide'
import { HUMAN_LABEL, localAnswer, starterSuggestions } from '../utils/supportBrain'
import { SUPPORT_IDLE_MS, currentSession, humanInSession, readReset, writeReset } from '../utils/supportSessions'
import { SkeletonLines } from './Skeleton'

const ARTICLES = HELP_ARTICLES.map(({ id, audience, q, a }) => ({ id, audience, q, a }))
const GUIDE = SITE_GUIDE.map(({ path, title, where }) => ({ path, title, where }))
// the ping to the team that rides along with a hand-off; stored, never shown to the user
const HANDOFF_PREFIX = '(predaja timu)'
const visible = (item) => !item.message.startsWith(HANDOFF_PREFIX)

const timeLabel = (value) => new Date(value).toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })
const dayLabel = (value) => { const date = new Date(value); return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}. u ${timeLabel(value)}` }

/** Message text with in-app paths like (/account/novcanik) turned into links. */
function RichText({ text, onNavigate }) {
  const parts = String(text).split(/\((\/[a-z0-9\-/]+)\)/i)
  return parts.map((part, index) => (index % 2
    ? <Link key={index} to={part} className="support-inline-link" onClick={onNavigate}>otvori →</Link>
    : <Fragment key={index}>{part}</Fragment>))
}

function Bubble({ item, onNavigate }) {
  return (
    <div className={`support-bubble ${item.sender === 'user' ? 'from-user' : 'from-admin'} ${item.sender === 'assistant' ? 'support-bubble-assistant' : ''} ${item.sender === 'admin' ? 'support-bubble-team' : ''}`}>
      {item.sender !== 'user' && <small>{item.sender === 'assistant' ? 'Zadatak asistent' : 'Pravi pomoćnik · Zadatak tim'} · {timeLabel(item.created_at)}</small>}
      {item.sender === 'user' ? item.message : <RichText text={item.message} onNavigate={onNavigate} />}
      {item.handoff && <span className="support-handoff"><LifeBuoy size={12} /> Tim je obaviješten</span>}
    </div>
  )
}

/**
 * Floating support. The assistant answers instantly (Claude through the support-assistant
 * function when its key is set, otherwise the local brain), a real person takes over in the
 * same window. 25 minutes without a message closes the conversation; the next one starts empty
 * and earlier ones stay readable under "Prethodni razgovori".
 */
function SupportChat({ openRequested = false }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const onHelpPage = pathname.startsWith('/pomoc')
  // a deep link opens the chat on the first paint, so it doesn't pop open (and jump) a moment later
  const deepLink = onHelpPage && searchParams.get('chat') === '1'
  const [open, setOpen] = useState(openRequested || deepLink)

  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState(() => (deepLink ? (searchParams.get('msg') || '').slice(0, 500) : ''))
  // deep link: /pomoc?chat=1 opens the conversation straight away; ?msg= pre-fills the draft
  useEffect(() => {
    if (onHelpPage && searchParams.get('chat') === '1') {
      setOpen(true)
      const prefill = searchParams.get('msg')
      if (prefill) setDraft(prefill.slice(0, 500))
    }
  }, [onHelpPage, searchParams])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState('')
  const [context, setContext] = useState(null)
  const [suggestions, setSuggestions] = useState(null) // { id, list } for the latest assistant answer
  const [resetAt, setResetAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [showPast, setShowPast] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('zadatak:open-support', show)
    return () => window.removeEventListener('zadatak:open-support', show)
  }, [])

  useEffect(() => {
    if (!open || !user) return undefined
    setLoading(true)
    setError('')
    setResetAt(readReset(user.id))
    setNow(Date.now())
    supportService.listMyMessages(user.id)
      .then(setMessages)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
    supportService.myContext(user.id).then(setContext).catch(() => {})
    return supportService.subscribeToMyMessages(user.id, (row) => {
      setMessages((current) => (current.some((item) => item.id === row.id) ? current : [...current, row]))
    })
  }, [open, user])

  // the clock that closes an idle conversation while the window stays open
  useEffect(() => {
    if (!open) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [open])

  const { current, past, expired } = useMemo(() => currentSession(messages, { now, resetAt }), [messages, now, resetAt])
  const shown = current.messages.filter(visible)
  const pastShown = past.map((session) => ({ ...session, messages: session.messages.filter(visible) })).filter((session) => session.messages.length).reverse()
  const humanActive = humanInSession(current)
  const lastShown = shown[shown.length - 1]
  const chips = !shown.length
    ? starterSuggestions(context)
    : lastShown?.sender === 'assistant' && suggestions?.id === lastShown.id ? suggestions.list : []

  useEffect(() => {
    if (!showPast) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing, showPast, chips.length])

  const push = (row) => setMessages((list) => (list.some((item) => item.id === row.id) ? list : [...list, row]))
  const closeChat = () => setOpen(false)

  const handOff = async (summary) => {
    await supportService.send({ userId: user.id, sender: 'user', message: `${HANDOFF_PREFIX} ${summary}`, needsHuman: true }).then(push).catch(() => {})
  }

  /**
   * Assistant turn: Claude (support-assistant function) when the key is set; otherwise the
   * local brain. Both end in a stored 'assistant' bubble; a hand-off pings the team.
   */
  const assistantReply = async (text, history, since) => {
    setTyping(true)
    try {
      const ai = await supportService.askAssistant(text, ARTICLES, GUIDE, since)
      if (ai.configured && ai.message) {
        push(ai.message)
        setSuggestions({ id: ai.message.id, list: ai.suggestions?.length ? ai.suggestions : ai.handoff ? [] : starterSuggestions(context).slice(0, 3) })
        return
      }
      const answer = localAnswer(text, { context, history })
      await new Promise((resolve) => setTimeout(resolve, 450))
      const created = await supportService.send({ userId: user.id, sender: 'assistant', message: answer.reply, needsHuman: false, handoff: answer.handoff })
      push(created)
      setSuggestions({ id: created.id, list: answer.suggestions })
      if (answer.handoff) await handOff(answer.summary || text)
    } catch { /* assistant is best-effort */ } finally {
      setTyping(false)
    }
  }

  /** "Razgovaraj sa pravim pomoćnikom": hands this conversation to the team straight away. */
  const requestHuman = async () => {
    if (!user || sending || humanActive) return
    setSending(true)
    setError('')
    try {
      const created = await supportService.send({ userId: user.id, sender: 'user', message: `${HUMAN_LABEL}.`, needsHuman: false })
      push(created)
      const answer = localAnswer(HUMAN_LABEL, { context, history: [...current.messages, created] })
      const reply = await supportService.send({ userId: user.id, sender: 'assistant', message: answer.reply, needsHuman: false, handoff: true })
      push(reply)
      await handOff(answer.summary)
      inputRef.current?.focus()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  const send = async (text) => {
    const clean = text.trim()
    if (!clean || !user || sending) return
    if (clean === HUMAN_LABEL) { requestHuman(); return }
    setSending(true)
    setError('')
    setShowPast(false)
    try {
      // once a person replied or the assistant handed over, this conversation goes straight to the team
      const created = await supportService.send({ userId: user.id, sender: 'user', message: clean, needsHuman: humanActive })
      push(created)
      setDraft('')
      setSuggestions(null)
      if (!humanActive) assistantReply(clean, [...current.messages, created], current.messages[0]?.created_at || created.created_at)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  const startNew = () => {
    if (!user) return
    setResetAt(writeReset(user.id, messages[messages.length - 1]))
    setSuggestions(null)
    setShowPast(false)
    setDraft('')
    inputRef.current?.focus()
  }

  if (!onHelpPage) return null

  const firstName = context?.firstName || (user?.user_metadata?.full_name ? String(user.user_metadata.full_name).split(' ')[0] : '')

  return (
    <div className={`support-chat ${open ? 'is-open' : ''}`}>
      {open && (
        <div className="support-chat-panel" role="dialog" aria-label="Podrška">
          <div className="support-chat-header">
            <span className="support-chat-who">
              <span className={`support-avatar ${humanActive ? 'is-team' : ''}`}>{humanActive ? <UserRound size={16} /> : <Sparkles size={16} />}</span>
              <span>
                <strong>{humanActive ? 'Zadatak tim' : 'Zadatak asistent'}</strong>
                <small>{humanActive ? 'Pravi pomoćnik · obično odgovaramo u par sati' : 'Digitalni pomoćnik · odgovara odmah'}</small>
              </span>
            </span>
            <span className="support-chat-actions">
              {user && shown.length > 0 && (
                <button type="button" className="icon-button" onClick={startNew} aria-label="Novi razgovor" title="Novi razgovor"><RotateCcw size={15} /></button>
              )}
              <button type="button" className="icon-button" onClick={closeChat} aria-label="Zatvori"><X size={16} /></button>
            </span>
          </div>

          {!user ? (
            <div className="support-chat-guest">
              <p>Prijavi se da razgovaraš sa podrškom — ili pogledaj <Link to="/pomoc" onClick={closeChat}>Centar za pomoć</Link>.</p>
              <Link to="/login" className="primary-button small-button" onClick={closeChat}>Prijavi se</Link>
            </div>
          ) : (
            <>
              <div className="support-chat-messages" ref={listRef}>
                {loading && <SkeletonLines n={2} />}

                {!loading && pastShown.length > 0 && (
                  <button type="button" className="support-past-toggle" onClick={() => setShowPast((value) => !value)}>
                    <History size={13} /> {showPast ? 'Sakrij prethodne razgovore' : `Prethodni razgovori (${pastShown.length})`} {showPast ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                )}
                {!loading && showPast && pastShown.map((session) => (
                  <div key={session.start} className="support-past">
                    <div className="support-divider">{dayLabel(session.start)}</div>
                    {session.messages.map((item) => <Bubble key={item.id} item={item} onNavigate={closeChat} />)}
                  </div>
                ))}
                {!loading && showPast && <div className="support-divider">Sada</div>}

                {!loading && expired && shown.length === 0 && (
                  <div className="support-notice">Prethodni razgovor je zatvoren nakon {SUPPORT_IDLE_MS / 60000} minuta neaktivnosti. Ovo je novi, prazan razgovor.</div>
                )}
                {!loading && (
                  <div className="support-bubble from-admin support-bubble-assistant">
                    <small>Zadatak asistent</small>
                    Zdravo{firstName ? `, ${firstName}` : ''}! Ja sam Zadatak asistent. Pitaj me bilo šta o platformi, tvojim poslovima, ponudama ili balansu — odgovaram odmah. Ako želiš osobu, klikni „{HUMAN_LABEL}“.
                  </div>
                )}
                {shown.map((item) => <Bubble key={item.id} item={item} onNavigate={closeChat} />)}
                {typing && <div className="support-bubble from-admin support-typing"><span /><span /><span /></div>}
                {!loading && !typing && !humanActive && chips.length > 0 && (
                  <div className="support-quick">
                    {chips.map((label) => (
                      <button key={label} type="button" className={label === HUMAN_LABEL ? 'is-human' : ''} onClick={() => send(label)} disabled={sending}>{label}</button>
                    ))}
                  </div>
                )}
              </div>
              {error && <div className="form-error">{error}</div>}

              <div className="support-chat-foot">
                {humanActive ? (
                  <span className="support-human-status"><UserRound size={13} /> Pravi pomoćnik je obaviješten — odgovor stiže ovdje i na email.</span>
                ) : (
                  <button type="button" className="support-human-button" onClick={requestHuman} disabled={sending}>
                    <UserRound size={15} /> {HUMAN_LABEL}
                  </button>
                )}
                <Link to="/pomoc" className="support-help-link" onClick={closeChat}><BookOpen size={13} /> Centar za pomoć</Link>
              </div>
              <form className="support-chat-form" onSubmit={(event) => { event.preventDefault(); send(draft) }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(draft) } }}
                  placeholder={humanActive ? 'Napiši poruku timu...' : 'Pitaj bilo šta, npr. „gdje mi je balans?“'}
                  aria-label="Poruka podršci"
                  maxLength={2000}
                />
                <button type="submit" className="icon-button" disabled={sending || !draft.trim()} aria-label="Pošalji"><Send size={16} /></button>
              </form>
            </>
          )}
        </div>
      )}

      <button type="button" className="support-chat-toggle" onClick={() => setOpen((value) => !value)} aria-label="Otvori podršku">
        {open ? <X size={22} /> : <LifeBuoy size={22} />}
      </button>
    </div>
  )
}

export default SupportChat
