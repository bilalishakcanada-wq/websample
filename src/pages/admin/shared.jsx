import { createContext, useContext, useState } from 'react'
import { Bot, Clock, Coins, Minus, Plus, ShieldBan, UserRound, X } from 'lucide-react'
import { adminService } from '../../services/adminService'
import { formatBosnianDate } from '../../utils/dateFormat'

/** mode ('admin' | 'moderator'), isAdmin, and openUser(id) that jumps to a user's dossier. */
export const StaffContext = createContext({ mode: 'admin', isAdmin: true, openUser: () => {} })
export const useStaff = () => useContext(StaffContext)

export const KIND_LABEL = { phone: 'telefon', email: 'email', url: 'link', social: 'društvena mreža', handle: '@handle', member_id: 'privatni ID', image_contact: 'kontakt na slici', prohibited: 'zabranjen sadržaj', ai_assessment: 'AI procjena' }
export const ACTION_LABEL = { masked: 'Maskirano', removed: 'Uklonjeno', flagged: 'Označeno', suspended: 'Suspendovan', lifted: 'Suspenzija ukinuta' }
export const QUEUE_LABEL = { pending: 'Čeka AI pregled', clean: 'Čisto', flagged: 'Uklonjeno', error: 'Greška', unconfigured: 'Čeka API ključ' }
export const STAFF_ACTION_LABEL = {
  wallet_adjust: 'Balans',
  suspend: 'Suspenzija', lift: 'Ukinuta suspenzija', redact: 'Uklonjen sadržaj', badge_grant: 'Dodijeljena značka', badge_revoke: 'Uklonjena značka',
  badge_save: 'Značka sačuvana', badge_delete: 'Značka obrisana', moderator_grant: 'Postao moderator', moderator_revoke: 'Uklonjen moderator',
  admin_grant: 'Postao admin', admin_revoke: 'Uklonjen admin',
}
export const WALLET_KIND_LABEL = { admin_credit: 'Uplata (tim)', admin_debit: 'Skidanje (tim)', bonus: 'Bonus', refund: 'Povrat', fee: 'Naknada', payout: 'Isplata', purchase: 'Uplata', promo: 'Promocija' }
export const formatKM = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`

export const VERIFICATION_LABEL = { identity: 'Lična karta / pasoš', police_check: 'Uvjerenje o nekažnjavanju', licence: 'Licenca', trade: 'Struka' }
export const LICENCE_LABEL = { electrician: 'električar', plumber: 'vodoinstalater', gas: 'plin', hvac: 'klimatizacija i grijanje', construction: 'građevina', driver: 'vozačka' }

export const verificationTitle = (request) => {
  if (request.kind === 'licence') return `Licenca: ${LICENCE_LABEL[request.licence_type] || request.licence_type || '—'}`
  if (request.kind === 'trade' || !request.kind) return request.trade ? `Struka: ${request.trade}` : 'Struka nije navedena'
  return VERIFICATION_LABEL[request.kind] || request.kind
}

/** "Chrome · macOS" from a user-agent string. */
export const deviceLabel = (ua = '') => {
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Uređaj'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Preglednik'
  return `${browser} · ${os}`
}

export const geoLabel = (geo) => {
  if (!geo) return null
  return [geo.city, geo.country].filter(Boolean).filter((part, index, list) => list.indexOf(part) === index).join(', ')
}

export const relativeTime = (value) => {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'upravo sad'
  if (minutes < 60) return `prije ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `prije ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `prije ${days} d`
  return formatBosnianDate(value)
}

export function Avatar({ src, size = 40, className = '' }) {
  return (
    <span className={`adm-avatar ${className}`} style={{ '--size': `${size}px` }}>
      {src ? <img src={src} alt="" /> : <UserRound size={Math.round(size * 0.5)} />}
    </span>
  )
}

export function StatusPill({ status, until }) {
  if (status === 'suspended') {
    return <span className="pill pill-danger" title={until ? `do ${formatBosnianDate(until)}` : 'trajno'}><ShieldBan size={12} /> {until ? `Suspendovan do ${formatBosnianDate(until)}` : 'Trajno suspendovan'}</span>
  }
  if (status === 'active') return <span className="pill pill-ok">Aktivan</span>
  return <span className="pill">{status || '—'}</span>
}

export function RolePills({ roles = [] }) {
  return roles.map((role) => <span key={role} className={`pill ${role === 'ADMIN' ? 'pill-navy' : 'pill-gold'}`}>{role === 'ADMIN' ? 'Admin' : 'Moderator'}</span>)
}

/** Compact AI verdict for one account. */
export function AiVerdict({ assessment, assessedAt, onRun, busy }) {
  if (!assessment) {
    return <button type="button" className="ghost-button" onClick={onRun} disabled={busy}><Bot size={14} /> {busy ? 'AI analizira...' : 'AI procjena'}</button>
  }
  return (
    <div className={`ai-verdict risk-${assessment.risk_level}`}>
      <div className="ai-verdict-head">
        <Bot size={14} />
        <strong>{assessment.trust_score}/100</strong>
        <span className={`tag risk-${assessment.risk_level}`}>{{ low: 'nizak rizik', medium: 'srednji rizik', high: 'visok rizik' }[assessment.risk_level] || assessment.risk_level}</span>
        <span className="tag">{{ none: 'ništa', watch: 'pratiti', review: 'pregledati', suspend: 'suspendovati' }[assessment.recommended_action] || assessment.recommended_action}</span>
        <button type="button" className="ghost-button" onClick={onRun} disabled={busy}>{busy ? '...' : 'Osvježi'}</button>
      </div>
      <p>{assessment.summary}</p>
      {assessment.signals?.length > 0 && <ul>{assessment.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>}
      {assessedAt && <small>{formatBosnianDate(assessedAt)} · {assessment.model}</small>}
    </div>
  )
}

const PRESETS = [
  { label: '1 sat', hours: 1 }, { label: '6 sati', hours: 6 }, { label: '24 sata', hours: 24 }, { label: '3 dana', hours: 72 },
  { label: '7 dana', hours: 168 }, { label: '30 dana', hours: 720 }, { label: 'Trajno', hours: null },
]
const REASONS = ['Pravilo #1 — dijeljenje kontakt podataka', 'Prevara ili sumnjivo ponašanje', 'Uvredljivo ponašanje', 'Lažni profil / lažne recenzije', 'Spam ponude', 'Zabranjen sadržaj']

/** Suspension dialog: presets, custom days + hours, and a reason. */
export function SuspendDialog({ user, onClose, onDone }) {
  const [preset, setPreset] = useState(168)
  const [custom, setCustom] = useState(false)
  const [days, setDays] = useState('7')
  const [hours, setHours] = useState('0')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const totalHours = custom ? (Number(days) || 0) * 24 + (Number(hours) || 0) : preset
  const valid = custom ? totalHours >= 1 : true

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await adminService.suspend(user.user_id, custom ? totalHours : preset, reason)
      onDone?.()
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm-modal-backdrop" onClick={onClose} role="presentation">
      <div className="adm-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="suspend-title">
        <div className="adm-modal-head">
          <h3 id="suspend-title"><ShieldBan size={18} /> Suspenduj nalog</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
        </div>
        <div className="adm-modal-user"><Avatar src={user.avatar_url} size={36} /><div><strong>{user.full_name || 'Korisnik'}</strong><span className="uid-chip">{user.member_id}</span></div></div>

        <span className="adm-label">Trajanje</span>
        <div className="adm-presets">
          {PRESETS.map((item) => (
            <button key={item.label} type="button" className={!custom && preset === item.hours ? 'active' : ''} onClick={() => { setCustom(false); setPreset(item.hours) }}>{item.label}</button>
          ))}
          <button type="button" className={custom ? 'active' : ''} onClick={() => setCustom(true)}><Clock size={13} /> Prilagođeno</button>
        </div>
        {custom && (
          <div className="adm-custom-duration">
            <label><span>Dana</span><input type="number" min="0" max="365" value={days} onChange={(event) => setDays(event.target.value)} /></label>
            <label><span>Sati</span><input type="number" min="0" max="23" value={hours} onChange={(event) => setHours(event.target.value)} /></label>
            <small>{valid ? `Ukupno ${totalHours} h` : 'Najmanje 1 sat'}</small>
          </div>
        )}

        <span className="adm-label">Razlog (vidi ga korisnik)</span>
        <div className="adm-reason-chips">
          {REASONS.map((item) => <button key={item} type="button" className={reason === item ? 'active' : ''} onClick={() => setReason(item)}>{item}</button>)}
        </div>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={300} placeholder="Kratko objašnjenje…" />

        {error && <div className="form-error">{error}</div>}
        <div className="adm-modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Odustani</button>
          <button type="button" className="danger-button" onClick={submit} disabled={busy || !valid}>{busy ? 'Suspendujem…' : preset === null && !custom ? 'Trajno suspenduj' : 'Suspenduj'}</button>
        </div>
      </div>
    </div>
  )
}

const CREDIT_AMOUNTS = [5, 10, 20, 50, 100]
const CREDIT_KINDS = [['admin_credit', 'Uplata'], ['bonus', 'Bonus'], ['promo', 'Promocija'], ['refund', 'Povrat']]
const DEBIT_KINDS = [['admin_debit', 'Skidanje'], ['fee', 'Naknada'], ['payout', 'Isplata']]

/** Add or remove money on a user's balance. */
export function CreditsDialog({ user, balance = 0, onClose, onDone }) {
  const [direction, setDirection] = useState('add')
  const [amount, setAmount] = useState('10')
  const [kind, setKind] = useState('admin_credit')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const value = Number(String(amount).replace(',', '.'))
  const valid = value > 0 && value <= 100000 && (direction === 'add' || value <= Number(balance))
  const after = direction === 'add' ? Number(balance) + (value || 0) : Number(balance) - (value || 0)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await adminService.adjustBalance(user.user_id, direction === 'add' ? value : -value, kind, note)
      onDone?.()
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm-modal-backdrop" onClick={onClose} role="presentation">
      <div className="adm-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="adm-modal-head">
          <h3><Coins size={18} /> Balans</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
        </div>
        <div className="adm-modal-user"><Avatar src={user.avatar_url} size={36} /><div><strong>{user.full_name || 'Korisnik'}</strong><span className="uid-chip">{user.member_id}</span></div><span className="credits-now">{formatKM(balance)}</span></div>

        <div className="credits-direction">
          <button type="button" className={direction === 'add' ? 'active add' : ''} onClick={() => { setDirection('add'); setKind('admin_credit') }}><Plus size={15} /> Dodaj</button>
          <button type="button" className={direction === 'remove' ? 'active remove' : ''} onClick={() => { setDirection('remove'); setKind('admin_debit') }}><Minus size={15} /> Skini</button>
        </div>

        <span className="adm-label">Iznos (KM)</span>
        <div className="adm-presets">
          {CREDIT_AMOUNTS.map((preset) => <button key={preset} type="button" className={Number(amount) === preset ? 'active' : ''} onClick={() => setAmount(String(preset))}>{preset} KM</button>)}
        </div>
        <div className="credits-amount">
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" />
          <span>KM</span>
        </div>

        <span className="adm-label">Vrsta</span>
        <div className="adm-reason-chips">
          {(direction === 'add' ? CREDIT_KINDS : DEBIT_KINDS).map(([id, label]) => <button key={id} type="button" className={kind === id ? 'active' : ''} onClick={() => setKind(id)}>{label}</button>)}
        </div>
        <span className="adm-label">Napomena (vidi je korisnik)</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={200} placeholder="npr. Bonus dobrodošlice" />

        <div className={`credits-preview ${direction}`}>
          <span>Novo stanje</span>
          <strong>{formatKM(Math.max(0, after))}</strong>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="adm-modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Odustani</button>
          <button type="button" className={direction === 'add' ? 'primary-button' : 'danger-button'} onClick={submit} disabled={busy || !valid}>{busy ? 'Čuvam…' : direction === 'add' ? `Dodaj ${formatKM(value || 0)}` : `Skini ${formatKM(value || 0)}`}</button>
        </div>
      </div>
    </div>
  )
}
