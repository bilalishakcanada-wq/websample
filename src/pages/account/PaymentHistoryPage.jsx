import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WalletMascot } from '../../app/Mascots'
import { ArrowDownLeft, ArrowUpRight, Coins, CreditCard, Gift, Landmark, Lock, Receipt, RefreshCcw, Sparkles } from 'lucide-react'
import { accountService } from '../../services/accountService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { SkeletonList } from '../../components/Skeleton'
import PaymentTabs from './PaymentTabs'

const formatKM = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} KM`
const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`
const KIND = {
  admin_credit: ['Uplata od Zadatak tima', Gift],
  bonus: ['Bonus', Sparkles],
  promo: ['Promocija', Sparkles],
  refund: ['Povrat', RefreshCcw],
  admin_debit: ['Skidanje od Zadatak tima', Receipt],
  fee: ['Naknada za posao', Receipt],
  purchase: ['Uplata', Receipt],
  payout: ['Isplata', ArrowUpRight],
  escrow_hold: ['Rezervisano za posao', Lock],
  escrow_refund: ['Povrat rezervisanog iznosa', RefreshCcw],
  job_income: ['Zarada od posla', Coins],
  card_topup: ['Uplata karticom', CreditCard],
  payout_hold: ['Isplata na račun', Landmark],
  payout_return: ['Povrat isplate na balans', RefreshCcw],
}
const STATUS = { funded: ['Rezervisano', 'funded'], requested: ['Čeka potvrdu klijenta', 'requested'], released: ['Isplaćeno', 'released'], refunded: ['Vraćeno', 'refunded'], disputed: ['Spor', 'disputed'] }

/** "Plaćanje → Historija": every job paid through Zadatak Pay, or every move on the balance. */
function PaymentHistoryPage() {
  const [rows, setRows] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [view, setView] = useState('jobs')
  useEffect(() => { accountService.paymentHistory().then(setRows) }, [])
  useEffect(() => {
    if (view === 'ledger' && ledger === null) accountService.myWallet().then((wallet) => setLedger(wallet?.transactions || [])).catch(() => setLedger([]))
  }, [view, ledger])

  const visible = rows || []
  const earned = (rows || []).filter((row) => row.role === 'earned' && row.status === 'released').reduce((sum, row) => sum + Number(row.net || 0), 0)
  const paid = (rows || []).filter((row) => row.role === 'paid' && row.status === 'released').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const hasEarned = (rows || []).some((row) => row.role === 'earned')
  const hasPaid = (rows || []).some((row) => row.role === 'paid')

  return (
    <div className="account-section">
      <PaymentTabs />

      {/* only the totals that apply to this user; money still on the way is on the Balans tab */}
      {(hasEarned || hasPaid) && (
        <div className="pay-summary">
          {hasEarned && <div><span>Zarađeno (bez naknade)</span><strong>{formatKM(earned)}</strong></div>}
          {hasPaid && <div><span>Plaćeno izvođačima</span><strong>{formatKM(paid)}</strong></div>}
        </div>
      )}

      <div className="admin-subtabs">
        {[['jobs', 'Poslovi'], ['ledger', 'Sve transakcije']].map(([id, label]) => (
          <button key={id} type="button" className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      {view === 'ledger' && ledger === null && <SkeletonList n={3} h={64} />}
      {view === 'ledger' && ledger !== null && ledger.length === 0 && (
        <div className="wallet-empty">
          <Coins size={28} />
          <strong>Još nema transakcija</strong>
          <span>Svaka uplata, naknada ili isplata pojaviće se ovdje.</span>
        </div>
      )}
      {view === 'ledger' && ledger !== null && ledger.length > 0 && (
        <div className="wallet-list">
          {ledger.map((row) => {
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
      )}

      {view === 'jobs' && rows === null && <SkeletonList n={3} h={72} />}
      {view === 'jobs' && rows !== null && visible.length === 0 && (
        <div className="account-empty">
          <div className="account-empty-art notif-art"><WalletMascot /></div>
          <p>Još nema plaćanja. Prvo stiže kad prihvatiš ponudu ili kad klijent prihvati tvoju.</p>
          <Link to="/search" className="primary-button">Pregledaj poslove</Link>
        </div>
      )}
      {view === 'jobs' && visible.length > 0 && (
        <ul className="pay-list">
          {visible.map((row) => (
            <li key={`${row.listing_id}-${row.role}`}>
              <span className={`pay-icon ${row.role}`}>{row.role === 'earned' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
              <div>
                <strong><Link to={`/listings/${row.listing_id}`}>{row.title}</Link></strong>
                <small>{row.role === 'earned' ? `Klijent: ${row.other_name}` : `Izvođač: ${row.other_name}`} · {formatBosnianDate(row.completed_at)} · <span className={`pay-status-text pay-status-${(STATUS[row.status] || [])[1] || ''}`}>{(STATUS[row.status] || [row.status])[0]}</span></small>
              </div>
              <div className="pay-amount">
                <strong>{row.role === 'earned' ? '+' : '−'}{formatKM(row.role === 'earned' ? row.net : row.amount)}</strong>
                {row.role === 'earned' && <small>{formatKM(row.amount)} − {row.fee_percent} % naknade</small>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PaymentHistoryPage
