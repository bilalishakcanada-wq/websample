import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { adminService } from '../../services/adminService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { Avatar, RolePills, StatusPill, relativeTime, useStaff } from './shared'
import UserDossier from './UserDossier'

const FILTERS = [['', 'Svi'], ['active', 'Aktivni'], ['suspended', 'Suspendovani']]

/** User directory: search + filters; a click opens the full dossier. */
function UsersTab({ openUserId, onOpenUser, onCloseUser, initialTerm = '' }) {
  const { isAdmin } = useStaff()
  const [term, setTerm] = useState(initialTerm)
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = (nextTerm = term, nextStatus = status) => {
    setLoading(true)
    setError('')
    adminService.listUsers({ term: nextTerm, status: nextStatus || null, limit: 150 }).then(setRows).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load(initialTerm, '') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (initialTerm) { setTerm(initialTerm); load(initialTerm, status) } }, [initialTerm]) // eslint-disable-line react-hooks/exhaustive-deps

  if (openUserId) return <UserDossier userId={openUserId} onBack={() => { onCloseUser(); load() }} />

  return (
    <div className="admin-table">
      <form className="admin-search" onSubmit={(event) => { event.preventDefault(); load() }}>
        <Search size={16} />
        <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={isAdmin ? 'Ime, PB-ID, email, grad ili user id' : 'Ime, PB-ID, grad ili user id'} />
        <button type="submit" className="primary-button">Traži</button>
      </form>
      <div className="admin-subtabs">
        {FILTERS.map(([value, label]) => (
          <button key={value} type="button" className={status === value ? 'active' : ''} onClick={() => { setStatus(value); load(term, value) }}>{label}</button>
        ))}
        <span className="muted-text adm-count">{rows.length} naloga</span>
      </div>
      {error && <div className="form-error">{error}</div>}
      {loading && rows.length === 0 && <div className="page-state">Učitavanje korisnika...</div>}
      {!loading && rows.length === 0 && <p className="muted-text">Nema korisnika za ovaj upit.</p>}
      <div className="adm-user-list">
        {rows.map((row) => (
          <button key={row.user_id} type="button" className="adm-user-row" onClick={() => onOpenUser(row.user_id)}>
            <Avatar src={row.avatar_url} size={42} />
            <div className="adm-user-main">
              <strong>{row.full_name || row.email || 'Korisnik'} <span className="uid-chip">{row.member_id}</span> <RolePills roles={row.roles} /></strong>
              <span className="muted-text">{row.email ? `${row.email} · ` : ''}{row.city || 'grad —'} · registrovan {formatBosnianDate(row.created_at)} · aktivan {relativeTime(row.last_seen_at)}</span>
            </div>
            <div className="adm-user-meta">
              <span title="oglasi / ponude">{row.listings} oglasa · {row.bids} ponuda</span>
              {Number(row.strikes) > 0 && <span className="pill pill-warn">{row.strikes} kršenja</span>}
              {row.ai_risk && <span className={`pill risk-${row.ai_risk}`}>AI {row.ai_score}</span>}
            </div>
            <StatusPill status={row.account_status} until={row.suspended_until} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default UsersTab
