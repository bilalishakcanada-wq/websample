import { BellRing } from 'lucide-react'
import { useAccount } from './AccountLayout'
import { useNotificationSwitches } from '../../hooks/useNotificationSwitches'
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
  const { notifyEmail, notifyPush, device, deviceOn, busy, error, togglePush, toggleEmail, toggleDevice } = useNotificationSwitches({ profile, saveProfile })

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Postavke obavijesti</h1></div>

      <span className="account-eyebrow">Kanali</span>
      <div className="np-rows">
        <label className="np-row"><div><strong>Email</strong><span>Na {profile.email || 'tvoj email'}</span></div><input type="checkbox" role="switch" className="np-switch" checked={notifyEmail} onChange={toggleEmail} disabled={busy !== ''} /></label>
        <label className="np-row"><div><strong>Push</strong><span>Na telefon, i kad aplikacija nije otvorena</span></div><input type="checkbox" role="switch" className="np-switch" checked={notifyPush} onChange={togglePush} disabled={busy !== ''} /></label>
        <div className="np-row">
          <div>
            <strong><BellRing size={15} /> Ovaj uređaj</strong>
            <span>
              {device === 'on' && (notifyPush ? 'Prima push obavijesti.' : 'Ugašeno, jer je Push isključen.')}
              {device === 'off' && 'Još ne prima obavijesti.'}
              {device === 'blocked' && (isNativeApp() ? 'Isključene u postavkama telefona. Dodirni „Otvori“ i dozvoli ih.' : 'Blokirane u pregledniku. Dozvoli obavijesti za Zadatak (katanac lijevo od adrese) pa pokušaj ponovo.')}
              {device === 'install' && 'Na iPhoneu prvo dodaj Zadatak na početni ekran, pa uključi ovdje.'}
              {device === 'unsupported' && 'Ovaj preglednik ne podržava push.'}
              {device === 'native' && 'Obavijesti na telefonu stižu u sljedećoj verziji aplikacije. Do tada ih vidiš u zvonu.'}
              {device === 'loading' && '…'}
            </span>
          </div>
          {(device === 'on' || device === 'off') && (
            <button type="button" className={`ap-btn ap-btn-inline ${deviceOn ? 'ap-btn-light' : 'ap-btn-primary'}`} onClick={toggleDevice} disabled={busy !== ''}>{deviceOn ? 'Isključi' : 'Uključi'}</button>
          )}
          {device === 'blocked' && isNativeApp() && (
            <button type="button" className="ap-btn ap-btn-inline ap-btn-light" onClick={toggleDevice}>Otvori</button>
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
