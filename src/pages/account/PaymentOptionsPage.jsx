import { Link } from 'react-router-dom'
import { ChevronRight, CreditCard, History, Wallet } from 'lucide-react'

/** "Opcije plaćanja" hub: history, methods and the balance, as plain rows. */
function PaymentOptionsPage() {
  const rows = [
    ['/account/placanja', 'Historija plaćanja', 'Sve što si platio/la ili zaradio/la', History],
    ['/account/nacini-placanja', 'Načini plaćanja', 'Kartica za plaćanje i račun za isplate', CreditCard],
    ['/account/novcanik', 'Balans', 'Stanje na Poso.ba nalogu', Wallet],
  ]
  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Opcije plaćanja</h1></div>
      <div className="ap-menu ap-menu-plain">
        {rows.map(([to, label, sub, Icon]) => (
          <Link key={to} to={to} className="ap-menu-row"><Icon size={18} /><span>{label}<small>{sub}</small></span><ChevronRight size={18} /></Link>
        ))}
      </div>
    </div>
  )
}

export default PaymentOptionsPage
