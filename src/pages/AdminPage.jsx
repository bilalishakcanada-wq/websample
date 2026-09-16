import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { desktopNotify, playPing } from '../services/notificationService'
import { BellRing, Bot, ChevronDown, ChevronUp, IdCard, LifeBuoy, MessageSquare, Radar, ScanEye, Search, ShieldAlert, ShieldCheck, Tag, Users } from 'lucide-react'
import BackHome from '../components/BackHome'
import { adminService } from '../services/adminService'
import { supportService } from '../services/supportService'
import { formatBosnianDate } from '../utils/dateFormat'

const TABS = [
  { id: 'oversight', label: 'Nadzor', icon: Radar },
  { id: 'support', label: 'Podrška', icon: LifeBuoy },
  { id: 'messages', label: 'Poruke', icon: MessageSquare },
  { id: 'verification', label: 'Verifikacija', icon: ShieldCheck },
  { id: 'reports', label: 'Prijave', icon: ShieldAlert },
  { id: 'listings', label: 'Oglasi', icon: Tag },
  { id: 'users', label: 'Korisnici', icon: Users },
  { id: 'moderation', label: 'Moderacija', icon: ScanEye },
  { id: 'registry', label: 'ID registar', icon: IdCard },
]

const FEED_KINDS = [
  ['', 'Sve'], ['message', 'Poruke'], ['listing', 'Oglasi'], ['bid', 'Ponude'], ['review', 'Recenzije'],
  ['profile', 'Nalozi'], ['moderation', 'Pravilo #1'], ['report', 'Prijave'],
]
const KIND_ICON = { message: '💬', listing: '📋', bid: '💰', review: '⭐', profile: '👤', moderation: '🛡️', report: '🚩' }

