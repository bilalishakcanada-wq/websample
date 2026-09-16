import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, LifeBuoy, ShieldAlert, ShieldCheck, Tag, Users } from 'lucide-react'
import BackHome from '../components/BackHome'
import { adminService } from '../services/adminService'
import { supportService } from '../services/supportService'
import { formatBosnianDate } from '../utils/dateFormat'

const TABS = [
  { id: 'support', label: 'Podrška', icon: LifeBuoy },
  { id: 'verification', label: 'Verifikacija', icon: ShieldCheck },
  { id: 'reports', label: 'Prijave', icon: ShieldAlert },
  { id: 'listings', label: 'Oglasi', icon: Tag },
  { id: 'users', label: 'Korisnici', icon: Users },
]

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
            <span className="admin-thread-id">Korisnik {thread.userId.slice(0, 8)}</span>
            <span className="muted-text">{thread.lastMessage.slice(0, 40)}</span>
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
              {request.trade ? `Struka: ${request.trade}` : 'Struka nije navedena'} · {formatBosnianDate(request.created_at)}
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

  const load = () => {
    setLoading(true)
    adminService.listProfiles().then(setProfiles).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
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
              <strong>{profile.full_name || profile.email}</strong> {profile.display_uid && <span className="uid-chip">{profile.display_uid}</span>}
              <p className="muted-text">{profile.email} · {profile.city || 'Grad nije naveden'}</p>
            </div>
            <span className="tag">{profile.account_status}</span>
            <div className="admin-row-actions">
              <button type="button" className="ghost-button" onClick={() => setExpandedId(expandedId === profile.user_id ? '' : profile.user_id)}>
                {expandedId === profile.user_id ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Detalji
              </button>
              {profile.account_status !== 'suspended' && <button type="button" className="ghost-button" onClick={() => act(profile.user_id, 'suspended')}>Suspenduj</button>}
              {profile.account_status === 'suspended' && <button type="button" className="ghost-button" onClick={() => act(profile.user_id, 'active')}>Aktiviraj</button>}
            </div>
          </div>
          {expandedId === profile.user_id && <UserDetail userId={profile.user_id} />}
        </div>
      ))}
    </div>
  )
}

function AdminPage() {
  const [tab, setTab] = useState('support')

  return (
    <div className="page-shell admin-shell">
      <div className="page-card admin-card">
        <BackHome />
        <h1>Admin panel</h1>
        <p>Upravljanje korisnicima, oglasima, prijavama i podrškom.</p>
        <div className="admin-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`admin-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
        {tab === 'support' && <SupportTab />}
        {tab === 'verification' && <VerificationTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'listings' && <ListingsTab />}
        {tab === 'users' && <UsersTab />}
      </div>
    </div>
  )
}

export default AdminPage
