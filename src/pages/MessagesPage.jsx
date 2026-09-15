import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageCircle, Send, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { messageService } from '../services/messageService'
import { profileService } from '../services/profileService'
import BackHome from '../components/BackHome'
import MobileNav from '../components/MobileNav'

function MessagesPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(searchParams.get('c') || '')
  const [otherProfiles, setOtherProfiles] = useState({})
  const [thread, setThread] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  const loadConversations = () => {
    setLoading(true)
    messageService.listConversations(user.id)
      .then(async (rows) => {
        setConversations(rows)
        const ids = [...new Set(rows.map((row) => row.otherUserId))]
        const profiles = await Promise.all(ids.map((id) => profileService.getPublicProfile(id).catch(() => null)))
        setOtherProfiles(Object.fromEntries(ids.map((id, index) => [id, profiles[index]])))
        if (!activeId && rows.length > 0) setActiveId(rows[0].id)
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadConversations() }, [])

  useEffect(() => {
    if (!activeId) return undefined
    messageService.listMessages(activeId).then(setThread).catch((requestError) => setError(requestError.message))
    return messageService.subscribeToConversation(activeId, (row) => {
      setThread((current) => (current.some((item) => item.id === row.id) ? current : [...current, row]))
    })
  }, [activeId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread])

  const activeConversation = conversations.find((item) => item.id === activeId)

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!draft.trim() || !activeConversation) return
    setError('')
    try {
      const created = await messageService.send({
        conversationId: activeId,
        senderId: user.id,
        receiverId: activeConversation.otherUserId,
        content: draft.trim(),
      })
      setThread((current) => [...current, created])
      setDraft('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="app-shell page-with-mobile-nav">
      <header className="app-page-header"><div><BackHome /><span className="eyebrow small-eyebrow">Inbox</span><h1>Poruke</h1></div><MessageCircle size={22} /></header>
      <main className="content-container">
        {loading && <div className="page-state">Učitavanje...</div>}

        {!loading && conversations.length === 0 && (
          <div className="empty-state">
            <MessageCircle size={42} />
            <h2>Još nema poruka</h2>
            <p>Poruke sa klijentima i izvođačima pojaviće se ovdje čim neka ponuda bude prihvaćena.</p>
          </div>
        )}

        {!loading && conversations.length > 0 && (
          <div className="messages-layout">
            <div className="messages-thread-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`messages-thread-item ${activeId === conversation.id ? 'active' : ''}`}
                  onClick={() => setActiveId(conversation.id)}
                >
                  <strong>{otherProfiles[conversation.otherUserId]?.full_name || 'Korisnik Poso.ba'}</strong>
                  <span className="muted-text">{conversation.listingTitle}</span>
                  {conversation.lastMessage && <span className="messages-preview">{conversation.lastMessage.slice(0, 44)}</span>}
                </button>
              ))}
            </div>

            <div className="messages-thread-detail">
              {activeConversation && (
                <>
                  <div className="messages-thread-header">
                    <strong>{otherProfiles[activeConversation.otherUserId]?.full_name || 'Korisnik Poso.ba'}</strong>
                    <span className="contact-protection-note small"><ShieldCheck size={13} /> Kontakt podaci su zaštićeni prije prihvaćene ponude</span>
                  </div>
                  <div className="support-chat-messages messages-body" ref={listRef}>
                    {thread.map((item) => (
                      <div key={item.id} className={`support-bubble ${item.sender_id === user.id ? 'from-user' : 'from-admin'}`}>{item.content}</div>
                    ))}
                  </div>
                  {error && <div className="form-error">{error}</div>}
                  <form className="support-chat-form" onSubmit={sendMessage}>
                    <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Napišite poruku..." maxLength={2000} />
                    <button type="submit" className="icon-button" aria-label="Pošalji"><Send size={16} /></button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  )
}

export default MessagesPage
