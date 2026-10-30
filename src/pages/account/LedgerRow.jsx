import { ArrowUpRight, Coins, CreditCard, Gift, Landmark, Lock, Receipt, RefreshCcw, Sparkles } from 'lucide-react'
import { formatBosnianDate } from '../../utils/dateFormat'

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

/** One move on the balance (my_wallet().transactions), used on Balans and in Historija. */
function LedgerRow({ row }) {
  const [label, Icon] = KIND[row.kind] || ['Transakcija', Receipt]
  const positive = Number(row.amount) > 0
  return (
    <div className="wallet-row">
      <span className={`wallet-sign ${positive ? 'plus' : 'minus'}`}><Icon size={16} /></span>
      <div>
        <strong>{label}{row.note ? ` · ${row.note}` : ''}</strong>
        <small>{formatBosnianDate(row.created_at)} · stanje nakon: {money(row.balance_after)}</small>
      </div>
      <b className={positive ? 'plus' : 'minus'}>{positive ? '+' : '−'}{money(Math.abs(Number(row.amount)))}</b>
    </div>
  )
}

export default LedgerRow
