import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Award, Bot, Check, Coins, ExternalLink, Globe, MapPin, MessageSquare, NotebookPen, ShieldBan, ShieldCheck, Trash2, UserCog, X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { adminService } from '../../services/adminService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { badgeIcon } from '../../components/badgeIcons'
import {
import { withBase } from '../../utils/paths'
  ACTION_LABEL, AiVerdict, Avatar, CreditsDialog, KIND_LABEL, RolePills, STAFF_ACTION_LABEL, StatusPill, SuspendDialog, WALLET_KIND_LABEL, deviceLabel, formatKM as formatMoney, geoLabel, relativeTime, useStaff, verificationTitle,
} from './shared'

const ACCOUNT_TYPE = { client: 'Klijent', provider: 'Izvođač', both: 'Klijent i izvođač' }
const KIND_ICON = { message: '💬', listing: '📋', bid: '💰', review: '⭐', profile: '👤', moderation: '🛡️', report: '🚩', login: '🔑' }
const formatKM = (value) => `${Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} KM`

function Stat({ label, value, hint }) {
  return <div className="dossier-stat"><strong>{value ?? '—'}</strong><span>{label}</span>{hint && <small>{hint}</small>}</div>
}

function Row({ label, children }) {
  return <div className="dossier-kv"><span>{label}</span><div>{children ?? '—'}</div></div>
}

