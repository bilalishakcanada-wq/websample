import { useEffect, useState } from 'react'
import { Award, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { adminService } from '../../services/adminService'
import { BADGE_COLORS, BADGE_ICONS, badgeIcon } from '../../components/badgeIcons'
import { Avatar } from './shared'

const KIND_TITLE = { identity: 'Značke identiteta', licence: 'Značke licenci', activity: 'Značke aktivnosti', custom: 'Prilagođene značke' }
const KIND_HINT = {
  identity: 'Dodjeljuju se automatski: telefon (SMS), lična karta i uvjerenje (odobrenje u Verifikaciji), IBAN.',
  licence: 'Dodjeljuju se kad odobriš dokument licence u Verifikaciji.',
  activity: 'Računaju se svaku noć iz recenzija, završenih poslova i brzine odgovora.',
  custom: 'Tvoje značke — dodjeljuješ ih ručno iz dosijea korisnika.',
}
const slugify = (value) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

function BadgeForm({ initial, onClose, onSaved }) {
  const [label, setLabel] = useState(initial?.label || '')
  const [code, setCode] = useState(initial?.code || '')
  const [codeTouched, setCodeTouched] = useState(Boolean(initial))
  const [description, setDescription] = useState(initial?.description || '')
  const [icon, setIcon] = useState(initial?.icon || 'award')
  const [color, setColor] = useState(initial?.color || BADGE_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const Icon = badgeIcon(icon)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminService.saveBadge({ code: code || slugify(label), label, description, icon, color, kind: initial?.kind || 'custom' })
      onSaved()
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm-modal-backdrop" onClick={onClose} role="presentation">
      <form className="adm-modal adm-modal-wide" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="adm-modal-head">
          <h3><Award size={18} /> {initial ? 'Uredi značku' : 'Nova značka'}</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
        </div>
        <div className="badge-form-preview">
          <span className="badge-pill badge-colored badge-lg" style={{ '--badge-color': color }}><Icon size={15} /> {label || 'Naziv značke'}</span>
        </div>
        <div className="badge-form-grid">
          <label className="account-field"><span>Naziv*</span><input value={label} onChange={(event) => { setLabel(event.target.value); if (!codeTouched) setCode(slugify(event.target.value)) }} required maxLength={60} placeholder="npr. Majstor mjeseca" /></label>
          <label className="account-field"><span>Kod (samo slova, cifre, _)</span><input value={code} onChange={(event) => { setCodeTouched(true); setCode(slugify(event.target.value)) }} disabled={Boolean(initial)} maxLength={40} placeholder="majstor_mjeseca" /></label>
          <label className="account-field account-field-wide"><span>Opis (vidi ga svako na profilu)</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={160} placeholder="npr. Najbolje ocijenjen izvođač u septembru." /></label>
        </div>
        <span className="adm-label">Ikona</span>
        <div className="badge-icon-grid">
          {Object.entries(BADGE_ICONS).map(([name, IconOption]) => (
            <button key={name} type="button" className={icon === name ? 'active' : ''} onClick={() => setIcon(name)} title={name} style={{ '--badge-color': color }}><IconOption size={18} /></button>
          ))}
        </div>
        <span className="adm-label">Boja</span>
        <div className="badge-color-row">
          {BADGE_COLORS.map((option) => <button key={option} type="button" className={color === option ? 'active' : ''} style={{ background: option }} onClick={() => setColor(option)} aria-label={option} />)}
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Vlastita boja" />
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="adm-modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Odustani</button>
          <button type="submit" className="primary-button" disabled={busy || label.trim().length < 2}>{busy ? 'Čuvam…' : 'Sačuvaj značku'}</button>
        </div>
      </form>
    </div>
  )
}

/** Quick grant: find a user, pick a badge. */
function QuickGrant({ catalog, onDone }) {
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState([])
  const [picked, setPicked] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const search = async (event) => {
    event.preventDefault()
    if (term.trim().length < 2) return
    setError('')
    try { setRows(await adminService.listUsers({ term: term.trim(), limit: 6 })) } catch (requestError) { setError(requestError.message) }
  }

  const grant = async () => {
    if (!picked || !code) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await adminService.grantBadge(picked.user_id, code)
      setMessage(`Značka je dodijeljena: ${picked.full_name}.`)
      onDone()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dossier-card">
      <h3><Plus size={16} /> Brzo dodijeli značku</h3>
      <form className="admin-search" onSubmit={search}>
        <Search size={16} />
        <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Ime, PB-ID ili email korisnika" />
        <button type="submit" className="primary-button">Traži</button>
      </form>
      {rows.length > 0 && !picked && rows.map((row) => (
        <button key={row.user_id} type="button" className="team-member adm-pick" onClick={() => setPicked(row)}>
          <Avatar src={row.avatar_url} size={32} />
          <div className="team-member-main"><div className="team-member-title"><strong>{row.full_name}</strong> <span className="uid-chip">{row.member_id}</span></div><span className="muted-text">{row.email || row.city || ''}</span></div>
        </button>
      ))}
      {picked && (
        <div className="badge-grant-row">
          <span><strong>{picked.full_name}</strong> <span className="uid-chip">{picked.member_id}</span> <button type="button" className="icon-button" onClick={() => setPicked(null)} aria-label="Promijeni"><X size={14} /></button></span>
          <select value={code} onChange={(event) => setCode(event.target.value)}>
            <option value="">— odaberi značku —</option>
            {catalog.map((badge) => <option key={badge.code} value={badge.code}>{badge.label}</option>)}
          </select>
          <button type="button" className="primary-button" onClick={grant} disabled={busy || !code}>{busy ? '…' : 'Dodijeli'}</button>
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}
    </section>
  )
}

/** Badge catalogue: what exists, who holds it, create / edit / delete custom ones. */
function BadgesTab() {
  const [catalog, setCatalog] = useState([])
  const [editing, setEditing] = useState(null) // null | 'new' | badge
  const [error, setError] = useState('')

  const load = () => adminService.badgeCatalog().then(setCatalog).catch((requestError) => setError(requestError.message))
  useEffect(() => { load() }, [])

  const remove = async (badge) => {
    if (!window.confirm(`Obrisati značku „${badge.label}“? Uklanja se sa ${badge.holders} profila.`)) return
    try { await adminService.deleteBadge(badge.code); load() } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="admin-table">
      {error && <div className="form-error">{error}</div>}
      <div className="team-grid">
        <QuickGrant catalog={catalog} onDone={load} />
        <section className="dossier-card">
          <h3><Award size={16} /> Nova značka</h3>
          <p className="muted-text">Napravi vlastitu značku (npr. „Majstor mjeseca“, „Partner Poso.ba“) i dodjeljuj je ručno iz dosijea korisnika. Vidi se na javnom profilu oko avatara i u listi značaka.</p>
          <button type="button" className="primary-button" onClick={() => setEditing('new')}><Plus size={15} /> Napravi značku</button>
        </section>
      </div>

      {['identity', 'licence', 'activity', 'custom'].map((kind) => {
        const items = catalog.filter((badge) => badge.kind === kind)
        return (
          <section key={kind} className="dossier-card">
            <h3>{KIND_TITLE[kind]} ({items.length})</h3>
            <p className="muted-text">{KIND_HINT[kind]}</p>
            {items.length === 0 && <p className="muted-text">Još nema značaka u ovoj grupi.</p>}
            <div className="badge-catalog">
              {items.map((badge) => {
                const Icon = badgeIcon(badge.icon)
                return (
                  <div key={badge.code} className="badge-card" style={badge.color ? { '--badge-color': badge.color } : undefined}>
                    <span className="badge-card-icon"><Icon size={20} /></span>
                    <div className="badge-card-text">
                      <strong>{badge.label}</strong>
                      <small>{badge.description}</small>
                      <code>{badge.code}</code>
                    </div>
                    <div className="badge-card-side">
                      <span className="pill pill-soft">{badge.holders} {Number(badge.holders) === 1 ? 'korisnik' : 'korisnika'}</span>
                      <div className="admin-row-actions">
                        <button type="button" className="icon-button" title="Uredi" onClick={() => setEditing(badge)}><Pencil size={14} /></button>
                        {kind === 'custom' && <button type="button" className="icon-button" title="Obriši" onClick={() => remove(badge)}><Trash2 size={14} /></button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {editing && <BadgeForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  )
}

export default BadgesTab
