import { NavLink } from 'react-router-dom'
import { History, Landmark, Wallet } from 'lucide-react'

const PAYMENT_TABS = [
  ['/account/novcanik', 'Balans', Wallet],
  ['/account/placanja', 'Historija', History],
  ['/account/nacini-placanja', 'Račun za isplatu', Landmark],
]

/** One "Plaćanje" page: balance, history and the payout account are its three tabs. */
function PaymentTabs() {
  return (
    <>
      <div className="account-section-head"><h1>Plaćanje</h1></div>
      <nav className="pay-tabs" aria-label="Plaćanje">
        {PAYMENT_TABS.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} replace className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={16} /> {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

export default PaymentTabs
