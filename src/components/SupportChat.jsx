import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { BookOpen, LifeBuoy, Send, Sparkles, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supportService } from '../services/supportService'
import { HELP_ARTICLES, findHelpAnswer } from '../data/helpArticles'
import { SkeletonLines } from './Skeleton'

const ARTICLES = HELP_ARTICLES.map(({ id, audience, q, a }) => ({ id, audience, q, a }))

const QUICK = [
  ['Kako objavim posao?', 'Kako objavim posao?'],
  ['Naknade i nivoi', 'Kolika je naknada i kako rade nivoi?'],
  ['Značke', 'Kako dobijam značke?'],
  ['Pravilo #1', 'Šta je Pravilo #1?'],
  ['Želim razgovarati s timom', 'Želim razgovarati s timom'],
]
// complaints, money and account problems always go to a person, even without the AI
const SERIOUS = /(prevar|scam|pare|novac|novc|uplat|isplat|balans|uze[ol]|ukra|spor|reklamac|suspend|blokir|hak|žalb|zalb|nije doš|nije dos|ne javlja|prijet|uvred)/i
const HUMAN = /\b(tim(om|u|a)?|čovjek|covjek|operater|agent|osob[ae]|živ[aou]|ziv[aou]|podrška|podrska)\b/i

const timeLabel = (value) => new Date(value).toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })

/** Floating support: the assistant answers from the help centre instantly, the team takes over in the same thread. */
function SupportChat() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const onHelpPage = pathname.startsWith('/pomoc')
  const [open, setOpen] = useState(false)

  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
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
  const listRef = useRef(null)

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('poso:open-support', show)
    return () => window.removeEventListener('poso:open-support', show)
  }, [])

  useEffect(() => {
    if (!open || !user) return undefined
    setLoading(true)
    setError('')
    supportService.listMyMessages(user.id)
      .then(setMessages)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
    return supportService.subscribeToMyMessages(user.id, (row) => {
      setMessages((current) => (current.some((item) => item.id === row.id) ? current : [...current, row]))
    })
  }, [open, user])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  const push = (row) => setMessages((current) => (current.some((item) => item.id === row.id) ? current : [...current, row]))

  /**
   * Assistant turn: Claude (support-assistant function) when the key is set; otherwise the
   * keyword matcher. Both end in a stored 'assistant' bubble; a hand-off pings the team.
   */
  const assistantReply = async (text) => {
    setTyping(true)
    try {
      const ai = await supportService.askAssistant(text, ARTICLES)
      if (ai.configured && ai.message) { push(ai.message); return }
      await new Promise((resolve) => setTimeout(resolve, 600))
      const wantsHuman = HUMAN.test(text) || SERIOUS.test(text)
      const article = wantsHuman ? null : findHelpAnswer(text)
      const handoff = !article
      const reply = article
        ? `${article.a}\n\nAko ti ovo ne pomaže, napiši „tim“ i naš kolega preuzima razgovor.`
        : wantsHuman
          ? 'Povezujem te sa našim timom — javit će ti se ovdje i na email, obično u roku od par sati. Slobodno odmah opiši problem što detaljnije.'
          : 'Nisam siguran u odgovor, pa povezujem tim — javit će ti se ovdje i na email, obično u roku od par sati. U međuvremenu pogledaj Centar za pomoć.'
      const created = await supportService.send({ userId: user.id, sender: 'assistant', message: reply, needsHuman: false, handoff })
      push(created)
      // no AI to summarise: re-send the user's own words as the ping to the team
      if (handoff) await supportService.send({ userId: user.id, sender: 'user', message: `(predaja timu) ${text}`, needsHuman: true }).then(push).catch(() => {})
    } catch { /* assistant is best-effort */ } finally {
      setTyping(false)
    }
  }

  const send = async (text) => {
    const clean = text.trim()
    if (!clean || !user || sending) return
    setSending(true)
    setError('')
    // once a person replied or the assistant handed over, messages go straight to the team
    const humanActive = messages.some((item) => item.sender === 'admin' || (item.sender === 'assistant' && item.handoff))
    try {
      const created = await supportService.send({ userId: user.id, sender: 'user', message: clean, needsHuman: humanActive })
      push(created)
      setDraft('')
      if (!humanActive) assistantReply(clean)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  if (!onHelpPage) return null

  return (
    <div className="support-chat">
      {open && (
        <div className="support-chat-panel" role="dialog" aria-label="Podrška">
          <div className="support-chat-header">
            <span className="support-chat-who">
              <span className="support-avatar"><Sparkles size={16} /></span>
              <span><strong>Poso asistent</strong><small>Podrška Poso.ba · obično odgovaramo u par sati</small></span>
            </span>
            <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Zatvori"><X size={16} /></button>
          </div>

          {!user ? (
            <div className="support-chat-guest">
              <p>Prijavi se da razgovaraš sa podrškom — ili pogledaj <Link to="/pomoc" onClick={() => setOpen(false)}>Centar za pomoć</Link>.</p>
              <Link to="/login" className="primary-button small-button" onClick={() => setOpen(false)}>Prijavi se</Link>
            </div>
          ) : (
            <>
              <div className="support-chat-messages" ref={listRef}>
                {loading && <SkeletonLines n={2} />}
                {!loading && (
                  <div className="support-bubble from-admin support-bubble-assistant">
                    <small>Poso asistent</small>
                    Zdravo{user.user_metadata?.full_name ? `, ${String(user.user_metadata.full_name).split(' ')[0]}` : ''}! Ja sam Poso, digitalni asistent. Pitaj me bilo šta o platformi — a ako zapne, tim preuzima u ovom istom razgovoru.
                  </div>
                )}
                {!loading && messages.length === 0 && (
                  <div className="support-quick">
                    {QUICK.map(([label, text]) => <button key={label} type="button" onClick={() => send(text)}>{label}</button>)}
                  </div>
                )}
                {messages.filter((item) => !item.message.startsWith('(predaja timu)')).map((item) => (
                  <div key={item.id} className={`support-bubble ${item.sender === 'user' ? 'from-user' : 'from-admin'} ${item.sender === 'assistant' ? 'support-bubble-assistant' : ''}`}>
                    {item.sender !== 'user' && <small>{item.sender === 'assistant' ? 'Poso asistent' : 'Poso.ba tim'} · {timeLabel(item.created_at)}</small>}
                    {item.message}
                    {item.handoff && <span className="support-handoff"><LifeBuoy size={12} /> Tim je obaviješten</span>}
                  </div>
                ))}
                {typing && <div className="support-bubble from-admin support-typing"><span /><span /><span /></div>}
              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="support-chat-foot">
                <Link to="/pomoc" className="support-help-link" onClick={() => setOpen(false)}><BookOpen size={13} /> Centar za pomoć</Link>
              </div>
              <form className="support-chat-form" onSubmit={(event) => { event.preventDefault(); send(draft) }}>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Napiši poruku..." maxLength={2000} />
                <button type="submit" className="icon-button" disabled={sending || !draft.trim()} aria-label="Pošalji"><Send size={16} /></button>
              </form>
            </>
          )}
        </div>
      )}

      <button type="button" className="support-chat-toggle" onClick={() => setOpen((current) => !current)} aria-label="Otvori podršku">
        {open ? <X size={22} /> : <LifeBuoy size={22} />}
      </button>
    </div>
  )
}

export default SupportChat
