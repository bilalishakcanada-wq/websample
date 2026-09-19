import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { currentSubscription, enablePush, pushNeedsInstall, pushPermission, pushSupported } from '../utils/push'
import { toast } from './Toaster'

const DISMISS_KEY = 'poso-push-prompt-dismissed'

/**
 * Soft "turn on notifications" card. Shows once per device to signed-in users
 * whose browser can do push and who have not decided yet.
 */
function PushPrompt({ compact = false, reason = 'Saznaj odmah kad stigne ponuda ili poruka — i kad aplikacija nije otvorena.' }) {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    if (!user || !pushSupported() || pushNeedsInstall()) return undefined
    if (pushPermission() !== 'default') return undefined
    try { if (localStorage.getItem(DISMISS_KEY)) return undefined } catch { /* ignore */ }
    currentSubscription().then((sub) => { if (alive && !sub) setVisible(true) })
    return () => { alive = false }
  }, [user])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  const enable = async () => {
    setBusy(true)
    try {
      const result = await enablePush()
      if (result === 'granted') { toast('Obavijesti su uključene na ovom uređaju.', { kind: 'success' }); setVisible(false) }
      else if (result === 'denied') { toast('Obavijesti su blokirane u pregledniku — uključi ih u postavkama sajta.', { kind: 'error' }); setVisible(false) }
    } catch (error) {
      toast(error.message || 'Nije uspjelo uključivanje obavijesti.', { kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`push-prompt ${compact ? 'is-compact' : ''}`} role="region" aria-label="Obavijesti">
      <span className="push-prompt-icon"><BellRing size={20} /></span>
      <div className="push-prompt-text">
        <strong>Uključi obavijesti</strong>
        {!compact && <span>{reason}</span>}
      </div>
      <button type="button" className="primary-button push-prompt-cta" onClick={enable} disabled={busy}>{busy ? '…' : 'Uključi'}</button>
      <button type="button" className="push-prompt-close" onClick={dismiss} aria-label="Ne sada"><X size={16} /></button>
    </div>
  )
}

export default PushPrompt
