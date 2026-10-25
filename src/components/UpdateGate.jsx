import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import BrandMark from './BrandMark'
import { appConfig } from '../config/appConfig'
import { useSwitch } from '../hooks/useSwitches'
import { isNativeApp, openInSystemBrowser } from '../utils/native'
import { dropBootScreen } from '../utils/boot'
import './SuspendedScreen.css'

/** 1.2.10 vs 1.10.0, part by part; missing parts count as 0. */
const older = (a, b) => {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0)
  }
  return false
}

/**
 * Inside the iOS/Android app: when the installed app is older than the lowest version set in
 * Admin → Prekidači, only "Ažuriraj aplikaciju" shows, instead of the site breaking on an old shell.
 * Browsers and unknown versions pass straight through.
 */
function UpdateGate({ children }) {
  const minimum = useSwitch('min_app_version')
  const [installed, setInstalled] = useState(null)
  const platform = isNativeApp() ? window.Capacitor?.getPlatform?.() : null

  useEffect(() => {
    if (!platform) return
    window.Capacitor?.Plugins?.App?.getInfo?.().then((info) => setInstalled(info?.version || null), () => {})
  }, [platform])

  const required = platform && minimum.value?.[platform]
  const blocked = Boolean(installed && required && older(installed, required))
  // the pre-rendered welcome screen would otherwise stay on top of this one
  useEffect(() => { if (blocked) dropBootScreen() }, [blocked])
  if (!blocked) return children
  const storeUrl = minimum.value?.[`${platform}_url`]

  return (
    <main className="suspended-shell">
      <div className="suspended-logo">
        <BrandMark size={42} className="brand-mark" />
        <span className="brand-name">{appConfig.appName}</span>
      </div>
      <div className="suspended-card">
        <span className="suspended-icon update-icon" aria-hidden="true"><Download size={34} /></span>
        <h1>Ažuriraj aplikaciju</h1>
        <p className="suspended-note">{minimum.message || 'Izašla je nova verzija aplikacije. Ažuriraj je da nastaviš.'}</p>
        <p className="suspended-end">Tvoja verzija: {installed} · potrebna: {required}</p>
        {storeUrl && <button type="button" className="primary-button suspended-logout" onClick={() => openInSystemBrowser(storeUrl)}>{platform === 'ios' ? 'Otvori App Store' : 'Otvori Google Play'}</button>}
      </div>
    </main>
  )
}

export default UpdateGate