/** Compact AI verdict for one account. */
function AiVerdict({ assessment, assessedAt, onRun, busy }) {
  if (!assessment) {
    return <button type="button" className="ghost-button" onClick={onRun} disabled={busy}><Bot size={14} /> {busy ? 'AI analizira...' : 'AI procjena'}</button>
  }
  return (
    <div className={`ai-verdict risk-${assessment.risk_level}`}>
      <div className="ai-verdict-head">
        <Bot size={14} />
        <strong>{assessment.trust_score}/100</strong>
        <span className="tag">{assessment.risk_level === 'high' ? 'Visok rizik' : assessment.risk_level === 'medium' ? 'Srednji rizik' : 'Nizak rizik'}</span>
        {assessment.recommended_action !== 'none' && <span className="tag tag-flagged">{{ watch: 'Pratiti', review: 'Pregledati', suspend: 'Predlaže suspenziju' }[assessment.recommended_action]}</span>}
        <button type="button" className="ghost-button" onClick={onRun} disabled={busy}>{busy ? '...' : 'Osvježi'}</button>
      </div>
      <p>{assessment.summary}</p>
      {assessment.signals?.length > 0 && <ul>{assessment.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>}
      {assessedAt && <small>{formatBosnianDate(assessedAt)} · {assessment.model}</small>}
    </div>
  )
}

function OversightTab() {
  const [kind, setKind] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [live, setLive] = useState(0)
  const [busyId, setBusyId] = useState('')
  const [assessments, setAssessments] = useState({})
  const kindRef = useRef(kind)
  useEffect(() => { kindRef.current = kind }, [kind])

  const load = (nextKind = kindRef.current) => {
    setLoading(true)
    adminService.activityFeed({ kind: nextKind || null, limit: 150 }).then(setRows).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load('') }, [])

  // anything new anywhere on the platform refreshes the feed
  useEffect(() => adminService.subscribeFeed(() => { setLive((count) => count + 1); load() }), [])

  const act = async (fn) => {
    setError('')
    try { await fn(); load() } catch (requestError) { setError(requestError.message) }
  }

  const runAgent = async (userId) => {
    setBusyId(userId)
    setError('')
    try {
      const outcome = await adminService.runTrustAgent(userId)
      if (outcome?.configured === false) setError('AI agent čeka ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).')
      const fresh = await adminService.getAssessment(userId)
      setAssessments((current) => ({ ...current, [userId]: fresh }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="admin-table">
      <div className="admin-live-row">
        <span className="admin-live-dot" /> Uživo — svaka nova poruka, oglas, ponuda, recenzija, nalog i kršenje pravila pojavljuje se ovdje čim nastane.{live > 0 && ` (${live} novih od otvaranja)`}
      </div>
      <div className="admin-subtabs">
        {FEED_KINDS.map(([value, label]) => (
          <button key={value} type="button" className={kind === value ? 'active' : ''} onClick={() => { setKind(value); load(value) }}>{label}</button>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}
      {loading && rows.length === 0 ? <div className="page-state">Učitavanje...</div> : rows.length === 0 ? <p className="muted-text">Nema aktivnosti.</p> : rows.map((row) => (
        <div key={`${row.kind}-${row.id}`} className={`admin-row feed-${row.kind}`}>
          <div className="admin-feed-main">
            <span className="admin-feed-kind">{KIND_ICON[row.kind] || '•'}</span>
            <div>
              <strong>{row.title}</strong>
              {row.status && <span className={`tag tag-${row.status}`}>{row.status}</span>}
              <p className="muted-text">
                {row.full_name || 'Nepoznat'} {row.member_id && <span className="uid-chip">{row.member_id}</span>} · {formatBosnianDate(row.created_at)}
                {row.account_status === 'suspended' && <span className="tag tag-suspended">suspendovan</span>}
              </p>
              {row.body && <p className="admin-snippet">{row.body}</p>}
              {assessments[row.user_id] && <AiVerdict assessment={assessments[row.user_id].ai_assessment} assessedAt={assessments[row.user_id].ai_assessed_at} onRun={() => runAgent(row.user_id)} busy={busyId === row.user_id} />}
            </div>
          </div>
          <div className="admin-row-actions">
            {['message', 'bid', 'review', 'listing'].includes(row.kind) && (
              <button type="button" className="ghost-button" onClick={() => { const note = window.prompt('Razlog uklanjanja (vidi ga korisnik u istoriji):', 'Kršenje pravila zajednice'); if (note != null) act(() => adminService.redact(row.kind, row.id, note)) }}>Ukloni</button>
            )}
            {row.kind === 'listing' && <a className="ghost-button" href={`/listings/${row.ref_id}`} target="_blank" rel="noreferrer">Otvori</a>}
            {row.user_id && <a className="ghost-button" href={`/korisnik/${row.user_id}`} target="_blank" rel="noreferrer">Profil</a>}
            {row.user_id && !assessments[row.user_id] && <button type="button" className="ghost-button" onClick={() => runAgent(row.user_id)} disabled={busyId === row.user_id}><Bot size={14} /> {busyId === row.user_id ? '...' : 'AI'}</button>}
            {row.user_id && row.account_status !== 'suspended' && (
              <button type="button" className="ghost-button danger" onClick={() => { const days = window.prompt('Suspenzija — broj dana (prazno = trajno):', '7'); if (days == null) return; const reason = window.prompt('Razlog:', 'Kršenje pravila zajednice') || null; act(() => adminService.suspend(row.user_id, days.trim() === '' ? null : Number(days), reason)) }}>Suspenduj</button>
            )}
            {row.user_id && row.account_status === 'suspended' && (
              <button type="button" className="ghost-button" onClick={() => act(() => adminService.liftSuspension(row.user_id))}>Ukini suspenziju</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function MessagesTab() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState('')
  const [thread, setThread] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    adminService.listConversations(150).then(setConversations).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  useEffect(() => adminService.subscribeFeed((table, row) => {
    if (table !== 'messages') return
    load()
    if (row.conversation_id === activeId) setThread((current) => current.some((item) => item.id === row.id) ? current : [...current, row])
  }), [activeId])

  const open = async (conversation) => {
    setActiveId(conversation.id)
    setError('')
    try { setThread(await adminService.conversationMessages(conversation.id)) } catch (requestError) { setError(requestError.message) }
  }

  const active = conversations.find((item) => item.id === activeId)
  const nameOf = (userId) => (active ? (userId === active.one_id ? active.one_name : active.two_name) : null) || 'Korisnik'

  if (loading && conversations.length === 0) return <div className="page-state">Učitavanje poruka...</div>

  return (
    <div className="admin-support-layout">
      <div className="admin-thread-list">
        <p className="muted-text">Svi razgovori na platformi ({conversations.length}). Uživo.</p>
        {conversations.length === 0 && <p className="muted-text">Još nema razgovora.</p>}
        {conversations.map((conversation) => (
          <button key={conversation.id} type="button" className={`admin-thread-item ${activeId === conversation.id ? 'active' : ''}`} onClick={() => open(conversation)}>
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
              <span><strong>{active.one_name}</strong> <span className="uid-chip">{active.one_member}</span></span>
              <span>↔</span>
              <span><strong>{active.two_name}</strong> <span className="uid-chip">{active.two_member}</span></span>
              {active.listing_id && <a className="ghost-button" href={`/listings/${active.listing_id}`} target="_blank" rel="noreferrer">Oglas</a>}
            </div>
            <div className="support-chat-messages admin-messages">
              {thread.map((item) => (
                <div key={item.id} className={`support-bubble ${item.sender_id === active.one_id ? 'from-admin' : 'from-user'}`}>
                  <small>{nameOf(item.sender_id)} · {formatBosnianDate(item.created_at)}</small>
                  {item.content}
                  <button type="button" className="bubble-remove" title="Ukloni poruku" onClick={async () => { try { await adminService.redact('message', item.id, 'Uklonio administrator'); setThread(await adminService.conversationMessages(active.id)) } catch (requestError) { setError(requestError.message) } }}>×</button>
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

function RegistryTab() {
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const search = (value) => {
    setLoading(true)
    setError('')
    adminService.lookupMember(value).then(setRows).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }

  useEffect(() => { search('') }, [])

  return (
    <div className="admin-table">
      <p className="muted-text">Svaki nalog dobija privatni ID pri registraciji. Registar čuva ID, vlasnika i datum — i nakon brisanja naloga — pa se svaki događaj može vezati za tačan nalog.</p>
      <form className="admin-search" onSubmit={(event) => { event.preventDefault(); search(term) }}>
        <Search size={16} />
        <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="PB-XXXX-XXXX, email, ime ili user id" />
        <button type="submit" className="primary-button">Traži</button>
      </form>
      {error && <div className="form-error">{error}</div>}
      {loading ? <div className="page-state">Pretražujem...</div> : rows.length === 0 ? <p className="muted-text">Nema rezultata.</p> : rows.map((row) => (
        <div key={row.member_id} className={`admin-row ${row.deleted_at ? 'is-dismissed' : ''}`}>
          <div>
            <strong>{row.full_name || row.email}</strong> <span className="uid-chip">{row.member_id}</span>
            <p className="muted-text">
              {row.email} · {row.account_type || 'client'} · registrovan {formatBosnianDate(row.created_at)}
              {row.deleted_at ? ` · obrisan ${formatBosnianDate(row.deleted_at)}` : ''}
            </p>
            <p className="muted-text">
              {row.listings} oglasa · {row.bids} ponuda · {row.messages} poruka · {row.reviews_received} recenzija · {row.strikes} kršenja
              {row.suspension_reason ? ` · ${row.suspension_reason}` : ''}
            </p>
            <code className="admin-userid">{row.user_id}</code>
          </div>
          <span className={`tag ${row.deleted_at ? '' : `tag-${row.account_status === 'suspended' ? 'suspended' : 'clean'}`}`}>{row.deleted_at ? 'Obrisan' : row.account_status}</span>
        </div>
      ))}
    </div>
  )
}

const KIND_LABEL = { phone: 'telefon', email: 'email', url: 'link', social: 'društvena mreža', handle: '@handle', member_id: 'privatni ID', image_contact: 'kontakt na slici' }
const ACTION_LABEL = { masked: 'Maskirano', removed: 'Slika uklonjena', flagged: 'Označeno', suspended: 'Suspendovan', lifted: 'Suspenzija ukinuta' }
const QUEUE_LABEL = { pending: 'Čeka AI pregled', clean: 'Čisto', flagged: 'Uklonjeno', error: 'Greška', unconfigured: 'Čeka API ključ' }

function ModerationTab() {
  const [events, setEvents] = useState([])
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('events')

  const load = () => {
    setLoading(true)
    Promise.all([adminService.listModerationEvents(), adminService.listModerationQueue()])
      .then(([eventRows, queueRows]) => { setEvents(eventRows); setQueue(queueRows) })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const run = async (action) => {
    setError('')
    try {
      await action()
      load()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const suspended = events.filter((event) => event.profiles?.account_status === 'suspended').reduce((map, event) => map.set(event.user_id, event.profiles), new Map())
  const pendingQueue = queue.filter((item) => ['pending', 'unconfigured'].includes(item.status))

  if (loading) return <div className="page-state">Učitavanje moderacije...</div>

  return (
    <div className="admin-table">
      {error && <div className="form-error">{error}</div>}
      <div className="admin-mod-summary">
        <div><strong>{events.filter((event) => event.action === 'masked' || event.action === 'removed').length}</strong><span>kršenja Pravila #1</span></div>
        <div><strong>{suspended.size}</strong><span>suspendovanih</span></div>
        <div><strong>{pendingQueue.length}</strong><span>slika čeka AI</span></div>
        <div><strong>{queue.filter((item) => item.status === 'flagged').length}</strong><span>slika uklonjeno</span></div>
      </div>
      {pendingQueue.some((item) => item.status === 'unconfigured') && (
        <div className="form-error">AI pregled slika nije aktivan: dodaj <code>ANTHROPIC_API_KEY</code> u Supabase → Edge Functions → Secrets. Slike u redu čekaju i biće pregledane automatski čim ključ bude dodan.</div>
      )}
      <div className="admin-subtabs">
        <button type="button" className={view === 'events' ? 'active' : ''} onClick={() => setView('events')}>Događaji ({events.length})</button>
        <button type="button" className={view === 'queue' ? 'active' : ''} onClick={() => setView('queue')}>Slike ({queue.length})</button>
        <button type="button" className={view === 'suspended' ? 'active' : ''} onClick={() => setView('suspended')}>Suspendovani ({suspended.size})</button>
      </div>

      {view === 'events' && events.map((event) => (
        <div key={event.id} className={`admin-row ${event.dismissed ? 'is-dismissed' : ''}`}>
          <div>
            <strong>{event.profiles?.full_name || event.profiles?.email || event.user_id}</strong>
            {event.profiles?.member_id && <span className="uid-chip">{event.profiles.member_id}</span>}
            <p className="muted-text">
              {ACTION_LABEL[event.action] || event.action} · {event.source_table}{event.fields?.length ? ` (${event.fields.join(', ')})` : ''}
              {event.kinds?.length ? ` · ${event.kinds.map((kind) => KIND_LABEL[kind] || kind).join(', ')}` : ''} · {formatBosnianDate(event.created_at)}
            </p>
            {event.snippet && <p className="admin-snippet">{event.snippet}</p>}
          </div>
          <span className={`tag tag-${event.action}`}>{event.dismissed ? 'Odbačeno' : ACTION_LABEL[event.action] || event.action}</span>
          <div className="admin-row-actions">
            {(event.action === 'masked' || event.action === 'removed') && (
              <button type="button" className="ghost-button" onClick={() => run(() => adminService.dismissModerationEvent(event.id, !event.dismissed))}>
                {event.dismissed ? 'Vrati kao kršenje' : 'Lažna uzbuna'}
              </button>
            )}
          </div>
        </div>
      ))}
      {view === 'events' && events.length === 0 && <p className="muted-text">Nema događaja — niko još nije prekršio Pravilo #1.</p>}

      {view === 'queue' && queue.map((item) => (
        <div key={item.id} className="admin-row">
          <div className="admin-queue-item">
            <a href={item.media_url} target="_blank" rel="noreferrer"><img src={item.media_url} alt="" /></a>
            <div>
              <strong>{item.kind === 'avatar' ? 'Profilna slika' : 'Portfolio'}</strong>
              <p className="muted-text">{formatBosnianDate(item.created_at)} · pokušaja: {item.attempts}{item.result?.reason ? ` · ${item.result.reason}` : ''}</p>
            </div>
          </div>
          <span className={`tag tag-${item.status}`}>{QUEUE_LABEL[item.status] || item.status}</span>
        </div>
      ))}
      {view === 'queue' && queue.length === 0 && <p className="muted-text">Nema slika u redu.</p>}

      {view === 'suspended' && [...suspended.entries()].map(([userId, profile]) => (
        <div key={userId} className="admin-row">
          <div>
            <strong>{profile.full_name || profile.email}</strong> {profile.member_id && <span className="uid-chip">{profile.member_id}</span>}
            <p className="muted-text">{profile.email}</p>
          </div>
          <span className="tag tag-suspended">Suspendovan</span>
          <div className="admin-row-actions">
            <button type="button" className="ghost-button" onClick={() => run(() => adminService.liftSuspension(userId))}>Ukini suspenziju</button>
          </div>
        </div>
      ))}
      {view === 'suspended' && suspended.size === 0 && <p className="muted-text">Trenutno nema suspendovanih naloga.</p>}
    </div>
  )
}

function SupportTab() {
  const [threads, setThreads] = useState([])
  const [activeUser, setActiveUser] = useState('')
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadThreads = () => {
    setLoading(true)
    supportService.listThreadsForAdmin()
      .then(setThreads)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadThreads() }, [])

  // live: new support messages refresh the list and the open thread, and ping the admin
  const activeRef = useRef('')
  useEffect(() => { activeRef.current = activeUser }, [activeUser])
  useEffect(() => supportService.subscribeAll((row) => {
    loadThreads()
    if (row.user_id === activeRef.current) setMessages((current) => current.some((item) => item.id === row.id) ? current : [...current, row])
    if (row.sender === 'user') { playPing(); desktopNotify('Nova poruka podrške', row.message) }
  }), [])

  const openThread = async (userId) => {
    setActiveUser(userId)
    setError('')
    try {
      const rows = await supportService.listMyMessages(userId)
      setMessages(rows)
      await supportService.markThreadRead(userId)
      loadThreads()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const sendReply = async (event) => {
    event.preventDefault()
    if (!reply.trim() || !activeUser) return
    try {
      const created = await supportService.send({ userId: activeUser, sender: 'admin', message: reply.trim() })
      setMessages((current) => [...current, created])
      setReply('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (loading) return <div className="page-state">Učitavanje razgovora...</div>

  return (
    <div className="admin-support-layout">
      <div className="admin-thread-list">
        {threads.length === 0 && <p className="muted-text">Još nema poruka podrške.</p>}
        {threads.map((thread) => (
          <button key={thread.userId} type="button" className={`admin-thread-item ${activeUser === thread.userId ? 'active' : ''}`} onClick={() => openThread(thread.userId)}>
            <span className="admin-thread-id">{thread.fullName || thread.email || `Korisnik ${thread.userId.slice(0, 8)}`} {thread.memberId && <span className="uid-chip">{thread.memberId}</span>}</span>
            <span className="muted-text">{thread.lastSender === 'admin' ? 'Vi: ' : ''}{thread.lastMessage.slice(0, 40)}</span>
            {thread.unread > 0 && <span className="tag">{thread.unread} novo</span>}
          </button>
        ))}
      </div>
      <div className="admin-thread-detail">
        {!activeUser && <p className="muted-text">Odaberite razgovor sa lijeve strane.</p>}
        {activeUser && (
          <>
            <div className="support-chat-messages admin-messages">
              {messages.map((item) => (
                <div key={item.id} className={`support-bubble ${item.sender === 'admin' ? 'from-user' : 'from-admin'}`}>{item.message}</div>
              ))}
            </div>
            <form className="support-chat-form" onSubmit={sendReply}>
              <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Odgovorite korisniku..." />
              <button type="submit" className="primary-button small-button">Pošalji</button>
            </form>
          </>
        )}
        {error && <div className="form-error">{error}</div>}
      </div>
    </div>
  )
}

function VerificationTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    adminService.listVerificationRequests().then(setRequests).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const act = async (id, status) => {
    try {
      await adminService.setVerificationStatus(id, status)
      load()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (loading) return <div className="page-state">Učitavanje zahtjeva...</div>

  return (
    <div className="admin-table">
      {error && <div className="form-error">{error}</div>}
      {requests.length === 0 && <p className="muted-text">Nema zahtjeva za verifikaciju.</p>}
      {requests.map((request) => (
        <div className="admin-row" key={request.id}>
          <div>
            <strong>Korisnik {request.user_id.slice(0, 8)}</strong>
            <p className="muted-text">
              {({ identity: 'Lična karta / pasoš', police_check: 'Uvjerenje o nekažnjavanju', licence: `Licenca: ${{ electrician: 'električar', plumber: 'vodoinstalater', gas: 'plin', hvac: 'klimatizacija i grijanje', construction: 'građevina', driver: 'vozačka' }[request.licence_type] || request.licence_type}` }[request.kind]) || (request.trade ? `Struka: ${request.trade}` : 'Struka nije navedena')} · {formatBosnianDate(request.created_at)}
            </p>
            <a href={request.document_url} target="_blank" rel="noreferrer" className="text-link">Pogledaj dokument</a>
          </div>
          <span className={`tag status-tag-${request.status}`}>{request.status}</span>
          {request.status === 'pending' && (
            <div className="admin-row-actions">
              <button type="button" className="ghost-button" onClick={() => act(request.id, 'approved')}>Odobri</button>
              <button type="button" className="ghost-button danger-button" onClick={() => act(request.id, 'rejected')}>Odbij</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ReportsTab() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    adminService.listReports().then(setReports).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const act = async (id, status) => {
    try {
      await adminService.setReportStatus(id, status)
      load()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (loading) return <div className="page-state">Učitavanje prijava...</div>

  return (
    <div className="admin-table">
      {error && <div className="form-error">{error}</div>}
      {reports.length === 0 && <p className="muted-text">Nema prijava.</p>}
      {reports.map((report) => (
        <div className="admin-row" key={report.id}>
          <div>
            <strong>{report.target_type}</strong>
            <p className="muted-text">{report.reason}</p>
          </div>
          <span className="tag">{report.status}</span>
          <div className="admin-row-actions">
            <button type="button" className="ghost-button" onClick={() => act(report.id, 'resolved')}>Riješeno</button>
            <button type="button" className="ghost-button" onClick={() => act(report.id, 'rejected')}>Odbaci</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ListingsTab() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    adminService.listAllListings().then(setListings).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const act = async (id, status) => {
    try {
      await adminService.setListingStatus(id, status)
      load()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (loading) return <div className="page-state">Učitavanje oglasa...</div>

  return (
    <div className="admin-table">
      {error && <div className="form-error">{error}</div>}
      {listings.length === 0 && <p className="muted-text">Nema oglasa.</p>}
      {listings.map((listing) => (
        <div className="admin-row" key={listing.id}>
          <div>
            <strong>{listing.title}</strong>
            <p className="muted-text">{listing.location} · {listing.category}</p>
          </div>
          <span className="tag">{listing.status}</span>
          <div className="admin-row-actions">
            {listing.status !== 'archived' && <button type="button" className="ghost-button" onClick={() => act(listing.id, 'archived')}>Ukloni</button>}
            {listing.status === 'archived' && <button type="button" className="ghost-button" onClick={() => act(listing.id, 'published')}>Vrati</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

function UserDetail({ userId }) {
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let active = true
    adminService.getUserDetail(userId).then((data) => active && setDetail(data))
    return () => { active = false }
  }, [userId])

  if (!detail) return <div className="page-state">Učitavanje...</div>

  return (
    <div className="admin-user-detail">
      <div className="admin-user-detail-col">
        <h4>Oglasi ({detail.listings.length})</h4>
        {detail.listings.length === 0 && <p className="muted-text">Nema oglasa.</p>}
        {detail.listings.map((item) => <div key={item.id} className="admin-mini-row"><span>{item.title}</span><span className="tag">{item.status}</span></div>)}
      </div>
      <div className="admin-user-detail-col">
        <h4>Ponude ({detail.bids.length})</h4>
        {detail.bids.length === 0 && <p className="muted-text">Nema ponuda.</p>}
        {detail.bids.map((item) => <div key={item.id} className="admin-mini-row"><span>{item.amount} KM — {item.message.slice(0, 30)}</span><span className="tag">{item.status}</span></div>)}
      </div>
      <div className="admin-user-detail-col">
        <h4>Podrška ({detail.supportMessages.length})</h4>
        {detail.supportMessages.length === 0 && <p className="muted-text">Nema poruka.</p>}
        {detail.supportMessages.map((item) => <div key={item.id} className="admin-mini-row"><span>[{item.sender}] {item.message.slice(0, 40)}</span></div>)}
      </div>
      <div className="admin-user-detail-col">
        <h4>Prijave poslane ({detail.reports.length})</h4>
        {detail.reports.length === 0 && <p className="muted-text">Nema prijava.</p>}
        {detail.reports.map((item) => <div key={item.id} className="admin-mini-row"><span>{item.target_type}: {item.reason.slice(0, 30)}</span><span className="tag">{item.status}</span></div>)}
      </div>
    </div>
  )
}

function UsersTab() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = () => {
    setLoading(true)
    adminService.listProfiles().then(setProfiles).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }

  const runAgent = async (userId) => {
    setBusyId(userId)
    setError('')
    try {
      const outcome = await adminService.runTrustAgent(userId)
      if (outcome?.configured === false) setError('AI agent čeka ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).')
      load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  useEffect(() => { load() }, [])

  const act = async (userId, status) => {
    try {
      await adminService.setAccountStatus(userId, status)
      load()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (loading) return <div className="page-state">Učitavanje korisnika...</div>

  return (
    <div className="admin-table">
      {error && <div className="form-error">{error}</div>}
      {profiles.length === 0 && <p className="muted-text">Nema korisnika.</p>}
      {profiles.map((profile) => (
        <div key={profile.id} className="admin-user-block">
          <div className="admin-row">
            <div>
              <strong>{profile.full_name || profile.email}</strong> {profile.member_id && <span className="uid-chip">{profile.member_id}</span>}
              <p className="muted-text">{profile.email} · {profile.city || 'Grad nije naveden'}{profile.account_status === 'suspended' && profile.suspension_reason ? ` · ${profile.suspension_reason}` : ''}</p>
            </div>
            <span className="tag">{profile.account_status}</span>
            <div className="admin-row-actions">
              <button type="button" className="ghost-button" onClick={() => setExpandedId(expandedId === profile.user_id ? '' : profile.user_id)}>
                {expandedId === profile.user_id ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Detalji
              </button>
              {profile.account_status !== 'suspended' && <button type="button" className="ghost-button" onClick={() => act(profile.user_id, 'suspended')}>Suspenduj</button>}
              {profile.account_status === 'suspended' && <button type="button" className="ghost-button" onClick={async () => { try { await adminService.liftSuspension(profile.user_id); load() } catch (requestError) { setError(requestError.message) } }}>Aktiviraj</button>}
            </div>
          </div>
          <div className="admin-user-ai"><AiVerdict assessment={profile.ai_assessment} assessedAt={profile.ai_assessed_at} onRun={() => runAgent(profile.user_id)} busy={busyId === profile.user_id} /></div>
          {expandedId === profile.user_id && <UserDetail userId={profile.user_id} />}
        </div>
      ))}
    </div>
  )
}

function AdminPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(TABS.some((item) => item.id === searchParams.get('tab')) ? searchParams.get('tab') : 'oversight')
  const [notifState, setNotifState] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const enableDesktop = async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setNotifState(result)
    if (result === 'granted') desktopNotify('Poso.ba obavijesti uključene', 'Dobit ćeš obavijest za svaku poruku podrške i suspenziju.')
  }

  return (
    <div className="page-shell admin-shell">
      <div className="page-card admin-card">
        <BackHome />
        <h1>Admin panel</h1>
        <p>Upravljanje korisnicima, oglasima, prijavama i podrškom.</p>
        {notifState !== 'granted' && notifState !== 'unsupported' && (
          <button type="button" className="ghost-button admin-notif-enable" onClick={enableDesktop}><BellRing size={15} /> Uključi obavijesti na računaru (poruke podrške, suspenzije)</button>
        )}
        <div className="admin-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`admin-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
        {tab === 'support' && <SupportTab />}
        {tab === 'messages' && <MessagesTab />}
        {tab === 'verification' && <VerificationTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'listings' && <ListingsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'oversight' && <OversightTab />}
        {tab === 'moderation' && <ModerationTab />}
        {tab === 'registry' && <RegistryTab />}
      </div>
    </div>
  )
}

export default AdminPage
