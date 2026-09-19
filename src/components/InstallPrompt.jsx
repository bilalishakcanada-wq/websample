import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

const DISMISS_KEY = 'poso:install-dismissed'
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

/**
 * "Add to home screen" banner. Android/desktop Chrome hand us the native prompt;
 * iOS has no API, so we show the two-tap instruction instead.
 */
function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1' } catch { /* private mode */ }
    if (dismissed || isStandalone()) return undefined
    const onPrompt = (event) => { event.preventDefault(); setDeferred(event); setShow(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    // iOS never fires the event — show the hint after a short while on the first visit
    const timer = isIos() ? window.setTimeout(() => setShow(true), 12000) : null
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); if (timer) window.clearTimeout(timer) }
  }, [])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferred(null)
  }

  if (!show) return null

  return (
    <div className="install-banner" role="dialog" aria-label="Instaliraj aplikaciju">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width="44" height="44" />
      <div>
        <strong>Poso.ba kao aplikacija</strong>
        {deferred
          ? <span>Brže otvaranje, cijeli ekran, obavijesti — bez app storea.</span>
          : <span>Klikni <Share size={13} /> <b>Podijeli</b> pa <b>„Dodaj na početni ekran“</b>.</span>}
      </div>
      {deferred && <button type="button" className="primary-button small-button" onClick={install}><Download size={15} /> Instaliraj</button>}
      <button type="button" className="icon-button" onClick={dismiss} aria-label="Zatvori"><X size={16} /></button>
    </div>
  )
}

export default InstallPrompt
