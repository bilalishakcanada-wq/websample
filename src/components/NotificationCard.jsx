import { createElement } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { notificationAction, notificationCategory, notificationIcon, notificationTarget } from '../utils/notificationCategory'
import { timeAgo } from '../utils/dateFormat'
import './NotificationCenter.css'

/** One alert: the coloured circle says what it is before the text is read. */
function NotificationCard({ item, unread }) {
  const category = notificationCategory(item)
  const { isAdmin } = useAuth()
  const action = notificationAction(item)
  const target = notificationTarget(item, isAdmin)
  return (
    <li className={`notif-card notif-cat-${category}${unread ? ' is-unread' : ''}`}>
      <span className="notif-card-icon" aria-hidden="true">{createElement(notificationIcon(item), { size: 18 })}</span>
      <div className="notif-card-body">
        <strong>{item.title}</strong>
        {item.message && <p>{item.message}</p>}
        <div className="notif-card-meta">
          <time dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
          {action && <Link to={item.link} className="notif-card-action">{action}</Link>}
        </div>
      </div>
      {unread && <span className="notif-card-dot" aria-label="Novo" />}
      {target && !action && <Link to={target} className="notif-list-open" aria-label="Otvori"><ChevronRight size={18} /></Link>}
    </li>
  )
}

export default NotificationCard
