import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { keys, useNotifications } from '../../hooks/queries'
import { Link } from 'react-router-dom'
import { MailMascot } from '../../app/Mascots'
import { Award, BadgeCheck, Bell, Bot, ChevronRight, Handshake, HelpCircle, LifeBuoy, MessageCircle, ShieldBan, Sparkles, Star, Wallet } from 'lucide-react'
import { notificationService } from '../../services/notificationService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { SkeletonNotifRow } from '../../components/Skeleton'

const ICONS = { support: LifeBuoy, support_reply: MessageCircle, moderation: ShieldBan, ai: Bot, badge: Award, message: MessageCircle, offer: Handshake, offer_accepted: BadgeCheck, offer_rejected: Handshake, wallet: Wallet, job: Wallet, task_alert: Bell, task_live: Sparkles, question: HelpCircle, review: Star, welcome: Sparkles }

function NotificationsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const query = useNotifications(user?.id, 50)
  const items = query.isPending ? null : (query.data || [])
  // opening the page reads everything: mark unread rows read (once per fresh list)
  useEffect(() => {
    const unread = (query.data || []).filter((row) => !row.read_at).map((row) => row.id)
    if (!unread.length) return
    notificationService.markRead(unread).then(() => {
      queryClient.setQueryData([...keys.notifications(user?.id), 50], (rows) => (rows || []).map((row) => (unread.includes(row.id) ? { ...row, read_at: row.read_at || new Date().toISOString() } : row)))
      queryClient.invalidateQueries({ queryKey: keys.unreadNotifications(user?.id) })
    })
  }, [query.data, queryClient, user?.id])

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Obavijesti</h1></div>
      {items === null && <ul className="notif-list">{[1, 2, 3, 4].map((i) => <SkeletonNotifRow key={i} />)}</ul>}
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
