import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Coins, Gift, Info, Lock, Receipt, RefreshCcw, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import { accountService } from '../../services/accountService'
import { formatBosnianDate } from '../../utils/dateFormat'
import CountUp from '../../components/CountUp'

const KIND = {
  admin_credit: ['Uplata — Poso.ba tim', Gift],
  bonus: ['Bonus', Sparkles],
  promo: ['Promocija', Sparkles],
  refund: ['Povrat', RefreshCcw],
  admin_debit: ['Skidanje — Poso.ba tim', Receipt],
  fee: ['Naknada za posao', Receipt],
  purchase: ['Uplata', Receipt],
  payout: ['Isplata', ArrowUpRight],
  escrow_hold: ['Osigurana uplata za posao', Lock],
  escrow_refund: ['Povrat osigurane uplate', RefreshCcw],
  job_income: ['Zarada od posla', Coins],
}
const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`

/** The user's money on the platform: balance, what came in and out, and every transaction. */
function WalletPage() {
  const [wallet, setWallet] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => { accountService.myWallet().then(setWallet).catch((requestError) => setError(requestError.message)) }, [])

  if (error) return <div className="account-section"><div className="form-error">{error}</div></div>
  if (!wallet) return <div className="account-section"><div className="page-state">Učitavanje balansa…</div></div>

  const rows = (wallet.transactions || []).filter((row) => filter === 'all' || (filter === 'in' ? Number(row.amount) > 0 : Number(row.amount) < 0))

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Balans</h1></div>

      <div className="wallet-card">
        <div className="wallet-card-top">
          <span className="wallet-card-label"><Wallet size={15} /> Stanje računa</span>
          <span className="wallet-card-chip"><ShieldCheck size={13} /> Sigurno na platformi</span>
        </div>
        <strong className="wallet-card-balance"><CountUp value={wallet.balance} format={money} duration={900} /></strong>
        <span className="wallet-card-sub">trenutno stanje · {wallet.count} {Number(wallet.count) === 1 ? 'transakcija' : 'transakcija'}</span>
        <Coins className="wallet-card-art" size={120} aria-hidden="true" />
      </div>

      <div className="wallet-stats">
        <div><ArrowDownLeft size={16} /><span>Uplaćeno ukupno</span><strong><CountUp value={wallet.credited_total} format={money} /></strong></div>
        <div><ArrowUpRight size={16} /><span>Skinuto ukupno</span><strong><CountUp value={wallet.spent_total} format={money} /></strong></div>
        <div><ArrowDownLeft size={16} /><span>Uplaćeno · 30 dana</span><strong><CountUp value={wallet.credited_30d} format={money} /></strong></div>
        <div><ArrowUpRight size={16} /><span>Skinuto · 30 dana</span><strong><CountUp value={wallet.spent_30d} format={money} /></strong></div>
      </div>

      <div className="wallet-info">
        <Info size={16} />
        <span>Ovo je tvoj novac na Poso.ba. Kad prihvatiš ponudu, cijena se rezerviše odavde i čuva dok ne potvrdiš da je posao završen; kad ti klijent oslobodi uplatu, zarada (bez naknade) sjeda ovdje. Uplata karticom i isplata na račun stižu uskoro — do tada uplatu i isplatu dogovaraš s timom. <Link to="/nivoi">Kako rade naknade →</Link></span>
      </div>

      <div className="wallet-cta">
        <Link to={`/pomoc?chat=1&msg=${encodeURIComponent('Želim uplatiti na balans: ____ KM. Kako da uplatim?')}`} className="primary-button"><ArrowDownLeft size={16} /> Zatraži uplatu</Link>
        <Link to={`/pomoc?chat=1&msg=${encodeURIComponent(`Želim isplatu sa balansa (${money(wallet.balance)}) na svoj račun.`)}`} className="ghost-button"><ArrowUpRight size={16} /> Zatraži isplatu</Link>
      </div>

      <div className="wallet-list-head">
        <h3 className="account-sub">Transakcije</h3>
        <div className="admin-subtabs">
          {[['all', 'Sve'], ['in', 'Uplate'], ['out', 'Skidanja']].map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 && (
        <div className="wallet-empty">
          <Coins size={28} />
          <strong>Još nema transakcija</strong>
          <span>Svaka uplata, naknada ili isplata pojaviće se ovdje.</span>
        </div>
      )}
      <div className="wallet-list">
        {rows.map((row) => {
          const [label, Icon] = KIND[row.kind] || ['Transakcija', Receipt]
          const positive = Number(row.amount) > 0
          return (
            <div key={row.id} className="wallet-row">
              <span className={`wallet-sign ${positive ? 'plus' : 'minus'}`}><Icon size={16} /></span>
              <div>
                <strong>{label}{row.note ? ` · ${row.note}` : ''}</strong>
                <small>{formatBosnianDate(row.created_at)} · stanje nakon: {money(row.balance_after)}</small>
              </div>
              <b className={positive ? 'plus' : 'minus'}>{positive ? '+' : '−'}{money(Math.abs(Number(row.amount)))}</b>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WalletPage
