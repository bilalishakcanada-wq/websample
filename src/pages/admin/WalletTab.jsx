import { useEffect, useState } from 'react'
import { AlertTriangle, Coins, Lock, Search, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { adminService } from '../../services/adminService'
import { paymentService } from '../../services/paymentService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { Avatar, CreditsDialog, WALLET_KIND_LABEL, formatKM, useStaff } from './shared'

/** Platform-wide balances: totals, quick top-up, top balances and the ledger. */
function WalletTab() {
  const { openUser } = useStaff()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [term, setTerm] = useState('')
  const [candidates, setCandidates] = useState([])
  const [picked, setPicked] = useState(null)
  const [message, setMessage] = useState('')
  const [jobs, setJobs] = useState(null)

  const load = () => Promise.all([
    adminService.walletOverview(150).then(setData),
    paymentService.adminOverview(150).then(setJobs),
  ]).catch((requestError) => setError(requestError.message))

  const resolve = async (row, action) => {
    let share = null
    if (action === 'split') {
      const answer = window.prompt(`Koliko KM ide izvođaču (od ${row.amount} KM)? Ostatak se vraća klijentu.`, String(Math.round(row.amount / 2)))
      if (answer === null) return
      share = Number(answer.replace(',', '.'))
      if (!(share >= 0 && share <= Number(row.amount))) { setError('Iznos mora biti između 0 i cijene posla.'); return }
    } else if (!window.confirm(action === 'release' ? `Osloboditi ${row.amount} KM izvođaču ${row.provider_name}?` : `Vratiti ${row.amount} KM klijentu ${row.client_name}?`)) return
    const note = window.prompt('Kratka odluka (vide je obje strane):', action === 'release' ? 'Tim: posao je urađen, isplata izvođaču' : action === 'refund' ? 'Tim: posao nije urađen, povrat klijentu' : 'Tim: podjela iznosa') || null
    setError('')
    try { await paymentService.adminResolve(row.listing_id, action, share, note); setMessage('Spor je riješen.'); load() } catch (requestError) { setError(requestError.message) }
  }
  useEffect(() => { load() }, [])

  const search = async (event) => {
    event.preventDefault()
    if (term.trim().length < 2) return
    setError('')
    try { setCandidates(await adminService.listUsers({ term: term.trim(), limit: 6 })) } catch (requestError) { setError(requestError.message) }
  }

  if (!data && !error) return <div className="page-state">Učitavanje balansa...</div>

  return (
    <div className="admin-table">
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {data && (
        <div className="wallet-kpis">
          <div className="wallet-kpi main"><Coins size={18} /><strong>{formatKM(data.total_balance)}</strong><span>ukupno na balansima korisnika</span></div>
          <div className="wallet-kpi"><Users size={18} /><strong>{data.accounts_with_credit}</strong><span>naloga sa balansom</span></div>
          <div className="wallet-kpi"><TrendingUp size={18} /><strong>{formatKM(data.credited_30d)}</strong><span>uplaćeno u 30 dana</span></div>
          <div className="wallet-kpi"><TrendingDown size={18} /><strong>{formatKM(data.spent_30d)}</strong><span>skinuto u 30 dana</span></div>
        </div>
      )}

      <div className="team-grid">
        <section className="dossier-card">
          <h3><Coins size={16} /> Uplati na balans korisnika</h3>
          <form className="admin-search" onSubmit={search}>
            <Search size={16} />
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Ime, PB-ID ili email korisnika" />
            <button type="submit" className="primary-button">Traži</button>
          </form>
          {candidates.map((row) => (
            <button key={row.user_id} type="button" className="team-member adm-pick" onClick={() => setPicked(row)}>
              <Avatar src={row.avatar_url} size={34} />
              <div className="team-member-main">
                <div className="team-member-title"><strong>{row.full_name}</strong> <span className="uid-chip">{row.member_id}</span></div>
                <span className="muted-text">{row.email || row.city || ''}</span>
              </div>
              <span className="pill pill-soft">Odaberi</span>
            </button>
          ))}
          {candidates.length === 0 && <p className="muted-text">Pronađi korisnika, odaberi ga i upiši iznos. Korisnik odmah dobije obavijest.</p>}
        </section>

        <section className="dossier-card">
          <h3>Najveći balansi</h3>
          {(data?.top || []).length === 0 && <p className="muted-text">Niko još nema novca na balansu.</p>}
          {(data?.top || []).map((row) => (
            <div key={row.user_id} className="team-member">
              <Avatar src={row.avatar_url} size={32} />
              <div className="team-member-main">
                <div className="team-member-title"><button type="button" className="adm-userlink" onClick={() => openUser(row.user_id)}><strong>{row.full_name}</strong></button> <span className="uid-chip">{row.member_id}</span></div>
              </div>
              <b className="wallet-top-amount">{formatKM(row.balance)}</b>
            </div>
          ))}
        </section>
      </div>

      {jobs && (
        <section className="dossier-card">
          <h3><Lock size={16} /> Poso.ba Pay — osigurane uplate</h3>
          <div className="wallet-kpis">
            <div className="wallet-kpi main"><Lock size={18} /><strong>{formatKM(jobs.held)}</strong><span>trenutno osigurano (escrow)</span></div>
            <div className="wallet-kpi"><AlertTriangle size={18} /><strong>{jobs.disputed}</strong><span>otvorenih sporova</span></div>
            <div className="wallet-kpi"><TrendingUp size={18} /><strong>{formatKM(jobs.released_30d)}</strong><span>isplaćeno u 30 dana</span></div>
            <div className="wallet-kpi"><Coins size={18} /><strong>{formatKM(jobs.fees_30d)}</strong><span>naknade platforme · 30 d (ukupno {formatKM(jobs.fees_total)})</span></div>
          </div>
          {(jobs.rows || []).length === 0 && <p className="muted-text">Još nema plaćanja kroz platformu.</p>}
          {(jobs.rows || []).map((row) => (
            <div key={row.id} className={`wallet-row pay-admin-row ${row.status === 'disputed' ? 'is-disputed' : ''}`}>
              <span className={`wallet-sign ${row.status === 'released' ? 'plus' : row.status === 'disputed' ? 'minus' : ''}`}><Lock size={15} /></span>
              <div>
                <strong><a href={`/listings/${row.listing_id}`} target="_blank" rel="noreferrer">{row.title}</a> <span className={`pill pay-status-${row.status}`}>{{ funded: 'Osigurano', requested: 'Čeka oslobađanje', released: 'Isplaćeno', refunded: 'Vraćeno', disputed: 'SPOR' }[row.status]}</span></strong>
                <small>
                  klijent <button type="button" className="adm-userlink" onClick={() => openUser(row.client_id)}>{row.client_name}</button> → izvođač <button type="button" className="adm-userlink" onClick={() => openUser(row.provider_id)}>{row.provider_name}</button>
                  {' · '}naknada {row.fee_percent} % ({formatKM(row.fee_amount)}) · izvođaču {formatKM(row.net_amount)} · {formatBosnianDate(row.released_at || row.refunded_at || row.requested_at || row.funded_at)}
                </small>
                {row.status === 'disputed' && <small className="pay-dispute-text"><AlertTriangle size={12} /> {row.dispute_by === 'client' ? 'Klijent' : 'Izvođač'}: „{row.dispute_reason}“</small>}
                {row.resolution && <small>Odluka: {row.resolution}</small>}
              </div>
              <div className="pay-admin-side">
                <b>{formatKM(row.amount)}</b>
                {['disputed', 'funded', 'requested'].includes(row.status) && (
                  <div className="admin-row-actions">
                    <button type="button" className="ghost-button" onClick={() => resolve(row, 'release')}>Izvođaču</button>
                    <button type="button" className="ghost-button" onClick={() => resolve(row, 'refund')}>Klijentu</button>
                    <button type="button" className="ghost-button" onClick={() => resolve(row, 'split')}>Podijeli</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="dossier-card">
        <h3>Sve transakcije</h3>
        {(data?.transactions || []).length === 0 && <p className="muted-text">Još nema transakcija.</p>}
        {(data?.transactions || []).map((row) => (
          <div key={row.id} className="wallet-row">
            <span className={`wallet-sign ${Number(row.amount) > 0 ? 'plus' : 'minus'}`}>{Number(row.amount) > 0 ? '+' : '−'}</span>
            <div>
              <strong><button type="button" className="adm-userlink" onClick={() => openUser(row.user_id)}>{row.full_name || 'Korisnik'}</button> <span className="uid-chip">{row.member_id}</span> · {WALLET_KIND_LABEL[row.kind] || row.kind}{row.note ? ` · ${row.note}` : ''}</strong>
              <small>{formatBosnianDate(row.created_at)}{row.actor_name ? ` · ${row.actor_name}` : ''} · stanje nakon: {formatKM(row.balance_after)}</small>
            </div>
            <b className={Number(row.amount) > 0 ? 'plus' : 'minus'}>{Number(row.amount) > 0 ? '+' : ''}{formatKM(row.amount)}</b>
          </div>
        ))}
      </section>

      {picked && (
        <CreditsDialog
          user={picked}
          balance={picked.balance ?? 0}
          onClose={() => setPicked(null)}
          onDone={() => { setMessage(`Balans je ažuriran za ${picked.full_name}.`); setCandidates([]); setTerm(''); load() }}
        />
      )}
    </div>
  )
}

export default WalletTab
