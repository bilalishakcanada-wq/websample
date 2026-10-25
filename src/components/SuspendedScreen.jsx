import { useEffect, useState } from 'react'
import { ShieldBan } from 'lucide-react'
import BrandMark from './BrandMark'
import { useAuth } from '../context/AuthContext'
import { appConfig } from '../config/appConfig'
import { formatBosnianDate } from '../utils/dateFormat'
import './SuspendedScreen.css'

const pad = (value) => String(value).padStart(2, '0')

/** The only screen a suspended account sees: how long the ban still runs, and a way to sign out. */
function SuspendedScreen() {
  const { suspension, refreshSuspension, logout } = useAuth()
  const [now, setNow] = useState(() => Date.now())
  const until = suspension?.until ?? null
  const left = until === null ? null : Math.max(0, until - now)

  useEffect(() => {
    if (until === null) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [until])

  // at zero the server is asked again; this device's clock may run a little ahead, so it keeps asking
  const over = left === 0
  useEffect(() => {
    if (!over) return undefined
    refreshSuspension()
    const timer = window.setInterval(refreshSuspension, 10000)
    return () => window.clearInterval(timer)
  }, [over, refreshSuspension])

  const seconds = Math.ceil((left ?? 0) / 1000)
  const parts = [
    [Math.floor(seconds / 86400), 'dana'],
    [pad(Math.floor((seconds % 86400) / 3600)), 'sati'],
    [pad(Math.floor((seconds % 3600) / 60)), 'minuta'],
    [pad(seconds % 60), 'sekundi'],
  ]

  return (
    <main className="suspended-shell">
      <div className="suspended-logo">
        <BrandMark size={42} className="brand-mark" />
        <span className="brand-name">{appConfig.appName}</span>
      </div>
      <div className="suspended-card">
        <span className="suspended-icon" aria-hidden="true"><ShieldBan size={34} /></span>
        <h1>{until === null ? 'Nalog je trajno suspendovan' : 'Nalog je privremeno suspendovan'}</h1>
        {suspension?.reason && <p className="suspended-reason">{suspension.reason}</p>}
        {until === null ? (
          <p className="suspended-note">Ova suspenzija nema datum isteka.</p>
        ) : (
          <>
            <p className="suspended-note">Zadatak ćeš moći ponovo koristiti za:</p>
            <div className="suspended-timer" role="timer" aria-live="off" aria-label={`Preostalo: ${parts.map(([value, unit]) => `${Number(value)} ${unit}`).join(', ')}`}>
              {parts.map(([value, unit]) => (
                <span key={unit} className="suspended-unit"><strong>{value}</strong><small>{unit}</small></span>
              ))}
            </div>
            <p className="suspended-end">Traje do {formatBosnianDate(until)} u {pad(new Date(until).getHours())}:{pad(new Date(until).getMinutes())}</p>
          </>
        )}
        <button type="button" className="ghost-button suspended-logout" onClick={logout}>Odjavi se</button>
      </div>
    </main>
  )
}

export default SuspendedScreen
