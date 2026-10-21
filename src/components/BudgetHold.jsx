import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

const km = (value) => Number(value).toLocaleString('bs-BA', { maximumFractionDigits: 2 })

/**
 * Under the budget field once publishing holds the budget (supabase/payments/03): what happens to
 * the money, the client's balance, and a way to top up when it doesn't cover the budget.
 * An edit only holds the difference, so it never warns there (the database still checks).
 */
export function BudgetHoldNote({ price, balance, editing = false, className = '' }) {
  const short = !editing && balance != null && Number(price) > balance
  return (
    <div className={`budget-hold-note ${short ? 'is-short' : ''} ${className}`}>
      <p><ShieldCheck size={14} /> Kad objaviš posao, budžet se odmah rezerviše sa tvog balansa i čuva na Zadatku dok posao ne bude završen. Ako ne prihvatiš nijednu ponudu ili zatvoriš posao, novac se vraća na balans.</p>
      {balance != null && <p>Na balansu imaš <strong>{km(balance)} KM</strong>.</p>}
      {short && <p role="alert" className="budget-hold-short">Nemaš dovoljno na balansu za ovaj budžet. <Link to="/account/novcanik">Dopuni balans →</Link></p>}
    </div>
  )
}
