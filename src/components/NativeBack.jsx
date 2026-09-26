import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { canGoBackInApp, parentOf } from '../utils/backNav'

/**
 * Android's back button, same rule as the on-screen arrow: close an open sheet or step back in a
 * flow first, then return to the previous screen, then walk up to home, and only close the app
 * from the home screen.
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
    const onBack = () => {
      const state = window.history.state || {}
      if (state.posoOverlay || state.posoStep || canGoBackInApp()) { window.history.back(); return }
      const up = parentOf(hereRef.current.pathname, hereRef.current.search)
      if (up) navigate(up, { replace: true })
      else app.exitApp?.()
    }
    Promise.resolve(app.addListener('backButton', onBack)).then((h) => { if (gone) h?.remove?.(); else handle = h }).catch(() => {})
    return () => { gone = true; handle?.remove?.() }
  }, [navigate])
  return null
}

export default NativeBack
