import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { accountService } from '../../services/accountService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { currentSubscription, disablePush, enablePush, pushNeedsInstall, pushPermission, pushSupported } from '../../utils/push'

const EVENT_LABEL = { masked: 'Uklonjen kontakt iz teksta', removed: 'Uklonjena slika sa kontaktom', flagged: 'Označeno za pregled', suspended: 'Nalog suspendovan', lifted: 'Suspenzija ukinuta' }

function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { profile, bundle, saveProfile } = useAccount()
  const [notifyEmail, setNotifyEmail] = useState(profile.notify_email !== false)
  const [notifyPush, setNotifyPush] = useState(profile.notify_push !== false)
  const [device, setDevice] = useState('loading') // 'on' | 'off' | 'blocked' | 'install' | 'unsupported'
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (!pushSupported()) { setDevice(pushNeedsInstall() ? 'install' : 'unsupported'); return }
    if (pushPermission() === 'denied') { setDevice('blocked'); return }
    currentSubscription().then((sub) => setDevice(sub ? 'on' : 'off'))
  }, [])

  const toggleDevice = async () => {
    setBusy('device'); setError('')
    try {
      if (device === 'on') { await disablePush(); setDevice('off') }
      else { const result = await enablePush(); setDevice(result === 'granted' ? 'on' : result === 'denied' ? 'blocked' : device) }
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const savePrefs = async () => {
    setBusy('prefs'); setError(''); setMessage('')
    try { await saveProfile({ notify_email: notifyEmail, notify_push: notifyPush }); setMessage('Postavke obavijesti su sačuvane.') } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    setBusy('pw'); setError(''); setMessage('')
    try { await accountService.changePassword(password); setPassword(''); setMessage('Lozinka je promijenjena.') } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  const isOAuth = (user.app_metadata?.providers || []).some((provider) => provider !== 'email')
  useEffect(() => {
    const id = window.location.hash.replace('#', '')
    if (!id) return undefined
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Postavke</h1></div>

      <h3 className="account-sub">Obavijesti</h3>
      <div className="settings-rows">
        <label className="settings-row"><div><strong>Email obavijesti</strong><span>Nove ponude, poruke i značke na email.</span></div><input type="checkbox" checked={notifyEmail} onChange={(event) => setNotifyEmail(event.target.checked)} /></label>
        <label className="settings-row"><div><strong>Push obavijesti</strong><span>Nove ponude, poruke i isplate — i kad aplikacija nije otvorena.</span></div><input type="checkbox" checked={notifyPush} onChange={(event) => setNotifyPush(event.target.checked)} /></label>
        <div className="settings-row settings-row-device">
          <div>
            <strong><BellRing size={15} /> Ovaj uređaj</strong>
            <span>
              {device === 'on' && 'Prima obavijesti.'}
              {device === 'off' && 'Još ne prima obavijesti — uključi ih ovdje.'}
              {device === 'blocked' && 'Obavijesti su blokirane u pregledniku. Dozvoli ih u postavkama sajta pa pokušaj ponovo.'}
              {device === 'install' && 'Na iPhoneu prvo dodaj Poso.ba na početni ekran (Dijeli → Dodaj na početni ekran), pa uključi obavijesti ovdje.'}
              {device === 'unsupported' && 'Ovaj preglednik ne podržava push obavijesti.'}
              {device === 'loading' && '…'}
            </span>
          </div>
          {(device === 'on' || device === 'off') && (
            <button type="button" className={device === 'on' ? 'ghost-button' : 'primary-button'} onClick={toggleDevice} disabled={busy === 'device'}>{busy === 'device' ? '…' : device === 'on' ? 'Isključi' : 'Uključi'}</button>
          )}
        </div>
        <button type="button" className="primary-button" onClick={savePrefs} disabled={busy === 'prefs'}>{busy === 'prefs' ? 'Čuvam…' : 'Sačuvaj'}</button>
      </div>

      <h3 className="account-sub">Prijava</h3>
      <div className="settings-rows">
        <div className="settings-row"><div><strong>Email</strong><span>{user.email}</span></div></div>
        {isOAuth ? (
          <div className="settings-row"><div><strong>Lozinka</strong><span>Prijavljuješ se preko Google naloga — lozinka se mijenja kod Googlea.</span></div></div>
        ) : (
          <form className="settings-row" id="lozinka" onSubmit={changePassword}>
            <div><strong>Nova lozinka</strong><span>Najmanje 8 znakova.</span></div>
            <div className="settings-inline"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" /><button type="submit" className="ghost-button" disabled={busy === 'pw' || password.length < 8}>Promijeni</button></div>
          </form>
        )}
        <div className="settings-row"><div><strong>Odjava</strong><span>Odjavi se sa ovog uređaja.</span></div><button type="button" className="ghost-button" onClick={async () => { await logout(); navigate('/') }}><LogOut size={15} /> Odjavi se</button></div>
      </div>

      <h3 className="account-sub">Pravilo #1 — istorija</h3>
      <div className="settings-rows">
        <div className="settings-row">
          <div>
            <strong>{(bundle?.events || []).length === 0 ? 'Nema zabilježenih kršenja' : `${bundle.strikes} aktivnih u zadnjih 30 dana`}</strong>
            <span>Kod 3 kršenja nalog se suspenduje na 7 dana.</span>
            {(bundle?.events || []).length > 0 && (
              <ul className="moderation-history">
                {bundle.events.map((event) => <li key={event.id}><span className={`tag tag-${event.action}`}>{EVENT_LABEL[event.action] || event.action}</span><span>{formatBosnianDate(event.created_at)}</span>{event.snippet && <em>{event.snippet}</em>}</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}
    </div>
  )
}

export default SettingsPage