/** Badge checklist for one user — admin only. */
function BadgeManager({ userId, held, onClose, onChanged }) {
  const [catalog, setCatalog] = useState([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const heldCodes = useMemo(() => new Set(held.map((badge) => badge.code)), [held])

  useEffect(() => { adminService.badgeCatalog().then(setCatalog).catch((requestError) => setError(requestError.message)) }, [])

  const toggle = async (badge) => {
    setBusy(badge.code)
    setError('')
    try {
      if (heldCodes.has(badge.code)) await adminService.revokeBadge(userId, badge.code)
      else await adminService.grantBadge(userId, badge.code, note)
      await onChanged()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  const groups = [['identity', 'Identitet'], ['licence', 'Licence'], ['activity', 'Aktivnost'], ['custom', 'Prilagođene']]

  return (
    <div className="adm-modal-backdrop" onClick={onClose} role="presentation">
      <div className="adm-modal adm-modal-wide" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="adm-modal-head">
          <h3><Award size={18} /> Značke korisnika</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
        </div>
        <p className="muted-text">Klik dodaje ili uklanja značku. Ručno dodane značke automatika nikad ne uklanja.</p>
        <input className="adm-filter" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Napomena uz dodjelu (opciono, vidi je samo tim)" maxLength={200} />
        {error && <div className="form-error">{error}</div>}
        {groups.map(([kind, title]) => {
          const items = catalog.filter((badge) => badge.kind === kind)
          if (items.length === 0) return null
          return (
            <div key={kind} className="badge-manager-group">
              <h4>{title}</h4>
              <div className="badge-manager-grid">
                {items.map((badge) => {
                  const Icon = badgeIcon(badge.icon)
                  const active = heldCodes.has(badge.code)
                  return (
                    <button key={badge.code} type="button" className={`badge-manager-item ${active ? 'active' : ''}`} onClick={() => toggle(badge)} disabled={busy === badge.code} style={badge.color ? { '--badge-color': badge.color } : undefined}>
                      <span className="badge-manager-icon"><Icon size={16} /></span>
                      <span className="badge-manager-text"><strong>{badge.label}</strong><small>{badge.description}</small></span>
                      <span className="badge-manager-check">{active ? <Check size={16} /> : '+'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Sessions({ dossier }) {
  const [geo, setGeo] = useState({})
  const sessions = dossier.sessions || []
  useEffect(() => {
    const ips = [...sessions.map((session) => session.ip), ...(dossier.active_sessions || []).map((session) => session.ip)]
    adminService.geoLookup(ips).then(setGeo)
  }, [dossier]) // eslint-disable-line react-hooks/exhaustive-deps

  const ipSummary = useMemo(() => {
    const map = new Map()
    for (const session of sessions) {
      if (!session.ip) continue
      const entry = map.get(session.ip) || { ip: session.ip, count: 0, last: session.created_at }
      entry.count += 1
      map.set(session.ip, entry)
    }
    return [...map.values()]
  }, [sessions])

  return (
    <div className="dossier-grid">
      <section className="dossier-card dossier-card-wide">
        <h3><Globe size={16} /> IP adrese ({ipSummary.length})</h3>
        {ipSummary.length === 0 && <p className="muted-text">Nema zabilježenih prijava — bilježe se od uvođenja dnevnika sesija.</p>}
        <div className="dossier-ips">
          {ipSummary.map((entry) => (
            <div key={entry.ip} className="dossier-ip">
              <code>{entry.ip}</code>
              <span><MapPin size={12} /> {geoLabel(geo[entry.ip]) || 'lokacija se traži…'}{geo[entry.ip]?.isp ? ` · ${geo[entry.ip].isp}` : ''}</span>
              <small>{entry.count}× · zadnje {relativeTime(entry.last)}</small>
            </div>
          ))}
        </div>
        <p className="muted-text dossier-note">Lokacija je približna (po IP adresi, tačnost na nivou grada) i služi samo za otkrivanje zloupotreba.</p>
      </section>

      {(dossier.shared_ips || []).length > 0 && (
        <section className="dossier-card dossier-card-wide dossier-card-warn">
          <h3><ShieldBan size={16} /> Iste IP adrese koriste i drugi nalozi</h3>
          <p className="muted-text">Može značiti isti uređaj, porodicu ili zaobilaženje suspenzije — provjeri prije odluke.</p>
          {(dossier.shared_ips || []).map((row) => (
            <div key={`${row.ip}-${row.user_id}`} className="admin-mini-row">
              <span><code>{row.ip}</code> → <SharedUser row={row} /></span>
              <StatusPill status={row.account_status} />
            </div>
          ))}
        </section>
      )}

      <section className="dossier-card">
        <h3>Aktivne sesije ({(dossier.active_sessions || []).length})</h3>
        {(dossier.active_sessions || []).length === 0 && <p className="muted-text">Trenutno nije prijavljen.</p>}
        {(dossier.active_sessions || []).map((session, index) => (
          <div key={index} className="admin-mini-row">
            <span>{deviceLabel(session.user_agent)} · <code>{session.ip}</code></span>
            <small>aktivna {relativeTime(session.refreshed_at || session.created_at)}</small>
          </div>
        ))}
      </section>

      <section className="dossier-card">
        <h3>Historija prijava ({sessions.length})</h3>
        {sessions.slice(0, 30).map((session) => (
          <div key={session.id} className="admin-mini-row">
            <span>{formatBosnianDate(session.created_at)} · <code>{session.ip || '—'}</code></span>
            <small>{deviceLabel(session.user_agent)}</small>
          </div>
        ))}
      </section>
    </div>
  )
}

function SharedUser({ row }) {
  const { openUser } = useStaff()
  return <button type="button" className="adm-userlink" onClick={() => openUser(row.user_id)}>{row.full_name || 'Korisnik'} <span className="uid-chip">{row.member_id}</span></button>
}

function Conversations({ dossier, isAdmin }) {
  const { openUser } = useStaff()
  const [activeId, setActiveId] = useState('')
  const [thread, setThread] = useState([])
  const [error, setError] = useState('')
  const conversations = dossier.conversations || []

  const open = async (id) => {
    if (!isAdmin) return
    setActiveId(id)
    try { setThread(await adminService.conversationMessages(id)) } catch (requestError) { setError(requestError.message) }
  }

  const active = conversations.find((item) => item.id === activeId)

  return (
    <div className="dossier-grid">
      <section className="dossier-card dossier-card-wide">
        <h3><MessageSquare size={16} /> Razgovori ({conversations.length}) · poslao {dossier.stats?.messages_sent} poruka</h3>
        {conversations.length === 0 && <p className="muted-text">Nema razgovora.</p>}
        {!isAdmin && conversations.length > 0 && <p className="muted-text">Sadržaj poruka može otvoriti samo administrator.</p>}
        {conversations.map((conversation) => (
          <div key={conversation.id} className={`admin-row dossier-conv ${activeId === conversation.id ? 'active' : ''}`}>
            <div>
              <strong>sa </strong>
              <button type="button" className="adm-userlink" onClick={() => openUser(conversation.partner_id)}><strong>{conversation.partner_name || 'Korisnik'}</strong> <span className="uid-chip">{conversation.partner_member}</span></button>
              <p className="muted-text">{conversation.listing_title ? `${conversation.listing_title} · ` : ''}{conversation.message_count} poruka ({conversation.sent_by_user} njegovih) · zadnja {relativeTime(conversation.last_at)}</p>
              {conversation.last_message && <p className="admin-snippet">{conversation.last_message}</p>}
            </div>
            {isAdmin && <div className="admin-row-actions"><button type="button" className="ghost-button" onClick={() => open(conversation.id)}>{activeId === conversation.id ? 'Otvoreno' : 'Otvori'}</button></div>}
          </div>
        ))}
      </section>
      {active && (
        <section className="dossier-card dossier-card-wide">
          <h3>Razgovor sa {active.partner_name}</h3>
          {error && <div className="form-error">{error}</div>}
          <div className="support-chat-messages admin-messages">
            {thread.map((item) => (
              <div key={item.id} className={`support-bubble ${item.sender_id === dossier.profile.user_id ? 'from-admin' : 'from-user'}`}>
                <small>{item.sender_id === dossier.profile.user_id ? dossier.profile.full_name : active.partner_name} · {formatBosnianDate(item.created_at)}</small>
                {item.content}
                <button type="button" className="bubble-remove" title="Ukloni poruku" onClick={async () => { try { await adminService.redact('message', item.id, 'Uklonio Poso.ba tim'); setThread(await adminService.conversationMessages(active.id)) } catch (requestError) { setError(requestError.message) } }}>×</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Activity({ userId, dossier }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { adminService.activityFeed({ userId, limit: 120 }).then(setRows).catch(() => setRows([])) }, [userId])
  return (
    <div className="dossier-grid">
      <section className="dossier-card dossier-card-wide">
        <h3>Vremenska linija</h3>
        {rows === null && <div className="page-state">Učitavanje…</div>}
        {rows?.length === 0 && <p className="muted-text">Još nema aktivnosti.</p>}
        <div className="dossier-timeline">
          {(rows || []).map((row) => (
            <div key={`${row.kind}-${row.id}`} className="dossier-event">
              <span className="dossier-event-icon">{KIND_ICON[row.kind] || '•'}</span>
              <div>
                <strong>{row.title}</strong>{row.status && <span className={`tag tag-${row.status}`}>{row.status}</span>}
                {row.body && <p className="admin-snippet">{row.body}</p>}
              </div>
              <small>{formatBosnianDate(row.created_at)}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="dossier-card">
        <h3>Oglasi ({dossier.stats?.listings})</h3>
        {(dossier.listings || []).length === 0 && <p className="muted-text">Nema oglasa.</p>}
        {(dossier.listings || []).map((item) => <div key={item.id} className="admin-mini-row"><a href={withBase(`/listings/${item.id}`)} target="_blank" rel="noreferrer">{item.title}</a><span className={`tag tag-${item.status}`}>{item.status}</span></div>)}
      </section>
      <section className="dossier-card">
        <h3>Ponude ({dossier.stats?.bids})</h3>
        {(dossier.bids || []).length === 0 && <p className="muted-text">Nema ponuda.</p>}
        {(dossier.bids || []).map((item) => <div key={item.id} className="admin-mini-row"><span>{item.amount} KM — {item.listing_title || item.message}</span><span className={`tag tag-${item.status}`}>{item.status}</span></div>)}
      </section>
      <section className="dossier-card">
        <h3>Recenzije dobio ({dossier.stats?.reviews_received})</h3>
        {(dossier.reviews_received || []).length === 0 && <p className="muted-text">Nema recenzija.</p>}
        {(dossier.reviews_received || []).map((item) => <div key={item.id} className="admin-mini-row"><span>⭐ {item.rating} · {item.from_name}: {item.comment}</span><small>{formatBosnianDate(item.created_at)}</small></div>)}
      </section>
      <section className="dossier-card">
        <h3>Recenzije dao ({dossier.stats?.reviews_given})</h3>
        {(dossier.reviews_given || []).length === 0 && <p className="muted-text">Nema recenzija.</p>}
        {(dossier.reviews_given || []).map((item) => <div key={item.id} className="admin-mini-row"><span>⭐ {item.rating} · za {item.to_name}: {item.comment}</span><small>{formatBosnianDate(item.created_at)}</small></div>)}
      </section>
      <section className="dossier-card dossier-card-wide">
        <h3>Podrška ({dossier.stats?.support_messages} poruka)</h3>
        {(dossier.support || []).length === 0 && <p className="muted-text">Nije pisao podršci.</p>}
        {(dossier.support || []).map((item) => <div key={item.id} className="admin-mini-row"><span>[{item.sender === 'admin' ? 'tim' : item.sender === 'assistant' ? 'asistent' : 'korisnik'}] {item.message}</span><small>{formatBosnianDate(item.created_at)}</small></div>)}
      </section>
    </div>
  )
}

function Safety({ dossier }) {
  return (
    <div className="dossier-grid">
      <section className="dossier-card dossier-card-wide">
        <h3><ShieldCheck size={16} /> Pravilo #1 i moderacija ({dossier.stats?.strikes_total} kršenja ukupno, {dossier.stats?.strikes_30d} u 30 dana)</h3>
        {(dossier.moderation || []).length === 0 && <p className="muted-text">Čist dosije — nema kršenja.</p>}
        {(dossier.moderation || []).map((event) => (
          <div key={event.id} className={`admin-mini-row ${event.dismissed ? 'is-dismissed' : ''}`}>
            <span><span className={`tag tag-${event.action}`}>{ACTION_LABEL[event.action] || event.action}</span> {event.source_table}{event.kinds?.length ? ` · ${event.kinds.map((kind) => KIND_LABEL[kind] || kind).join(', ')}` : ''}{event.snippet ? ` — ${event.snippet}` : ''}</span>
            <small>{formatBosnianDate(event.created_at)}</small>
          </div>
        ))}
      </section>
      <section className="dossier-card">
        <h3>Prijave protiv njega ({dossier.stats?.reports_against})</h3>
        {(dossier.reports_against || []).length === 0 && <p className="muted-text">Niko ga nije prijavio.</p>}
        {(dossier.reports_against || []).map((item) => <div key={item.id} className="admin-mini-row"><span>{item.target_type}: {item.reason} <small>({item.reporter_name})</small></span><span className={`tag tag-${item.status}`}>{item.status}</span></div>)}
      </section>
      <section className="dossier-card">
        <h3>Prijave koje je poslao ({dossier.stats?.reports_made})</h3>
        {(dossier.reports_made || []).length === 0 && <p className="muted-text">Nema prijava.</p>}
        {(dossier.reports_made || []).map((item) => <div key={item.id} className="admin-mini-row"><span>{item.target_type}: {item.reason}</span><span className={`tag tag-${item.status}`}>{item.status}</span></div>)}
      </section>
    </div>
  )
}

function Verifications({ dossier, isAdmin, reload }) {
  const [error, setError] = useState('')
  const act = async (id, status) => {
    try { await adminService.setVerificationStatus(id, status); await reload() } catch (requestError) { setError(requestError.message) }
  }
  return (
    <div className="dossier-grid">
      <section className="dossier-card dossier-card-wide">
        <h3>Zahtjevi za verifikaciju ({(dossier.verifications || []).length})</h3>
        {error && <div className="form-error">{error}</div>}
        {(dossier.verifications || []).length === 0 && <p className="muted-text">Nije slao dokumente.</p>}
        {(dossier.verifications || []).map((request) => (
          <div key={request.id} className="admin-row">
            <div>
              <strong>{verificationTitle(request)}</strong>
              <p className="muted-text">{formatBosnianDate(request.created_at)}{request.document_url && <> · <a href={request.document_url} target="_blank" rel="noreferrer" className="text-link">Pogledaj dokument</a></>}</p>
            </div>
            <span className={`tag status-tag-${request.status}`}>{request.status}</span>
            {isAdmin && request.status === 'pending' && (
              <div className="admin-row-actions">
                <button type="button" className="ghost-button" onClick={() => act(request.id, 'approved')}>Odobri</button>
                <button type="button" className="ghost-button danger-button" onClick={() => act(request.id, 'rejected')}>Odbij</button>
              </div>
            )}
          </div>
        ))}
      </section>
      <section className="dossier-card dossier-card-wide">
        <h3>Značke ({(dossier.badges || []).length})</h3>
        {(dossier.badges || []).length === 0 && <p className="muted-text">Nema značaka.</p>}
        {(dossier.badges || []).map((badge) => {
          const Icon = badgeIcon(badge.icon)
          return <div key={badge.code} className="admin-mini-row"><span><Icon size={14} /> {badge.label} {badge.manual && <span className="tag">ručno{badge.note ? ` · ${badge.note}` : ''}</span>}</span><small>{formatBosnianDate(badge.awarded_at)}</small></div>
        })}
      </section>
    </div>
  )
}

function Wallet({ dossier, isAdmin, onAdjust }) {
  const rows = dossier.wallet || []
  const credited = rows.filter((row) => Number(row.amount) > 0).reduce((sum, row) => sum + Number(row.amount), 0)
  const spent = rows.filter((row) => Number(row.amount) < 0).reduce((sum, row) => sum - Number(row.amount), 0)
  return (
    <div className="dossier-grid">
      <section className="dossier-card dossier-card-wide wallet-hero">
        <div>
          <small>Balans (stanje računa)</small>
          <strong>{formatMoney(dossier.profile.balance)}</strong>
          <span className="muted-text">uplaćeno ukupno {formatMoney(credited)} · skinuto {formatMoney(spent)} · {rows.length} transakcija</span>
        </div>
        {isAdmin && <button type="button" className="primary-button" onClick={onAdjust}><Coins size={15} /> Uplati / skini</button>}
      </section>
      <section className="dossier-card dossier-card-wide">
        <h3>Transakcije</h3>
        {rows.length === 0 && <p className="muted-text">Još nema transakcija.</p>}
        {rows.map((row) => (
          <div key={row.id} className="wallet-row">
            <span className={`wallet-sign ${Number(row.amount) > 0 ? 'plus' : 'minus'}`}>{Number(row.amount) > 0 ? '+' : '−'}</span>
            <div>
              <strong>{WALLET_KIND_LABEL[row.kind] || row.kind}{row.note ? ` · ${row.note}` : ''}</strong>
              <small>{formatBosnianDate(row.created_at)}{row.actor_name ? ` · ${row.actor_name}` : ''} · stanje nakon: {formatMoney(row.balance_after)}</small>
            </div>
            <b className={Number(row.amount) > 0 ? 'plus' : 'minus'}>{Number(row.amount) > 0 ? '+' : ''}{formatMoney(row.amount)}</b>
          </div>
        ))}
      </section>
    </div>
  )
}

function Notes({ dossier, reload }) {
  const { user } = useAuth()
  const { isAdmin } = useStaff()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const add = async (event) => {
    event.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError('')
    try { await adminService.addNote(dossier.profile.user_id, body); setBody(''); await reload() } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  return (
    <div className="dossier-grid">
      <section className="dossier-card dossier-card-wide">
        <h3><NotebookPen size={16} /> Bilješke tima</h3>
        <form className="dossier-note-form" onSubmit={add}>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={2} maxLength={2000} placeholder="Interna bilješka — korisnik je nikad ne vidi" />
          <button type="submit" className="primary-button" disabled={busy || !body.trim()}>{busy ? 'Čuvam…' : 'Dodaj bilješku'}</button>
        </form>
        {error && <div className="form-error">{error}</div>}
        {(dossier.notes || []).length === 0 && <p className="muted-text">Nema bilješki.</p>}
        {(dossier.notes || []).map((note) => (
          <div key={note.id} className="dossier-note">
            <p>{note.body}</p>
            <small>{note.author_name || 'Tim'} · {formatBosnianDate(note.created_at)}</small>
            {(isAdmin || note.author_id === user.id) && <button type="button" className="icon-button" title="Obriši" onClick={async () => { await adminService.deleteNote(note.id); reload() }}><Trash2 size={14} /></button>}
          </div>
        ))}
      </section>
      <section className="dossier-card dossier-card-wide">
        <h3>Radnje tima nad ovim nalogom</h3>
        {(dossier.staff_actions || []).length === 0 && <p className="muted-text">Tim još nije djelovao na ovaj nalog.</p>}
        {(dossier.staff_actions || []).map((action) => (
          <div key={action.id} className="admin-mini-row">
            <span><strong>{STAFF_ACTION_LABEL[action.action] || action.action}</strong> — {action.actor_name || 'tim'}{action.details?.reason ? ` · ${action.details.reason}` : ''}{action.details?.code ? ` · ${action.details.code}` : ''}{action.details?.hours != null ? ` · ${action.details.hours} h` : action.action === 'suspend' ? ' · trajno' : ''}</span>
            <small>{formatBosnianDate(action.created_at)}</small>
          </div>
        ))}
      </section>
    </div>
  )
}

function Overview({ dossier, onRunAgent, agentBusy }) {
  const { profile, auth, stats, trust, payout } = dossier
  const isAdmin = dossier.viewer_is_admin
  return (
    <>
      <div className="dossier-stats">
        <Stat label="Oglasi" value={stats.listings} hint={`${stats.listings_published} aktivnih · ${stats.listings_completed} završenih`} />
        <Stat label="Ponude" value={stats.bids} hint={`${stats.bids_accepted} prihvaćeno`} />
        <Stat label="Završeni poslovi" value={stats.jobs_completed} hint={trust?.success_rate != null ? `${trust.success_rate}% uspješnost` : 'kao izvođač'} />
        <Stat label="Zarada 30 dana" value={formatKM(stats.earnings_30d)} />
        <Stat label="Poruke" value={stats.messages_sent} hint={`${stats.conversations} razgovora`} />
        <Stat label="Ocjena" value={stats.avg_rating ?? '—'} hint={`${stats.reviews_received} recenzija · dao ${stats.reviews_given}`} />
        <Stat label="Kršenja" value={stats.strikes_total} hint={`${stats.strikes_30d} u 30 dana · ${stats.suspensions} suspenzija`} />
        <Stat label="Prijave" value={stats.reports_against} hint={`protiv njega · poslao ${stats.reports_made}`} />
        <Stat label="Prijave na nalog" value={stats.logins} hint={`${stats.distinct_ips} IP adresa`} />
        <Stat label="Portfolio" value={stats.portfolio} />
        <Stat label="Balans" value={formatMoney(profile.balance)} hint="stanje računa" />
      </div>

      <div className="dossier-grid">
        <section className="dossier-card">
          <h3>Identitet</h3>
          <Row label="Puno ime">{profile.full_name} <span className="muted-text">(javno: {profile.display_name})</span></Row>
          <Row label="Privatni ID"><code>{profile.member_id}</code></Row>
          {isAdmin && <Row label="Email">{profile.email} {auth?.email_confirmed_at ? <span className="pill pill-ok">potvrđen</span> : <span className="pill">nepotvrđen</span>}</Row>}
          {isAdmin && <Row label="Telefon">{profile.phone || '—'} {profile.phone_verified_at ? <span className="pill pill-ok">verifikovan</span> : null}</Row>}
          {!isAdmin && <Row label="Telefon">{profile.phone_verified_at ? <span className="pill pill-ok">verifikovan</span> : <span className="pill">nije verifikovan</span>}</Row>}
          {isAdmin && <Row label="Datum rođenja">{profile.birth_date ? formatBosnianDate(profile.birth_date) : '—'}</Row>}
          {isAdmin && <Row label="JMBG / JIB">{profile.tax_id_masked ? <code>{profile.tax_id_masked}</code> : '—'}</Row>}
          <Row label="Grad">{profile.city || '—'}</Row>
          <Row label="Tip naloga">{ACCOUNT_TYPE[profile.account_type] || profile.account_type}</Row>
          <Row label="Prijava putem">{(auth?.providers || []).join(', ') || 'email'}</Row>
          <Row label="Registrovan">{formatBosnianDate(profile.created_at)}</Row>
          <Row label="Zadnja prijava">{auth?.last_sign_in_at ? `${formatBosnianDate(auth.last_sign_in_at)} (${relativeTime(auth.last_sign_in_at)})` : '—'}</Row>
          <Row label="Zadnji put aktivan">{relativeTime(profile.last_seen_at)}</Row>
          <Row label="Profil popunjen">{profile.onboarding_completed ? 'da' : 'ne'}</Row>
          {isAdmin && <Row label="Račun za isplate">{payout ? `${payout.iban_masked} · ${payout.bank_name || ''} (${payout.holder_name})` : 'nije dodan'}</Row>}
          {profile.trades?.length > 0 && <Row label="Struke">{profile.trades.join(', ')}</Row>}
          {profile.languages?.length > 0 && <Row label="Jezici">{profile.languages.join(', ')}</Row>}
          {profile.transportation?.length > 0 && <Row label="Prevoz">{profile.transportation.join(', ')}</Row>}
          {profile.bio && <Row label="O meni"><span className="admin-snippet">{profile.bio}</span></Row>}
        </section>

        <div className="dossier-col">
          <section className="dossier-card">
            <h3><Bot size={16} /> AI procjena povjerenja</h3>
            <AiVerdict assessment={profile.ai_assessment} assessedAt={profile.ai_assessed_at} onRun={onRunAgent} busy={agentBusy} />
          </section>
          <section className="dossier-card">
            <h3>Povjerenje na platformi</h3>
            {trust ? (
              <>
                <p><strong>{trust.label}</strong> · {trust.score}/100</p>
                <ul className="dossier-reasons">{(trust.reasons || []).map((reason) => <li key={reason}>{reason}</li>)}</ul>
              </>
            ) : <p className="muted-text">—</p>}
          </section>
          <section className="dossier-card">
            <h3>Značke ({(dossier.badges || []).length})</h3>
            {(dossier.badges || []).length === 0 && <p className="muted-text">Nema značaka.</p>}
            <div className="dossier-badges">
              {(dossier.badges || []).map((badge) => {
                const Icon = badgeIcon(badge.icon)
                return <span key={badge.code} className={`badge-pill badge-${badge.code} ${badge.color ? 'badge-colored' : ''}`} style={badge.color ? { '--badge-color': badge.color } : undefined} title={badge.description}><Icon size={13} /> {badge.label}{badge.manual ? ' ✎' : ''}</span>
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

const SECTIONS = [
  ['overview', 'Pregled'], ['activity', 'Aktivnost'], ['messages', 'Poruke'], ['wallet', 'Balans'], ['sessions', 'Sesije i IP'], ['safety', 'Pravilo #1'], ['verifications', 'Verifikacije'], ['notes', 'Bilješke'],
]

/** Full per-user view for staff. */
function UserDossier({ userId, onBack }) {
  const { isAdmin } = useStaff()
  const [dossier, setDossier] = useState(null)
  const [section, setSection] = useState('overview')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [badgesOpen, setBadgesOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [agentBusy, setAgentBusy] = useState(false)

  const reload = async () => {
    try { setDossier(await adminService.userDossier(userId)) } catch (requestError) { setError(requestError.message) }
  }
  useEffect(() => { setDossier(null); setSection('overview'); reload() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, successText = '') => {
    setError('')
    setMessage('')
    try { await fn(); await reload(); if (successText) setMessage(successText) } catch (requestError) { setError(requestError.message) }
  }

  const runAgent = async () => {
    setAgentBusy(true)
    setError('')
    try {
      const outcome = await adminService.runTrustAgent(userId)
      if (outcome?.configured === false) setError('AI agent čeka ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).')
      await reload()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setAgentBusy(false)
    }
  }

  const changeRole = async (value) => {
    const roles = dossier.roles || []
    const current = roles.includes('ADMIN') ? 'ADMIN' : roles.includes('MODERATOR') ? 'MODERATOR' : 'MEMBER'
    if (value === current) return
    const label = { MEMBER: 'običnog člana', MODERATOR: 'moderatora', ADMIN: 'administratora' }[value]
    if (!window.confirm(`Postaviti ${dossier.profile.full_name} za ${label}?`)) return
    await run(async () => {
      if (current !== 'MEMBER') await adminService.setRole(userId, current, false)
      if (value !== 'MEMBER') await adminService.setRole(userId, value, true)
    }, 'Uloga je promijenjena.')
  }

  if (error && !dossier) return <div className="dossier"><button type="button" className="ghost-button" onClick={onBack}><ArrowLeft size={15} /> Nazad</button><div className="form-error">{error}</div></div>
  if (!dossier) return <div className="page-state">Učitavanje dosijea…</div>
  if (!dossier.profile) {
    return (
      <div className="dossier">
        <button type="button" className="ghost-button" onClick={onBack}><ArrowLeft size={15} /> Nazad</button>
        <div className="empty-state"><h2>Nalog ne postoji</h2><p>{dossier.registry ? `Obrisan ${formatBosnianDate(dossier.registry.deleted_at)} — ${dossier.registry.full_name || ''} (${dossier.registry.email || 'email skriven'}).` : 'Nema profila za ovaj ID.'}</p></div>
      </div>
    )
  }

  const { profile } = dossier
  const roleValue = (dossier.roles || []).includes('ADMIN') ? 'ADMIN' : (dossier.roles || []).includes('MODERATOR') ? 'MODERATOR' : 'MEMBER'
  const suspended = profile.account_status === 'suspended'
  const counts = { messages: dossier.stats.conversations, wallet: (dossier.wallet || []).length, sessions: dossier.stats.distinct_ips, safety: dossier.stats.strikes_total, verifications: (dossier.verifications || []).length, notes: (dossier.notes || []).length }

  return (
    <div className="dossier">
      <button type="button" className="ghost-button dossier-back" onClick={onBack}><ArrowLeft size={15} /> Svi korisnici</button>

      <header className="dossier-head">
        <Avatar src={profile.avatar_url} size={76} />
        <div className="dossier-head-main">
          <h2>{profile.full_name || 'Korisnik'} <span className="muted-text">· javno {profile.display_name}</span></h2>
          <div className="dossier-pills">
            <span className="uid-chip">{profile.member_id}</span>
            <StatusPill status={profile.account_status} until={profile.suspended_until} />
            <RolePills roles={dossier.roles} />
            <span className="pill">{ACCOUNT_TYPE[profile.account_type] || profile.account_type}</span>
            {dossier.trust?.label && <span className="pill pill-soft">{dossier.trust.label}</span>}
            {Number(profile.balance) > 0 && <span className="pill pill-gold"><Coins size={12} /> {formatMoney(profile.balance)}</span>}
            {profile.ai_assessment && <span className={`pill risk-${profile.ai_assessment.risk_level}`}>AI {profile.ai_assessment.trust_score}/100</span>}
          </div>
          <p className="muted-text">{profile.city || 'Grad nije naveden'} · registrovan {formatBosnianDate(profile.created_at)} · aktivan {relativeTime(profile.last_seen_at)}{suspended && profile.suspension_reason ? ` · ${profile.suspension_reason}` : ''}</p>
        </div>
        <div className="dossier-actions">
          {!suspended && <button type="button" className="danger-button" onClick={() => setSuspendOpen(true)}><ShieldBan size={15} /> Suspenduj</button>}
          {suspended && <button type="button" className="primary-button" onClick={() => run(() => adminService.liftSuspension(userId), 'Suspenzija je ukinuta.')}><ShieldCheck size={15} /> Ukini suspenziju</button>}
          {isAdmin && <button type="button" className="ghost-button" onClick={() => setCreditsOpen(true)}><Coins size={15} /> Balans</button>}
          {isAdmin && <button type="button" className="ghost-button" onClick={() => setBadgesOpen(true)}><Award size={15} /> Značke</button>}
          {isAdmin && (
            <label className="dossier-role"><UserCog size={15} />
              <select value={roleValue} onChange={(event) => changeRole(event.target.value)}>
                <option value="MEMBER">Član</option>
                <option value="MODERATOR">Moderator</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
          )}
          <button type="button" className="ghost-button" onClick={runAgent} disabled={agentBusy}><Bot size={15} /> {agentBusy ? 'AI…' : 'AI procjena'}</button>
          <a className="ghost-button" href={withBase(`/korisnik/${userId}`)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Javni profil</a>
        </div>
      </header>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <nav className="dossier-tabs">
        {SECTIONS.map(([id, label]) => (
          <button key={id} type="button" className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{label}{counts[id] != null ? <span className="dossier-count">{counts[id]}</span> : null}</button>
        ))}
      </nav>

      {section === 'overview' && <Overview dossier={dossier} onRunAgent={runAgent} agentBusy={agentBusy} />}
      {section === 'activity' && <Activity userId={userId} dossier={dossier} />}
      {section === 'messages' && <Conversations dossier={dossier} isAdmin={isAdmin} />}
      {section === 'wallet' && <Wallet dossier={dossier} isAdmin={isAdmin} onAdjust={() => setCreditsOpen(true)} />}
      {section === 'sessions' && <Sessions dossier={dossier} />}
      {section === 'safety' && <Safety dossier={dossier} />}
      {section === 'verifications' && <Verifications dossier={dossier} isAdmin={isAdmin} reload={reload} />}
      {section === 'notes' && <Notes dossier={dossier} reload={reload} />}

      {suspendOpen && <SuspendDialog user={profile} onClose={() => setSuspendOpen(false)} onDone={() => run(async () => {}, 'Nalog je suspendovan.')} />}
      {creditsOpen && <CreditsDialog user={profile} balance={profile.balance} onClose={() => setCreditsOpen(false)} onDone={() => run(async () => {}, 'Balans je ažuriran.')} />}
      {badgesOpen && <BadgeManager userId={userId} held={dossier.badges || []} onClose={() => setBadgesOpen(false)} onChanged={reload} />}
    </div>
  )
}

export default UserDossier
