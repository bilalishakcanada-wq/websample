import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const EVENT = 'poso:toast'
let counter = 0

/**
 * Fire-and-forget notification: toast('Posao objavljen', { kind: 'success' }).
 * Works from anywhere (services, pages) — no context needed.
 */
export function toast(message, { kind = 'info', duration = 3200 } = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: ++counter, message, kind, duration } }))
}

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info }

const EXIT_MS = 200

function Toaster() {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())

  // play the exit, then drop the toast
  const dismiss = useCallback((id) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setItems((list) => list.map((entry) => (entry.id === id ? { ...entry, leaving: true } : entry)))
    window.setTimeout(() => setItems((list) => list.filter((entry) => entry.id !== id)), reduce ? 0 : EXIT_MS)
  }, [])

  const schedule = useCallback((id, ms) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.set(id, window.setTimeout(() => dismiss(id), ms))
  }, [dismiss])

  useEffect(() => {
    const onToast = (event) => {
      const item = event.detail
      setItems((list) => [...list.slice(-2), item])
      schedule(item.id, item.duration)
    }
    // connectivity changes are the one toast the app raises on its own
    const onOffline = () => toast('Nema interneta — provjeri vezu.', { kind: 'error', duration: 6000 })
    const onOnline = () => toast('Ponovo si online.', { kind: 'success', duration: 2000 })
    window.addEventListener(EVENT, onToast)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    const pending = timers.current
    return () => {
      window.removeEventListener(EVENT, onToast)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      pending.forEach((timer) => window.clearTimeout(timer))
    }
  }, [schedule])

  if (items.length === 0) return null

  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((item) => (
        <ToastItem key={item.id} item={item} onDismiss={dismiss} onPause={() => window.clearTimeout(timers.current.get(item.id))} onResume={() => schedule(item.id, 1800)} />
      ))}
    </div>
  )
}

/** One toast: hovering or touching it pauses the timer, a sideways swipe throws it away. */
function ToastItem({ item, onDismiss, onPause, onResume }) {
  const Icon = ICONS[item.kind] || Info
  const drag = useRef(null)
  const [dx, setDx] = useState(0)

  const onPointerDown = (event) => {
    if (event.target.closest('button')) return
    drag.current = { x: event.clientX, id: event.pointerId }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    onPause()
  }
  const onPointerMove = (event) => {
    if (drag.current?.id === event.pointerId) setDx(event.clientX - drag.current.x)
  }
  const onPointerUp = (event) => {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    if (Math.abs(dx) > 80) { onDismiss(item.id); return }
    setDx(0)
    onResume()
  }

  const style = dx ? { transform: `translateX(${dx}px)`, opacity: Math.max(0.2, 1 - Math.abs(dx) / 220), transition: 'none' } : undefined
  return (
    <div
      className={`toast toast-${item.kind} ${item.leaving ? 'is-closing' : ''}`}
      style={item.leaving ? undefined : style}
      onMouseEnter={onPause}
      onMouseLeave={() => { if (!drag.current) onResume() }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Icon size={18} />
      <span>{item.message}</span>
      <button type="button" aria-label="Zatvori" onClick={() => onDismiss(item.id)}><X size={14} /></button>
    </div>
  )
}

export default Toaster
