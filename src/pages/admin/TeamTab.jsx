import { useEffect, useState } from 'react'
import { Search, ShieldCheck, UserPlus, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { adminService } from '../../services/adminService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { Avatar, RolePills, STAFF_ACTION_LABEL, relativeTime, useStaff } from './shared'

const MOD_CAN = ['Nadzor uživo (sve što se dešava)', 'Korisnici: dosije bez privatnih podataka (nema emaila, telefona, JMBG-a, IBAN-a)', 'Suspenzija na sate/dane ili trajno, ukidanje suspenzije', 'Uklanjanje poruka, ponuda, recenzija i oglasa', 'Moderacija Pravila #1 i prijave', 'Podrška uživo (odgovaranje korisnicima)', 'Bilješke tima i AI procjena']
const MOD_CANT = ['Ne vidi sve razgovore i sadržaj poruka', 'Ne vidi ID registar ni dokumente za verifikaciju', 'Ne može dodjeljivati značke ni uloge', 'Ne može djelovati na admina ili drugog moderatora']

/** Team: who is admin / moderator, add a moderator, and the staff action log. */
function TeamTab() {
  const { user } = useAuth()
  const { openUser } = useStaff()
  const [staff, setStaff] = useState([])
  const [actions, setActions] = useState([])
  const [term, setTerm] = useState('')
  const [candidates, setCandidates] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = () => Promise.all([adminService.listStaff().then(setStaff), adminService.staffActions(80).then(setActions)]).catch((requestError) => setError(requestError.message))
  useEffect(() => { load() }, [])

  const search = async (event) => {
    event.preventDefault()
    if (term.trim().length < 2) return
    setSearching(true)
    setError('')
    try { setCandidates((await adminService.listUsers({ term: term.trim(), limit: 8 })).filter((row) => !row.roles?.length)) } catch (requestError) { setError(requestError.message) } finally { setSearching(false) }
  }

  const setRole = async (userId, role, grant, name) => {
    if (!window.confirm(grant ? `Dodati ${name} kao ${role === 'ADMIN' ? 'administratora' : 'moderatora'}?` : `Ukloniti ${role === 'ADMIN' ? 'admin' : 'moderator'} prava za ${name}?`)) return
    setError('')
    setMessage('')
    try {
      await adminService.setRole(userId, role, grant)
      setMessage(grant ? `${name} je sada ${role === 'ADMIN' ? 'administrator' : 'moderator'}.` : `Prava su uklonjena za ${name}.`)
      setCandidates([])
      setTerm('')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="admin-table">
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <div className="team-grid">
        <section className="dossier-card">
          <h3><ShieldCheck size={16} /> Tim ({staff.length})</h3>
          {staff.map((member) => (
            <div key={member.user_id} className="team-member">
              <Avatar src={member.avatar_url} size={40} />
              <div className="team-member-main">
                <div className="team-member-title">
                  <button type="button" className="adm-userlink" onClick={() => openUser(member.user_id)}><strong>{member.full_name || member.email}</strong></button>
                  <span className="uid-chip">{member.member_id}</span> <RolePills roles={member.roles} />
                </div>
                <span className="muted-text">{member.email} · u timu od {formatBosnianDate(member.joined_staff_at)} · {member.actions_30d} radnji u 30 dana · aktivan {relativeTime(member.last_seen_at)}</span>
              </div>
              {member.user_id !== user.id && (
                <div className="admin-row-actions">
                  {member.roles.includes('MODERATOR') && <button type="button" className="ghost-button danger" onClick={() => setRole(member.user_id, 'MODERATOR', false, member.full_name)}><X size={13} /> Ukloni moda</button>}
                  {member.roles.includes('ADMIN') && !member.is_owner && <button type="button" className="ghost-button danger" onClick={() => setRole(member.user_id, 'ADMIN', false, member.full_name)}><X size={13} /> Ukloni admina</button>}
                  {member.is_owner && <span className="pill pill-gold">Vlasnik</span>}
                  {!member.roles.includes('ADMIN') && <button type="button" className="ghost-button" onClick={() => setRole(member.user_id, 'ADMIN', true, member.full_name)}>Postavi za admina</button>}
                </div>
              )}
              {member.user_id === user.id && <span className="pill pill-soft">to si ti</span>}
            </div>
          ))}

          <h4 className="team-sub"><UserPlus size={15} /> Dodaj moderatora</h4>
          <form className="admin-search" onSubmit={search}>
            <Search size={16} />
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Ime, PB-ID ili email korisnika" />
            <button type="submit" className="primary-button" disabled={searching}>{searching ? '…' : 'Traži'}</button>
          </form>
          {candidates.map((row) => (
            <div key={row.user_id} className="team-member">
              <Avatar src={row.avatar_url} size={36} />
              <div className="team-member-main">
                <div className="team-member-title"><strong>{row.full_name}</strong> <span className="uid-chip">{row.member_id}</span></div>
                <span className="muted-text">{row.email} · {row.city || '—'} · registrovan {formatBosnianDate(row.created_at)}</span>
              </div>
              <div className="admin-row-actions">
                <button type="button" className="primary-button small-button" onClick={() => setRole(row.user_id, 'MODERATOR', true, row.full_name)}>Dodaj kao moderatora</button>
              </div>
            </div>
          ))}
        </section>

        <section className="dossier-card team-rules">
          <h3>Šta moderator može</h3>
          <ul>{MOD_CAN.map((item) => <li key={item}>✅ {item}</li>)}</ul>
          <h3>Šta ne može</h3>
          <ul>{MOD_CANT.map((item) => <li key={item}>⛔ {item}</li>)}</ul>
          <p className="muted-text">Moderator vidi svoj panel na <code>/mod</code> (link „Mod“ u meniju). Svaka radnja tima se bilježi ispod.</p>
        </section>
      </div>

      <section className="dossier-card">
        <h3>Dnevnik radnji tima</h3>
        {actions.length === 0 && <p className="muted-text">Još nema zabilježenih radnji.</p>}
        {actions.map((action) => (
          <div key={action.id} className="admin-mini-row">
            <span>
              <strong>{action.actor_name || 'tim'}</strong> · {STAFF_ACTION_LABEL[action.action] || action.action}
              {action.target_user_id && <> → <button type="button" className="adm-userlink" onClick={() => openUser(action.target_user_id)}>{action.target_name || 'korisnik'}</button> {action.target_member && <span className="uid-chip">{action.target_member}</span>}</>}
              {action.details?.reason ? ` · ${action.details.reason}` : ''}{action.details?.code ? ` · ${action.details.code}` : ''}{action.details?.hours != null ? ` · ${action.details.hours} h` : ''}
            </span>
            <small>{formatBosnianDate(action.created_at)}</small>
          </div>
        ))}
      </section>
    </div>
  )
}

export default TeamTab
