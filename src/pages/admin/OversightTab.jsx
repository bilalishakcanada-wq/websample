import { useEffect, useRef, useState } from 'react'
import { Bot } from 'lucide-react'
import { adminService } from '../../services/adminService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { AiVerdict, SuspendDialog, useStaff } from './shared'

const FEED_KINDS = [
  ['', 'Sve'], ['message', 'Poruke'], ['listing', 'Oglasi'], ['bid', 'Ponude'], ['review', 'Recenzije'],
  ['profile', 'Nalozi'], ['moderation', 'Pravilo #1'], ['report', 'Prijave'], ['login', 'Prijave na nalog'],
]
const KIND_ICON = { message: '💬', listing: '📋', bid: '💰', review: '⭐', profile: '👤', moderation: '🛡️', report: '🚩', login: '🔑' }

function OversightTab() {
  const { openUser } = useStaff()
  const [kind, setKind] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [live, setLive] = useState(0)
  const [busyId, setBusyId] = useState('')
  const [assessments, setAssessments] = useState({})
  const [suspendTarget, setSuspendTarget] = useState(null)
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
                {row.user_id ? <button type="button" className="adm-userlink" onClick={() => openUser(row.user_id)}>{row.full_name || 'Nepoznat'}</button> : 'Nepoznat'}
                {row.member_id && <span className="uid-chip">{row.member_id}</span>} · {formatBosnianDate(row.created_at)}
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
            {row.user_id && <button type="button" className="ghost-button" onClick={() => openUser(row.user_id)}>Dosije</button>}
            {row.user_id && !assessments[row.user_id] && <button type="button" className="ghost-button" onClick={() => runAgent(row.user_id)} disabled={busyId === row.user_id}><Bot size={14} /> {busyId === row.user_id ? '...' : 'AI'}</button>}
            {row.user_id && row.account_status !== 'suspended' && (
              <button type="button" className="ghost-button danger" onClick={() => setSuspendTarget({ user_id: row.user_id, full_name: row.full_name, member_id: row.member_id })}>Suspenduj</button>
            )}
            {row.user_id && row.account_status === 'suspended' && (
              <button type="button" className="ghost-button" onClick={() => act(() => adminService.liftSuspension(row.user_id))}>Ukini suspenziju</button>
            )}
          </div>
        </div>
      ))}
      {suspendTarget && <SuspendDialog user={suspendTarget} onClose={() => setSuspendTarget(null)} onDone={() => load()} />}
    </div>
  )
}

export default OversightTab
