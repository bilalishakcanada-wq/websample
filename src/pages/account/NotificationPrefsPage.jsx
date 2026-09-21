import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { useAccount } from './AccountLayout'
import { currentSubscription, disablePush, enablePush, pushNeedsInstall, pushPermission, pushSupported } from '../../utils/push'
import { isNativeApp } from '../../utils/native'

const WHAT = [
  ['Ponude i poslovi', 'Nova ponuda, prihvaćena ponuda, pitanja uz tvoj posao'],
  ['Poruke', 'Nova poruka u razgovoru'],
  ['Plaćanja', 'Osigurana uplata, isplata, povrat'],
  ['Alarmi za poslove', 'Novi poslovi po tvojim ključnim riječima'],
]

/** "Postavke obavijesti": two switches (email, push), this device, and what you get notified about. */
function NotificationPrefsPage() {
  const { profile, saveProfile } = useAccount()
  const [notifyEmail, setNotifyEmail] = useState(profile.notify_email !== false)
  const [notifyPush, setNotifyPush] = useState(profile.notify_push !== false)
  const [device, setDevice] = useState('loading')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isNativeApp()) { setDevice('native'); return }
    if (!pushSupported()) { setDevice(pushNeedsInstall() ? 'install' : 'unsupported'); return }
    if (pushPermission() === 'denied') { setDevice('blocked'); return }
    currentSubscription().then((sub) => setDevice(sub ? 'on' : 'off'))
  }, [])

  const save = async (patch) => {
    setBusy('prefs'); setError('')
    try { await saveProfile(patch) } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }
  const toggleEmail = () => { const next = !notifyEmail; setNotifyEmail(next); save({ notify_email: next }) }
  const togglePush = () => { const next = !notifyPush; setNotifyPush(next); save({ notify_push: next }) }
  const toggleDevice = async () => {
    setBusy('device'); setError('')
    try {
      if (device === 'on') { await disablePush(); setDevice('off') }
      else { const result = await enablePush(); setDevice(result === 'granted' ? 'on' : result === 'denied' ? 'blocked' : device) }
    } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Postavke obavijesti</h1></div>

      <span className="account-eyebrow">Kanali</span>
      <div className="np-rows">
        <label className="np-row"><div><strong>Email</strong><span>Na {profile.email || 'tvoj email'}</span></div><input type="checkbox" role="switch" className="np-switch" checked={notifyEmail} onChange={toggleEmail} disabled={busy === 'prefs'} /></label>
        <label className="np-row"><div><strong>Push</strong><span>Na telefon, i kad aplikacija nije otvorena</span></div><input type="checkbox" role="switch" className="np-switch" checked={notifyPush} onChange={togglePush} disabled={busy === 'prefs'} /></label>
        <div className="np-row">
          <div>
            <strong><BellRing size={15} /> Ovaj uređaj</strong>
            <span>
              {device === 'on' && 'Prima push obavijesti.'}
              {device === 'off' && 'Još ne prima obavijesti.'}
              {device === 'blocked' && 'Blokirane u postavkama — dozvoli obavijesti za Poso.ba pa pokušaj ponovo.'}
              {device === 'install' && 'Na iPhoneu prvo dodaj Poso.ba na početni ekran, pa uključi ovdje.'}
              {device === 'unsupported' && 'Ovaj preglednik ne podržava push.'}
              {device === 'native' && 'Obavijesti u aplikaciji stižu u sljedećoj verziji — do tada ih vidiš u zvonu.'}
              {device === 'loading' && '…'}
            </span>
          </div>
          {(device === 'on' || device === 'off') && (
            <button type="button" className={`ap-btn ap-btn-inline ${device === 'on' ? 'ap-btn-light' : 'ap-btn-primary'}`} onClick={toggleDevice} disabled={busy === 'device'}>{device === 'on' ? 'Isključi' : 'Uključi'}</button>
          )}
        </div>
      </div>

      <span className="account-eyebrow">Šta ti javljamo</span>
      <div className="np-rows">
        {WHAT.map(([label, sub]) => (
          <div key={label} className="np-row"><div><strong>{label}</strong><span>{sub}</span></div><em>{[notifyEmail && 'Email', notifyPush && 'Push'].filter(Boolean).join(', ') || 'Isključeno'}</em></div>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  )
}

export default NotificationPrefsPage
