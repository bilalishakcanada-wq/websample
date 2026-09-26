import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { adminService } from '../../services/adminService'
import { supportService } from '../../services/supportService'
import { desktopNotify, playPing } from '../../services/notificationService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { ACTION_LABEL, KIND_LABEL, QUEUE_LABEL, useStaff, verificationTitle } from './shared'
import { withBase } from '../../utils/paths'

export function RegistryTab() {
  const { openUser } = useStaff()
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
          {!row.deleted_at && <div className="admin-row-actions"><button type="button" className="ghost-button" onClick={() => openUser(row.user_id)}>Dosije</button></div>}
        </div>
      ))}
    </div>
  )
}

export function ModerationTab() {
  const { openUser } = useStaff()
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
            <button type="button" className="adm-userlink" onClick={() => openUser(event.user_id)}><strong>{event.profiles?.full_name || event.profiles?.email || event.user_id}</strong></button>
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
            <a href={item.media_url} target="_blank" rel="noreferrer"><img loading="lazy" decoding="async" src={item.media_url} alt="" /></a>
            <div>
              <strong>{{ avatar: 'Profilna slika', portfolio: 'Portfolio', listing: 'Slika oglasa' }[item.kind] || item.kind}</strong>
              <p className="muted-text">{formatBosnianDate(item.created_at)} · pokušaja: {item.attempts}{item.result?.reason ? ` · ${item.result.reason}` : ''}</p>
            </div>
          </div>
          <span className={`tag tag-${item.status}`}>{QUEUE_LABEL[item.status] || item.status}</span>
          <div className="admin-row-actions"><button type="button" className="ghost-button" onClick={() => openUser(item.user_id)}>Dosije</button></div>
        </div>
      ))}
      {view === 'queue' && queue.length === 0 && <p className="muted-text">Nema slika u redu.</p>}

      {view === 'suspended' && [...suspended.entries()].map(([userId, profile]) => (
        <div key={userId} className="admin-row">
          <div>
            <button type="button" className="adm-userlink" onClick={() => openUser(userId)}><strong>{profile.full_name || profile.email}</strong></button> {profile.member_id && <span className="uid-chip">{profile.member_id}</span>}
            {profile.email && <p className="muted-text">{profile.email}</p>}
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

export function SupportTab() {
  const { openUser } = useStaff()
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

  // live: new support messages refresh the list and the open thread, and ping the staff member
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
  const active = threads.find((thread) => thread.userId === activeUser)

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
            <div className="admin-conv-head">
              <button type="button" className="adm-userlink" onClick={() => openUser(activeUser)}><strong>{active?.fullName || 'Korisnik'}</strong> {active?.memberId && <span className="uid-chip">{active.memberId}</span>}</button>
              <button type="button" className="ghost-button" onClick={() => openUser(activeUser)}>Dosije</button>
            </div>
            <div className="support-chat-messages admin-messages">
              {messages.map((item) => (
                <div key={item.id} className={`support-bubble ${item.sender === 'admin' ? 'from-user' : 'from-admin'} ${item.sender === 'assistant' ? 'support-bubble-assistant' : ''}`}>{item.sender === 'assistant' && <small>Poso asistent (automatski)</small>}{item.message}</div>
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

export function VerificationTab() {
  const { openUser } = useStaff()
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
            <button type="button" className="adm-userlink" onClick={() => openUser(request.user_id)}><strong>Korisnik {request.user_id.slice(0, 8)}</strong></button>
            <p className="muted-text">{verificationTitle(request)} · {formatBosnianDate(request.created_at)}</p>
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

export function ReportsTab() {
  const { openUser } = useStaff()
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
            <p className="muted-text">{formatBosnianDate(report.created_at)} · prijavio: <button type="button" className="adm-userlink" onClick={() => openUser(report.reporter_id)}>{report.reporter_id.slice(0, 8)}</button>{report.target_type === 'user' && <> · <button type="button" className="adm-userlink" onClick={() => openUser(report.target_id)}>otvori prijavljenog</button></>}</p>
          </div>
          <span className={`tag tag-${report.status}`}>{report.status}</span>
          <div className="admin-row-actions">
            {report.target_type === 'listing' && <a className="ghost-button" href={withBase(`/listings/${report.target_id}`)} target="_blank" rel="noreferrer">Oglas</a>}
            <button type="button" className="ghost-button" onClick={() => act(report.id, 'resolved')}>Riješeno</button>
            <button type="button" className="ghost-button" onClick={() => act(report.id, 'rejected')}>Odbaci</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListingsTab() {
  const { openUser } = useStaff()
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
            <p className="muted-text">{listing.location} · {listing.category} · {formatBosnianDate(listing.created_at)}</p>
          </div>
          <span className={`tag tag-${listing.status}`}>{listing.status}</span>
          <div className="admin-row-actions">
            <a className="ghost-button" href={withBase(`/listings/${listing.id}`)} target="_blank" rel="noreferrer">Otvori</a>
            <button type="button" className="ghost-button" onClick={() => openUser(listing.user_id)}>Vlasnik</button>
            {listing.status !== 'archived' && <button type="button" className="ghost-button" onClick={() => act(listing.id, 'archived')}>Ukloni</button>}
            {listing.status === 'archived' && <button type="button" className="ghost-button" onClick={() => act(listing.id, 'published')}>Vrati</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
