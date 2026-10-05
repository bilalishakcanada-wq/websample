import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { canGoBackInApp, parentOf } from '../utils/backNav'
import { toast } from './Toaster'

/**
 * Android's back button, same rule as the on-screen arrow: close an open sheet or step back in a
 * flow first, then return to the previous screen, then walk up to home, and only close the app
 * from the home screen, on a second press within two seconds (the first one says so), so a stray
 * press never throws someone out.
 */
function NativeBack() {
  const navigate = useNavigate()
  const location = useLocation()
  const hereRef = useRef(location)
  useEffect(() => { hereRef.current = location }, [location])

  useEffect(() => {
    const app = window.Capacitor?.isNativePlatform?.() ? window.Capacitor?.Plugins?.App : null
    if (!app?.addListener) return undefined
    let handle
    let gone = false
    let armedAt = 0
    const onBack = () => {
      // the "Kamera / Galerija" sheet (utils/native.js) has no history entry of its own
      const photoSheet = document.getElementById('zadatak-photo-source')
      if (photoSheet) { photoSheet.remove(); return }
      const state = window.history.state || {}
      if (state.zadatakOverlay || state.zadatakStep || canGoBackInApp()) { window.history.back(); return }
      const up = parentOf(hereRef.current.pathname, hereRef.current.search)
      if (up) { navigate(up, { replace: true }); return }
      if (Date.now() - armedAt > 2000) {
        armedAt = Date.now()
        toast('Pritisni Nazad još jednom za izlaz.', { duration: 2000 })
        return
      }
      armedAt = 0
      // minimize keeps the WebView alive, so reopening is instant instead of a full reload behind the splash
      if (app.minimizeApp) app.minimizeApp()
      else app.exitApp?.()
    }
    Promise.resolve(app.addListener('backButton', onBack)).then((h) => { if (gone) h?.remove?.(); else handle = h }).catch(() => {})
    return () => { gone = true; handle?.remove?.() }
  }, [navigate])
  return null
}

export default NativeBack
