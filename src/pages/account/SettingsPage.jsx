import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, Ban, BellRing, ChevronRight, KeyRound, ListChecks, LocateFixed, LogOut, Mail, MapPin, Navigation, Phone, Radio, Settings, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { accountService } from '../../services/accountService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { useBlocks } from '../../hooks/useBlocks'
import { useNotificationSwitches } from '../../hooks/useNotificationSwitches'
import { isLiveReachOn, LIVE_REACH_REPORTED, setLiveReach } from '../../utils/liveReach'
import { isJobShareAuto, setJobShareAuto } from '../../utils/jobShare'
import { locationPermission, openAppSettings, requestLocation } from '../../utils/permissions'
import { isNativeApp } from '../../utils/native'
import { backgroundLocationSupported } from '../../utils/location'
import { toast } from '../../components/Toaster'
import PhoneVerify from '../../components/PhoneVerify'
import { formatBosnianPhone } from '../../utils/phone'
import AccountSwitch from './AccountSwitch'
import './SettingsPage.css'

const EVENT_LABEL = { masked: 'Uklonjen kontakt iz teksta', removed: 'Uklonjena slika sa kontaktom', flagged: 'Označeno za pregled', suspended: 'Nalog suspendovan', lifted: 'Suspenzija ukinuta' }

/** A row like WhatsApp's settings: coloured icon tile, title, one line under it, and a control on the right. */
function Row({ icon: Icon, tone = 'blue', title, sub, children, testid, as: Tag = 'div', ...rest }) {
  return (
    <Tag className="st-row" data-testid={testid} {...rest}>
      <span className={`st-tile st-tile-${tone}`} aria-hidden="true"><Icon size={18} strokeWidth={2.2} /></span>
      <span className="st-text">
        <strong>{title}</strong>
        {sub && <span>{sub}</span>}
      </span>
      {children}
    </Tag>
  )
}

/** The switch itself: role="switch", so a screen reader says "uključeno / isključeno". */
function Switch({ on, onChange, disabled, label, testid }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`st-switch${on ? ' is-on' : ''}`} onClick={onChange} disabled={disabled} data-testid={testid}>
      <span />
    </button>
  )
}

const GEO_TEXT = {
  granted: ['Dozvoljeno', 'ok'],
  prompt: ['Nije uključeno', 'warn'],
  denied: ['Blokirano', 'bad'],
  unsupported: ['Nije dostupno', 'muted'],
  loading: ['…', 'muted'],
}

