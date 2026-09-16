import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Bot, LifeBuoy, MessageCircle, ShieldBan } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { desktopNotify, notificationService, playPing } from '../services/notificationService'
import { formatBosnianDate } from '../utils/dateFormat'

const ICONS = { support: LifeBuoy, support_reply: MessageCircle, moderation: ShieldBan, ai: Bot }

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
    const unsubscribe = notificationService.subscribe(user.id, (row) => {
      setItems((current) => [row, ...current].slice(0, 30))
      playPing()
      desktopNotify(row.title, row.message || '')
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
    if (item.type === 'support' || item.type === 'moderation') navigate(isAdmin ? `/admin?tab=${item.type === 'support' ? 'support' : 'moderation'}` : '/profile')
    else if (item.type === 'support_reply') window.dispatchEvent(new CustomEvent('poso:open-support'))
    else navigate('/dashboard')
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
