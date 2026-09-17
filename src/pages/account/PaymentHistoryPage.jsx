import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react'
import { accountService } from '../../services/accountService'
import { formatBosnianDate } from '../../utils/dateFormat'

const formatKM = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} KM`
const STATUS = { funded: ['Uplata osigurana', 'funded'], requested: ['Čeka oslobađanje', 'requested'], released: ['Isplaćeno', 'released'], refunded: ['Vraćeno', 'refunded'], disputed: ['Spor', 'disputed'] }

function PaymentHistoryPage() {
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('all')
  useEffect(() => { accountService.paymentHistory().then(setRows) }, [])

  const visible = (rows || []).filter((row) => tab === 'all' || row.role === tab)
  const earned = (rows || []).filter((row) => row.role === 'earned' && row.status === 'released').reduce((sum, row) => sum + Number(row.net || 0), 0)
  const paid = (rows || []).filter((row) => row.role === 'paid' && row.status === 'released').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const held = (rows || []).filter((row) => ['funded', 'requested', 'disputed'].includes(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0)

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Historija plaćanja</h1></div>
      <p className="muted-text">Svaki posao plaćen kroz Poso.ba Pay: novac se rezerviše kad klijent prihvati ponudu i isplaćuje izvođaču kad klijent potvrdi da je posao završen.</p>

      <div className="pay-summary">
        <div><span>Zarađeno (neto)</span><strong>{formatKM(earned)}</strong></div>
        <div><span>Plaćeno izvođačima</span><strong>{formatKM(paid)}</strong></div>
        <div><span>Trenutno osigurano</span><strong>{formatKM(held)}</strong></div>
        <div><span>Ukupno poslova</span><strong>{rows ? rows.length : '—'}</strong></div>
      </div>

      <div className="admin-subtabs">
        {[['all', 'Sve'], ['earned', 'Zarada'], ['paid', 'Plaćanja']].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {rows === null && <div className="skeleton-card" />}
      {rows !== null && visible.length === 0 && (
        <div className="account-empty">
          <div className="account-empty-art"><Receipt size={34} /></div>
          <p>Još nema plaćanja. Prvo stiže kad prihvatiš ponudu ili kad klijent prihvati tvoju.</p>
          <Link to="/search" className="primary-button">Pregledaj poslove</Link>
        </div>
      )}
      {visible.length > 0 && (
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
                {row.role === 'earned' && <small>{formatKM(row.amount)} − {row.fee_percent}% naknade</small>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PaymentHistoryPage
