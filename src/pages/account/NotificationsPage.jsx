import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Bell, Bot, ChevronRight, Handshake, LifeBuoy, MessageCircle, ShieldBan, Wallet } from 'lucide-react'
import { notificationService } from '../../services/notificationService'
import { formatBosnianDate } from '../../utils/dateFormat'

const ICONS = { support: LifeBuoy, support_reply: MessageCircle, moderation: ShieldBan, ai: Bot, badge: Bell, message: MessageCircle, offer: Handshake, offer_accepted: BadgeCheck, wallet: Wallet, job: Wallet, task_alert: Bell }

function NotificationsPage() {
  const [items, setItems] = useState(null)
  useEffect(() => {
    notificationService.listMine(50).then(async (rows) => {
      setItems(rows)
      const unread = rows.filter((row) => !row.read_at).map((row) => row.id)
      if (unread.length) await notificationService.markRead(unread)
    })
  }, [])

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Obavijesti</h1></div>
      {items === null && <div className="skeleton-card" />}
      {items?.length === 0 && (
        <div className="account-empty">
          <div className="account-empty-art notif-art">
            <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
              <rect x="6" y="6" width="100" height="52" rx="6" fill="white" stroke="#0d2a52" strokeWidth="3" />
              <path d="M30 60 l8 12 l6 -12" fill="white" stroke="#0d2a52" strokeWidth="3" strokeLinejoin="round" />
              <path d="M20 26 q6 -10 12 0 t12 0 M20 42 q6 -10 12 0 t12 0 M56 26 q6 -10 12 0 t12 0 M56 42 q6 -10 12 0 t12 0" fill="none" stroke="#f5b400" strokeWidth="3" strokeLinecap="round" />
              <circle cx="104" cy="10" r="9" fill="#f5b400" stroke="#0d2a52" strokeWidth="3" />
            </svg>
          </div>
          <p>Ovdje ćemo te obavještavati o poslovima, ponudama, porukama i značkama.<br />Hajde — objavi posao ili pošalji ponudu!</p>
          <div className="account-empty-actions">
            <Link to="/objavi" className="primary-button">Objavi posao</Link>
            <Link to="/search" className="ghost-button">Pregledaj poslove</Link>
          </div>
        </div>
      )}
      {items?.length > 0 && (
        <ul className="notif-list">
          {items.map((item) => {
            const Icon = ICONS[item.type] || Bell
            return (
              <li key={item.id} className={item.read_at ? '' : 'unread'}>
                <span className="notif-list-icon"><Icon size={16} /></span>
                <div><strong>{item.title}</strong>{item.message && <p>{item.message}</p>}<time>{formatBosnianDate(item.created_at)}</time></div>
                {item.link && <Link to={item.link} className="notif-list-open" aria-label="Otvori"><ChevronRight size={18} /></Link>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default NotificationsPage
