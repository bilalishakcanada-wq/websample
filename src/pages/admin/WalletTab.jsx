import { useEffect, useState } from 'react'
import { Coins, Search, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { adminService } from '../../services/adminService'
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

  const load = () => adminService.walletOverview(150).then(setData).catch((requestError) => setError(requestError.message))
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
