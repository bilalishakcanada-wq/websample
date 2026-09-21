import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'

/** Bell in the pinned top bar of the phone tab screens: opens the notifications list, shows the unread count. */
function NotifBellLink({ className = 'ap-icon-btn' }) {
  const { user } = useAuth()
  const unread = useUnreadNotifications(user?.id)
  return (
    <Link to="/account/obavijesti" className={className} aria-label={unread ? `Obavijesti, ${unread} nepročitanih` : 'Obavijesti'}>
      <Bell size={20} />
      {unread > 0 && <b className="ap-bell-count">{unread > 9 ? '9+' : unread}</b>}
    </Link>
  )
}

export default NotifBellLink
