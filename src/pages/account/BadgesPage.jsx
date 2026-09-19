import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Car, CheckCircle2, Clock, CreditCard, Droplets, Flame, HardHat, IdCard, Phone, ShieldCheck, Thermometer, Zap } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { accountService, LICENCES } from '../../services/accountService'
import { formatBosnianPhone, isValidBosnianPhone, digitsOnly } from '../../utils/phone'
import { withBase } from '../../utils/paths'

const LICENCE_ICON = { electrician: Zap, plumber: Droplets, gas: Flame, hvac: Thermometer, construction: HardHat, driver: Car }

function VerificationMeter({ progress }) {
  if (!progress) return null
  return (
    <div className="verif-meter">
      <span>Tvoje verifikacije su {progress.percent}% završene</span>
      <div className="verif-meter-bar"><span style={{ width: `${progress.percent}%` }} /></div>
    </div>
  )
}

/** One badge row: icon, title, text, and the action on the right (Dodaj / Na čekanju / ✓). */
function BadgeRow({ icon: Icon, title, text, state, onAdd, addLabel = 'Dodaj', children }) {
  return (
    <div className={`badge-row-item state-${state}`}>
      <span className="badge-row-icon"><Icon size={20} />{state === 'done' && <CheckCircle2 size={12} className="badge-row-tick" />}</span>
      <div className="badge-row-text">
        <strong>{title}</strong>
        <p>{text}</p>
        {children}
      </div>
      <div className="badge-row-action">
        {state === 'done' && <span className="badge-state done"><CheckCircle2 size={14} /> Aktivna</span>}
        {state === 'pending' && <span className="badge-state pending"><Clock size={14} /> Na čekanju</span>}
        {state === 'todo' && <button type="button" className="badge-add" onClick={onAdd}>{addLabel}</button>}
      </div>
    </div>
  )
}

