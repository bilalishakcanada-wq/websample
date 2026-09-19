import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Bell, Bot, Handshake, LifeBuoy, MessageCircle, ShieldBan, Wallet } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { desktopNotify, notificationService, playPing } from '../services/notificationService'
import { formatBosnianDate } from '../utils/dateFormat'
import { currentSubscription } from '../utils/push'
import { toast } from './Toaster'

const ICONS = { support: LifeBuoy, support_reply: MessageCircle, moderation: ShieldBan, ai: Bot, message: MessageCircle, offer: Handshake, offer_accepted: BadgeCheck, wallet: Wallet, job: Wallet }

function NotificationBell() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!user) return undefined
    let active = true
    notificationService.listMine().then((rows) => active && setItems(rows))
    const unsubscribe = notificationService.subscribe(user.id, async (row) => {
      setItems((current) => [row, ...current].slice(0, 30))
      // app in front: a toast (unless the user is already in the chat); in the
      // background: the push service worker notifies, or the browser API if push is off
      if (document.visibilityState === 'visible') {
        if (!(row.type === 'message' && window.location.pathname.includes('/messages'))) {
          playPing()
          toast(row.title, { kind: row.type === 'offer_accepted' || row.type === 'wallet' ? 'success' : 'info' })
        }
      } else if (!(await currentSubscription())) {
        desktopNotify(row.title, row.message || '')
      }
    })
    return () => { active = false; unsubscribe() }
  }, [user])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => { if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  if (!user) return null
  const unread = items.filter((item) => !item.read_at)

  const openItem = async (item) => {
    setOpen(false)
    if (!item.read_at) {
      await notificationService.markRead([item.id])
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)))
    }
    if (item.link) navigate(item.link)
    else if (item.type === 'support' || item.type === 'moderation') navigate(isAdmin ? `/admin?tab=${item.type === 'support' ? 'support' : 'moderation'}` : '/account/obavijesti')
    else if (item.type === 'support_reply') navigate('/pomoc?chat=1')
    else if (item.type === 'wallet') navigate('/account/novcanik')
    else if (item.type === 'job') navigate('/account/placanja')
    else navigate('/account/obavijesti')
  }

  const markAll = async () => {
    await notificationService.markRead(unread.map((item) => item.id))
    setItems((current) => current.map((row) => ({ ...row, read_at: row.read_at || new Date().toISOString() })))
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button type="button" className={`notif-button ${unread.length ? 'has-unread' : ''}`} onClick={() => setOpen((value) => !value)} aria-label="Obavijesti" aria-expanded={open}>
        <Bell size={18} />
        {unread.length > 0 && <span className="notif-count">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <strong>Obavijesti</strong>
            {unread.length > 0 && <button type="button" onClick={markAll}>Označi sve kao pročitano</button>}
          </div>
          {items.length === 0 ? <p className="muted-text">Nema obavijesti.</p> : (
            <ul>
              {items.map((item) => {
                const Icon = ICONS[item.type] || Bell
                return (
                  <li key={item.id}>
                    <button type="button" className={item.read_at ? '' : 'unread'} onClick={() => openItem(item)}>
                      <Icon size={16} />
                      <span>
                        <strong>{item.title}</strong>
                        {item.message && <small>{item.message}</small>}
                        <time>{formatBosnianDate(item.created_at)}</time>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
