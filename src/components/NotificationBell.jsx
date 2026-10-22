import { createElement, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { desktopNotify, notificationService, playPing } from '../services/notificationService'
import { formatBosnianDate } from '../utils/dateFormat'
import { notificationCategory, notificationIcon, notificationTarget } from '../utils/notificationCategory'
import './NotificationCenter.css'
import { currentSubscription } from '../utils/push'
import { toast } from './Toaster'

// notification ids already toasted/pinged in this session (shared by every bell instance)
const announced = new Set()

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
      // the header mounts two bells (desktop + phone): only one of them announces
      if (announced.has(row.id)) return
      announced.add(row.id)
      // app in front: a toast (unless the user is already in the chat), with a ping only while push is on;
      // in the background: the push service worker notifies, or the browser API when this device has no
      // push subscription. With "Push obavijesti" off nothing pops up or sounds: it only waits in the bell.
      const pushOn = await notificationService.pushEnabled(user.id)
      if (document.visibilityState === 'visible') {
        if (!(row.type === 'message' && window.location.pathname.includes('/messages'))) {
          if (pushOn) playPing()
          toast(row.title, { kind: ['offer_accepted', 'wallet', 'task_live', 'review', 'welcome'].includes(row.type) ? 'success' : 'info' })
        }
      } else if (pushOn && !(await currentSubscription())) {
        desktopNotify(row.title, row.message || '')
      }
    })
    // read on another screen (the Obavijesti page, the other bell): the count here follows
    const refresh = () => notificationService.listMine().then((rows) => active && setItems(rows))
    window.addEventListener('zadatak:notifications-read', refresh)
    return () => { active = false; unsubscribe(); window.removeEventListener('zadatak:notifications-read', refresh) }
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
    navigate(notificationTarget(item, isAdmin) || '/account/obavijesti')
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
                return (
                  <li key={item.id}>
                    <button type="button" className={item.read_at ? '' : 'unread'} onClick={() => openItem(item)}>
                      <span className={`notif-panel-icon notif-cat-${notificationCategory(item)}`}>{createElement(notificationIcon(item), { size: 14 })}</span>
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