function BadgesPage() {
  const { user } = useAuth()
  const { profile, bundle, reload } = useAccount()
  const [progress, setProgress] = useState(null)
  const [requests, setRequests] = useState([])
  const [uploadFor, setUploadFor] = useState(null) // { kind, licenceType }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [phoneStep, setPhoneStep] = useState('idle') // idle | code
  const [phone, setPhone] = useState(formatBosnianPhone(profile.phone || ''))
  const [code, setCode] = useState('')
  const fileRef = useRef(null)

  const badgeCodes = useMemo(() => new Set((bundle?.badges || []).map((badge) => badge.code)), [bundle])

  const refresh = () => Promise.all([accountService.verificationProgress().then(setProgress), accountService.listMyVerifications(user.id).then(setRequests)])
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stateFor = (badgeCode, kind, licenceType = null) => {
    if (badgeCodes.has(badgeCode)) return 'done'
    if (requests.some((row) => row.kind === kind && (licenceType == null || row.licence_type === licenceType) && row.status === 'pending')) return 'pending'
    return 'todo'
  }

  const startUpload = (kind, licenceType = null) => {
    setUploadFor({ kind, licenceType })
    setError('')
    setMessage('')
    window.setTimeout(() => fileRef.current?.click(), 0)
  }

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !uploadFor) return
    setBusy(true)
    try {
      await accountService.requestVerification({ userId: user.id, kind: uploadFor.kind, licenceType: uploadFor.licenceType, file })
      setMessage('Dokument je poslan. Tim ga pregleda — značka se dodaje čim bude odobren.')
      await refresh()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
      setUploadFor(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const toE164 = (value) => {
    const digits = digitsOnly(value)
    if (digits.startsWith('387')) return `+${digits}`
    if (digits.startsWith('00387')) return `+${digits.slice(2)}`
    return `+387${digits.replace(/^0/, '')}`
  }

  const sendCode = async () => {
    setError('')
    if (!isValidBosnianPhone(phone) || !phone) { setError('Unesi ispravan BiH broj, npr. 061 234 567.'); return }
    setBusy(true)
    try { await accountService.sendPhoneCode(toE164(phone)); setPhoneStep('code'); setMessage('Kod je poslan SMS-om.') } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  const confirmCode = async () => {
    setError('')
    setBusy(true)
    try {
      await accountService.verifyPhoneCode(toE164(phone), code.trim())
      setMessage('Telefon je verifikovan — značka je dodana.')
      setPhoneStep('idle')
      await reload()
      await refresh()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-section">
      <div className="account-section-head">
        <h1>Značke</h1>
        <VerificationMeter progress={progress} />
      </div>
      <p>Značke pomažu drugima da budu sigurni ko si i šta znaš. Što ih više skupiš, to će ti klijenti i izvođači više vjerovati.</p>
      <p className="muted-text">Značka se dodjeljuje automatski kad je uslov ispunjen — zelena kvačica znači da je verifikacija trenutno aktivna. <Link to="/pravila-zajednice">Saznaj više</Link></p>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden onChange={onFile} />
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <h3 className="account-sub">Značke identiteta</h3>
      <div className="badge-grid">
        <BadgeRow icon={ShieldCheck} title="Uvjerenje o nekažnjavanju" text="Umiri druge članove — priloži važeće uvjerenje o nekažnjavanju (MUP / sud)." state={stateFor('police_check', 'police_check')} onAdd={() => startUpload('police_check')} />
        <BadgeRow icon={CreditCard} title="Način plaćanja verifikovan" text="Dodaj podatke za primanje uplata (IBAN) u Načinima plaćanja." state={stateFor('payment_verified', '__none__')} onAdd={() => { window.location.assign(withBase('/account/nacini-placanja')) }} addLabel="Dodaj" />
        <BadgeRow icon={Phone} title="Telefon verifikovan" text="Potvrdi broj SMS kodom — dobijaš trenutne obavijesti o poslovima." state={stateFor('mobile_verified', '__none__')} onAdd={() => setPhoneStep('phone')}>
          {phoneStep !== 'idle' && badgeCodes.has('mobile_verified') === false && (
            <div className="phone-verify">
              <input value={phone} onChange={(event) => setPhone(formatBosnianPhone(event.target.value))} placeholder="061 234 567" inputMode="tel" disabled={phoneStep === 'code'} />
              {phoneStep === 'phone' && <button type="button" className="primary-button" onClick={sendCode} disabled={busy}>{busy ? 'Šaljem…' : 'Pošalji kod'}</button>}
              {phoneStep === 'code' && (
                <>
                  <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-cifreni kod" inputMode="numeric" maxLength={6} />
                  <button type="button" className="primary-button" onClick={confirmCode} disabled={busy || code.trim().length < 4}>{busy ? 'Provjeravam…' : 'Potvrdi'}</button>
                </>
              )}
            </div>
          )}
        </BadgeRow>
        <BadgeRow icon={IdCard} title="Lična karta verifikovana" text="Slikaj ličnu kartu ili pasoš — tim provjerava da li se podaci slažu sa profilom." state={stateFor('id_verified', 'identity')} onAdd={() => startUpload('identity')} />
      </div>

      <h3 className="account-sub">Značke licenci</h3>
      <div className="badge-grid">
        {LICENCES.map(({ type, label, text }) => (
          <BadgeRow key={type} icon={LICENCE_ICON[type]} title={label} text={text} state={stateFor(`licence_${type}`, 'licence', type)} onAdd={() => startUpload('licence', type)} />
        ))}
      </div>

      <h3 className="account-sub">Značke aktivnosti</h3>
      <p className="muted-text">Ove se dobijaju kroz rad na platformi — recenzije, završeni poslovi, brzina odgovora. Dodjeljuju se automatski.</p>
      <div className="badge-grid">
        {(bundle?.badges || []).filter((badge) => !['mobile_verified', 'id_verified', 'police_check', 'payment_verified'].includes(badge.code) && !badge.code.startsWith('licence_')).map((badge) => (
          <BadgeRow key={badge.code} icon={CheckCircle2} title={badge.label} text={badge.description} state="done" />
        ))}
        {(bundle?.badges || []).filter((badge) => !['mobile_verified', 'id_verified', 'police_check', 'payment_verified'].includes(badge.code) && !badge.code.startsWith('licence_')).length === 0 && (
          <p className="muted-text">Još nema značaka aktivnosti — prva stiže sa prvim završenim poslom.</p>
        )}
      </div>
    </div>
  )
}

export default BadgesPage
