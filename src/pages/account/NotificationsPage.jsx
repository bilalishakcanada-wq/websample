import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MailMascot } from '../../app/Mascots'
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
          <div className="account-empty-art notif-art"><MailMascot /></div>
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
