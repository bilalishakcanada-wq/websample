import { useEffect, useState } from 'react'
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

function Toaster() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const onToast = (event) => {
      const item = event.detail
      setItems((list) => [...list.slice(-2), item])
      window.setTimeout(() => setItems((list) => list.filter((entry) => entry.id !== item.id)), item.duration)
    }
    window.addEventListener(EVENT, onToast)
    return () => window.removeEventListener(EVENT, onToast)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((item) => {
        const Icon = ICONS[item.kind] || Info
        return (
          <div key={item.id} className={`toast toast-${item.kind}`}>
            <Icon size={18} />
            <span>{item.message}</span>
            <button type="button" aria-label="Zatvori" onClick={() => setItems((list) => list.filter((entry) => entry.id !== item.id))}><X size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}

export default Toaster
