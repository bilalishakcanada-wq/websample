import { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { useStaff } from './shared'

/** Every conversation on the platform — admin only. */
function MessagesTab({ initialConversationId = '' }) {
  const { openUser } = useStaff()
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(initialConversationId)
  const [thread, setThread] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  const load = () => {
    setLoading(true)
    adminService.listConversations(200).then(setConversations).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  useEffect(() => adminService.subscribeFeed((table, row) => {
    if (table !== 'messages') return
    load()
    if (row.conversation_id === activeId) setThread((current) => current.some((item) => item.id === row.id) ? current : [...current, row])
  }), [activeId])

  const open = async (conversationId) => {
    setActiveId(conversationId)
    setError('')
    try { setThread(await adminService.conversationMessages(conversationId)) } catch (requestError) { setError(requestError.message) }
  }

  useEffect(() => { if (initialConversationId) open(initialConversationId) }, [initialConversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const active = conversations.find((item) => item.id === activeId)
  const nameOf = (userId) => (active ? (userId === active.one_id ? active.one_name : active.two_name) : null) || 'Korisnik'
  const term = filter.trim().toLowerCase()
  const visible = term ? conversations.filter((item) => [item.one_name, item.two_name, item.one_member, item.two_member, item.listing_title, item.last_message].some((value) => (value || '').toLowerCase().includes(term))) : conversations

  if (loading && conversations.length === 0) return <div className="page-state">Učitavanje poruka...</div>

  return (
    <div className="admin-support-layout">
      <div className="admin-thread-list">
        <input className="adm-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Pretraži razgovore…" />
        <p className="muted-text">Svi razgovori ({conversations.length}). Uživo.</p>
        {visible.length === 0 && <p className="muted-text">Nema razgovora.</p>}
        {visible.map((conversation) => (
          <button key={conversation.id} type="button" className={`admin-thread-item ${activeId === conversation.id ? 'active' : ''}`} onClick={() => open(conversation.id)}>
            <span className="admin-thread-id">{conversation.one_name || 'Korisnik'} ↔ {conversation.two_name || 'Korisnik'}</span>
            <span className="muted-text">{conversation.listing_title ? `${conversation.listing_title} · ` : ''}{conversation.message_count} poruka</span>
            <span className="muted-text">{(conversation.last_message || '').slice(0, 48)}</span>
          </button>
        ))}
      </div>
      <div className="admin-thread-detail">
        {!active && <p className="muted-text">Odaberite razgovor sa lijeve strane.</p>}
        {active && (
          <>
            <div className="admin-conv-head">
              <button type="button" className="adm-userlink" onClick={() => openUser(active.one_id)}><strong>{active.one_name}</strong> <span className="uid-chip">{active.one_member}</span></button>
              <span>↔</span>
              <button type="button" className="adm-userlink" onClick={() => openUser(active.two_id)}><strong>{active.two_name}</strong> <span className="uid-chip">{active.two_member}</span></button>
              {active.listing_id && <a className="ghost-button" href={`/listings/${active.listing_id}`} target="_blank" rel="noreferrer">Oglas</a>}
            </div>
            <div className="support-chat-messages admin-messages">
              {thread.map((item) => (
                <div key={item.id} className={`support-bubble ${item.sender_id === active.one_id ? 'from-admin' : 'from-user'}`}>
                  <small>{nameOf(item.sender_id)} · {formatBosnianDate(item.created_at)}</small>
                  {item.content}
                  <button type="button" className="bubble-remove" title="Ukloni poruku" onClick={async () => { try { await adminService.redact('message', item.id, 'Uklonio Poso.ba tim'); setThread(await adminService.conversationMessages(active.id)) } catch (requestError) { setError(requestError.message) } }}>×</button>
                </div>
              ))}
            </div>
          </>
        )}
        {error && <div className="form-error">{error}</div>}
      </div>
    </div>
  )
}

export default MessagesTab