function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { profile, bundle, saveProfile, reload } = useAccount()
  const notif = useNotificationSwitches({ profile, saveProfile })
  const { notifyEmail, notifyPush, device, deviceOn } = notif
  const [password, setPassword] = useState('')
  const [verifyPhone, setVerifyPhone] = useState(false)
  const { blocked, toggle: toggleBlockUser } = useBlocks()
  // Lokacija uživo: the distance to jobs follows where the person is right now (utils/liveReach.js)
  const [live, setLive] = useState(isLiveReachOn)
  const [jobShare, setJobShare] = useState(isJobShareAuto)
  const [geo, setGeo] = useState('loading') // 'granted' | 'denied' | 'prompt' | 'unsupported'
  const [lastPoint, setLastPoint] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  // a long page: what went wrong (or right) shows as a toast where the person is looking
  useEffect(() => { if (error) toast(error, { kind: 'error', duration: 5200 }) }, [error])
  useEffect(() => { if (notif.error) toast(notif.error, { kind: 'error', duration: 5200 }) }, [notif.error])
  useEffect(() => { if (message) toast(message, { kind: 'success' }) }, [message])

  // back from the phone's settings: the permission may have changed there
  const { recheckDevice } = notif
  const recheck = useCallback(() => {
    locationPermission().then(setGeo)
    recheckDevice()
  }, [recheckDevice])
  useEffect(() => {
    recheck()
    const reported = (event) => setLastPoint(event.detail)
    const onVisible = () => { if (document.visibilityState === 'visible') recheck() }
    window.addEventListener(LIVE_REACH_REPORTED, reported)
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener(LIVE_REACH_REPORTED, reported); window.removeEventListener('focus', recheck); document.removeEventListener('visibilitychange', onVisible) }
  }, [recheck])

  const geoOk = geo === 'granted'
  const liveOn = live && geoOk
  const connectLocation = async () => {
    setError('')
    if (geo === 'denied') {
      if (!(await openAppSettings())) setError('Dozvoli lokaciju za Zadatak u postavkama preglednika (katanac lijevo od adrese), pa se vrati ovdje.')
      return
    }
    setBusy('geo')
    try { setGeo(await requestLocation()) } finally { setBusy('') }
  }
  const toggleLive = async () => {
    setError('')
    if (liveOn) { setLiveReach(false); setLive(false); return }
    setBusy('live')
    try {
      const state = geoOk ? 'granted' : await requestLocation()
      setGeo(state)
      if (state === 'granted') { setLiveReach(true); setLive(true) }
      else if (state === 'denied') setError('Lokacija je blokirana za Zadatak. Dodirni „Otvori“ kod Pristupa lokaciji i dozvoli je.')
    } finally { setBusy('') }
  }
  const toggleJobShare = async () => {
    setError('')
    if (jobShare) { setJobShareAuto(false); setJobShare(false); return }
    if (!geoOk) {
      setBusy('job')
      try {
        const state = await requestLocation()
        setGeo(state)
        if (state !== 'granted') { setError('Za ovo prvo dozvoli lokaciju.'); return }
      } finally { setBusy('') }
    }
    setJobShareAuto(true); setJobShare(true)
  }

  // like WhatsApp: a switch saves the moment it moves, there is no "Sačuvaj" (hooks/useNotificationSwitches.js)

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

  const [geoLabel, geoTone] = GEO_TEXT[geo] || GEO_TEXT.loading
  const deviceSub = {
    on: notifyPush ? 'Ovaj telefon prima obavijesti, i kad je Zadatak zatvoren.' : 'Ugašeno, jer su push obavijesti isključene. Uključi da opet stižu.',
    off: 'Uključi da ti nova ponuda ili poruka stigne odmah.',
    blocked: isNativeApp() ? 'Isključene u postavkama telefona. Dodirni da ih otvoriš.' : 'Blokirane u pregledniku. Dozvoli ih za Zadatak (katanac lijevo od adrese).',
    install: 'Na iPhoneu prvo dodaj Zadatak na početni ekran (Dijeli → Dodaj na početni ekran).',
    unsupported: 'Ovaj preglednik ne podržava obavijesti. Stižu u zvono i na email.',
    native: 'Stižu u sljedećoj verziji aplikacije. Do tada ih vidiš u zvonu.',
    loading: 'Provjeravam…',
  }[device]

  return (
    <div className="account-section st">
      <div className="account-section-head"><h1>Postavke</h1></div>
      {verifyPhone && <PhoneVerify initialPhone={profile.phone || ''} onClose={() => setVerifyPhone(false)} onVerified={reload} />}

      <AccountSwitch />

      <h2 className="st-group-title" id="lokacija">Lokacija</h2>
      <div className="st-group">
        <Row icon={LocateFixed} tone="green" title="Pristup lokaciji" testid="geo-access"
          sub={geo === 'denied'
            ? (isNativeApp() ? 'Odbijeno na telefonu. Otvori postavke i dozvoli lokaciju za Zadatak.' : 'Blokirano u pregledniku.')
            : geo === 'unsupported' ? 'Ovaj uređaj ne zna lokaciju. Udaljenost se računa od grada iz profila.' : 'Po njoj vidiš koliko je koji posao daleko. Nije obavezna: mjesto možeš i upisati.'}>
          {geo === 'granted' || geo === 'unsupported' || geo === 'loading'
            ? <span className={`st-pill st-pill-${geoTone}`}>{geoLabel}</span>
            : <button type="button" className="st-action" onClick={connectLocation} disabled={busy === 'geo'}>{busy === 'geo' ? '…' : geo === 'denied' ? 'Otvori' : 'Dozvoli'}</button>}
        </Row>
        <Row icon={Radio} tone="green" testid="live-reach" title={<>Lokacija uživo {liveOn && <span className="live-dot" aria-hidden="true" />}</>}
          sub={liveOn
            ? `Udaljenost od poslova se računa od mjesta gdje si sada${backgroundLocationSupported() ? ', i kad je Zadatak u pozadini (na telefonu stoji obavijest)' : ', dok je Zadatak otvoren'}.${lastPoint ? ' Upravo osvježeno.' : ''}`
            : 'Kad je isključena, računamo od adrese ili grada iz profila.'}>
          <Switch on={liveOn} onChange={toggleLive} disabled={busy === 'live' || geo === 'loading' || geo === 'unsupported'} label="Lokacija uživo" testid="live-reach-toggle" />
        </Row>
        <Row icon={Navigation} tone="teal" testid="job-share" title="Dijeli tokom posla"
          sub={jobShare
            ? 'Kad klijent na prihvaćenom poslu zatraži gdje si, lokacija se dijeli sama. Samo njemu, najviše 2 sata ili dok ne stigneš.'
            : 'Kad klijent zatraži gdje si, pitamo te svaki put.'}>
          <Switch on={jobShare && geo !== 'denied'} onChange={toggleJobShare} disabled={busy === 'job' || geo === 'loading' || geo === 'unsupported'} label="Dijeli lokaciju tokom posla" testid="job-share-toggle" />
        </Row>
      </div>
      <p className="st-footnote">Lokaciju vidi samo klijent posla koji radiš, i samo dok ga dijeliš. Ostali vide samo grad.</p>

      <h2 className="st-group-title" id="obavijesti">Obavijesti</h2>
      <div className="st-group">
        <Row icon={Smartphone} tone="orange" title="Na ovom telefonu" sub={deviceSub} testid="device-push">
          {device === 'on' || device === 'off'
            ? <Switch on={deviceOn} onChange={notif.toggleDevice} disabled={notif.busy !== ''} label="Obavijesti na ovom telefonu" testid="device-push-toggle" />
            : device === 'blocked' && isNativeApp() ? <button type="button" className="st-action" onClick={notif.toggleDevice}><Settings size={14} /> Otvori</button> : null}
        </Row>
        <Row icon={BellRing} tone="red" title="Push obavijesti" sub="Ponude, poruke i plaćanja.">
          <Switch on={notifyPush} onChange={notif.togglePush} disabled={notif.busy !== ''} label="Push obavijesti" testid="notify-push-toggle" />
        </Row>
        <Row icon={Mail} tone="blue" title="Email obavijesti" sub={`Na ${user.email}`}>
          <Switch on={notifyEmail} onChange={notif.toggleEmail} disabled={notif.busy !== ''} label="Email obavijesti" testid="notify-email-toggle" />
        </Row>
        <Row as={Link} to="/account/postavke-obavijesti" icon={ListChecks} tone="purple" title="Šta ti javljamo" sub="Ponude i poslovi, poruke, plaćanja, alarmi">
          <ChevronRight size={18} className="st-chevron" />
        </Row>
      </div>

      <h2 className="st-group-title">Račun</h2>
      <div className="st-group">
        <Row icon={Mail} tone="blue" title="Email" sub={user.email} />
        <Row as="button" type="button" icon={Phone} tone="green" testid="phone-verify-row" id="telefon" onClick={() => setVerifyPhone(true)}
          title="Broj telefona"
          sub={profile.phone_verified_at
            ? <>{formatBosnianPhone(profile.phone)} <span className="st-verified"><BadgeCheck size={14} /> Potvrđen SMS kodom</span></>
            : profile.phone ? `${formatBosnianPhone(profile.phone)} · još nije potvrđen` : 'Dodaj broj i potvrdi ga SMS kodom.'}>
          {profile.phone_verified_at
            ? <span className="st-change">Promijeni <ChevronRight size={18} className="st-chevron" /></span>
            : <span className="st-action" data-testid="phone-verify-open">Potvrdi</span>}
        </Row>
        {isOAuth ? (
          <Row icon={KeyRound} tone="gray" title="Lozinka" sub="Prijavljuješ se preko Google naloga, lozinka se mijenja kod Googlea." />
        ) : (
          <form className="st-row st-row-form" id="lozinka" onSubmit={changePassword}>
            <span className="st-tile st-tile-gray" aria-hidden="true"><KeyRound size={18} strokeWidth={2.2} /></span>
            <span className="st-text"><strong>Nova lozinka</strong><span>Najmanje 8 znakova.</span></span>
            <span className="st-inline">
              <input type="password" aria-label="Nova lozinka" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" />
              <button type="submit" className="st-action" disabled={busy === 'pw' || password.length < 8}>Promijeni</button>
            </span>
          </form>
        )}
        <Row as="button" type="button" icon={LogOut} tone="red" title={<span className="st-danger">Odjavi se</span>} sub="Sa ovog uređaja." onClick={async () => { await logout(); navigate('/') }} />
        <Row as={Link} to="/account/zatvori-nalog" icon={Trash2} tone="red" id="brisanje" testid="delete-account"
          title={<span className="st-danger">Deaktiviraj ili obriši nalog</span>} sub="Privremeno ili trajno. Potvrđuješ kodom s emaila.">
          <ChevronRight size={18} className="st-chevron" />
        </Row>
      </div>

      <h2 className="st-group-title" id="blokirani">Privatnost</h2>
      <div className="st-group">
        {blocked.length === 0 && (
          <Row icon={Ban} tone="gray" title="Blokirani korisnici" sub="Nikoga nisi blokirao/la. Blokiraš na profilu ili u razgovoru (meni ⋯)." />
        )}
        {blocked.map((person) => (
          <Row key={person.user_id} icon={Ban} tone="gray" title={<Link to={`/korisnik/${person.user_id}`}>{person.display_name}</Link>} sub={`Blokiran/a ${formatBosnianDate(person.created_at)}`}>
            <button type="button" className="st-action" disabled={busy === `unblock-${person.user_id}`} onClick={async () => {
              setBusy(`unblock-${person.user_id}`); setError(''); setMessage('')
              try { if (await toggleBlockUser(person.user_id, person.display_name)) setMessage('Korisnik je odblokiran.') } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
            }}>Odblokiraj</button>
          </Row>
        ))}
        <Row icon={ShieldCheck} tone="teal" title="Pravilo #1"
          sub={(bundle?.events || []).length === 0 ? 'Nema zabilježenih kršenja. Kod 3 kršenja nalog se suspenduje na 7 dana.' : `${bundle.strikes} aktivnih u zadnjih 30 dana. Kod 3 kršenja nalog se suspenduje na 7 dana.`} />
        {(bundle?.events || []).length > 0 && (
          <ul className="moderation-history st-history">
            {bundle.events.map((event) => <li key={event.id}><span className={`tag tag-${event.action}`}>{EVENT_LABEL[event.action] || event.action}</span><span>{formatBosnianDate(event.created_at)}</span>{event.snippet && <em>{event.snippet}</em>}</li>)}
          </ul>
        )}
      </div>

      <p className="st-footnote st-version"><MapPin size={12} /> Zadatak · Bosna i Hercegovina</p>
    </div>
  )
}

export default SettingsPage
