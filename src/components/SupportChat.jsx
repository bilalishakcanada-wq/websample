import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy, Send, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supportService } from '../services/supportService'

function SupportChat() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

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
  }, [messages])

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!draft.trim() || !user) return
    setSending(true)
    setError('')
    try {
      const created = await supportService.send({ userId: user.id, sender: 'user', message: draft.trim() })
      setMessages((current) => [...current, created])
      setDraft('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="support-chat">
      {open && (
        <div className="support-chat-panel" role="dialog" aria-label="Podrška">
          <div className="support-chat-header">
            <span><LifeBuoy size={18} /> Podrška</span>
            <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Zatvori"><X size={16} /></button>
          </div>

          {!user ? (
            <div className="support-chat-guest">
              <p>Prijavite se da biste razgovarali sa podrškom.</p>
              <Link to="/login" className="primary-button small-button" onClick={() => setOpen(false)}>Prijavi se</Link>
            </div>
          ) : (
            <>
              <div className="support-chat-messages" ref={listRef}>
                {loading && <p className="muted-text">Učitavanje...</p>}
                {!loading && messages.length === 0 && (
                  <p className="muted-text">Pošaljite poruku i naš tim će vam odgovoriti u najkraćem roku.</p>
                )}
                {messages.map((item) => (
                  <div key={item.id} className={`support-bubble ${item.sender === 'admin' ? 'from-admin' : 'from-user'}`}>
                    {item.message}
                  </div>
                ))}
              </div>
              {error && <div className="form-error">{error}</div>}
              <form className="support-chat-form" onSubmit={sendMessage}>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Napišite poruku..."
                  maxLength={2000}
                />
                <button type="submit" className="icon-button" disabled={sending || !draft.trim()} aria-label="Pošalji">
                  <Send size={16} />
                </button>
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
