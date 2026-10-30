import { useState } from 'react'
import { PauseCircle } from 'lucide-react'
import BrandMark from './BrandMark'
import { useAuth } from '../context/AuthContext'
import { appConfig } from '../config/appConfig'
import { formatBosnianDate } from '../utils/dateFormat'
import './SuspendedScreen.css'

/** The only screen a deactivated account sees (Postavke > Zatvori nalog): one button brings it back. */
function DeactivatedScreen() {
  const { deactivation, closeAccount, logout } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reactivate = async () => {
    setBusy(true); setError('')
    try { await closeAccount('reactivate') } catch (requestError) { setError(requestError.message); setBusy(false) }
  }

  return (
    <main className="suspended-shell">
      <div className="suspended-logo">
        <BrandMark size={42} className="brand-mark" />
        <span className="brand-name">{appConfig.appName}</span>
      </div>
      <div className="suspended-card" data-testid="deactivated-screen">
        <span className="suspended-icon update-icon" aria-hidden="true"><PauseCircle size={34} /></span>
        <h1>Nalog je deaktiviran</h1>
        <p className="suspended-note">
          {deactivation?.since ? `Deaktivirao/la si ga ${formatBosnianDate(deactivation.since).replace(/\.$/, '')}. ` : ''}
          Profil i oglasi se ne vide drugima. Kad ga ponovo aktiviraš, oglasi ostaju pauzirani dok ih sam/a ne objaviš.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="button" className="ap-btn ap-btn-primary suspended-logout" onClick={reactivate} disabled={busy} data-testid="reactivate-account">
          {busy ? 'Aktiviram…' : 'Ponovo aktiviraj nalog'}
        </button>
        <button type="button" className="ghost-button suspended-logout" onClick={logout}>Odjavi se</button>
      </div>
    </main>
  )
}

export default DeactivatedScreen
