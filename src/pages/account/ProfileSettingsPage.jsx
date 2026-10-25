import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Camera, ChevronRight, Copy, Eye, EyeOff, Lock, Settings, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { accountService } from '../../services/accountService'
import { isValidFullName } from '../../services/profileService'
import { contactInfoMessage, scanContactInfo } from '../../utils/moderation'
import CityField from '../../components/CityField'
import ExactLocationPicker from '../../components/ExactLocationPicker'
import { placeService } from '../../services/placeService'
import { knowsPlace } from '../../data/cityCoordinates'
import { queryClient } from '../../lib/queryClient'
import RuleOneNotice from '../../components/RuleOneNotice'
import AccountSwitch from './AccountSwitch'
import './SettingsPage.css'

const splitName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}
const splitDate = (value) => {
  const [y = '', m = '', d = ''] = String(value || '').split('-')
  return { d, m, y }
}

/** Verifications as one row: how far along, and the way to Značke where each step is done. */
function VerificationRow() {
  const [progress, setProgress] = useState(null)
  useEffect(() => { accountService.verificationProgress().then(setProgress).catch(() => {}) }, [])
  const items = progress?.items || []
  const done = items.filter((item) => item.done).length
  return (
    <Link to="/account/znacke" className="st-row pe-verif" data-testid="profile-verifications">
      <span className="st-tile st-tile-orange" aria-hidden="true"><Award size={18} strokeWidth={2.2} /></span>
      <span className="st-text">
        <strong>Verifikacije</strong>
        <span>{progress ? (done === items.length ? 'Sve urađeno' : `${done} od ${items.length} urađeno`) : 'Učitavam…'}</span>
        {progress && <span className="pe-verif-bar" aria-hidden="true"><span style={{ width: `${progress.percent}%` }} /></span>}
      </span>
      <ChevronRight size={18} className="st-chevron" />
    </Link>
  )
}

const GOAL_LABEL = { client: 'Klijent', provider: 'Izvođač', both: 'Klijent i izvođač' }

function ProfileSettingsPage() {
  const { user, updateProfile } = useAuth()
  const { profile, saveProfile, openAvatarPicker, uploadingAvatar } = useAccount()
  const [form, setForm] = useState(() => ({
    ...splitName(profile.full_name),
    city: profile.city || '',
    bio: profile.bio || '',
    taxId: profile.tax_id || '',
    ...splitDate(profile.birth_date),
    accountType: profile.account_type || 'client',
  }))
  const [showTax, setShowTax] = useState(false)
  const [taxFocused, setTaxFocused] = useState(false)
  const [showId, setShowId] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  // exact location (street and number or GPS): private, used for distance to jobs; saved with the form
  const [exact, setExact] = useState(null)
  const [exactTouched, setExactTouched] = useState(false)
  useEffect(() => {
    let live = true
    placeService.myLocation(user.id).then((row) => {
      if (live && row) setExact({ address: row.address, lat: row.lat, lng: row.lng, accuracy: row.accuracy_m, source: row.source })
    }).catch(() => {})
    return () => { live = false }
  }, [user.id])

  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
  const shownName = [form.firstName.trim(), form.lastName.trim() && `${form.lastName.trim().charAt(0).toUpperCase()}.`].filter(Boolean).join(' ')
  const nameOk = fullName === '' || isValidFullName(fullName)
  const bioScan = useMemo(() => scanContactInfo(form.bio), [form.bio])
  const nameScan = useMemo(() => scanContactInfo(fullName), [fullName])
  const birthDate = form.y && form.m && form.d ? `${form.y.padStart(4, '0')}-${form.m.padStart(2, '0')}-${form.d.padStart(2, '0')}` : ''
  const birthOk = !birthDate || (!Number.isNaN(Date.parse(birthDate)) && new Date(birthDate) < new Date())
  const taxOk = !form.taxId || /^\d{13}$/.test(form.taxId.replace(/\s+/g, ''))
  const canSave = nameOk && bioScan.clean && nameScan.clean && birthOk && taxOk && fullName.length > 0

  const set = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const saved = await saveProfile({
        full_name: fullName,
        city: form.city,
        bio: form.bio,
        tax_id: form.taxId,
        birth_date: birthDate || null,
        account_type: form.accountType,
      })
      updateProfile({ user_metadata: { ...user.user_metadata, full_name: saved.full_name, city: saved.city, phone: saved.phone } })
      if (exactTouched) {
        try {
          if (exact) await placeService.setMyLocation(exact)
          else await placeService.clearMyLocation()
          setExactTouched(false)
          queryClient.invalidateQueries({ queryKey: ['me', user.id] })
        } catch (locationError) {
          setError(`Profil je sačuvan, ali tačna lokacija nije: ${locationError.message}`)
          return
        }
      }
      setMessage('Profil je sačuvan.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const copyId = async () => {
    try { await navigator.clipboard.writeText(profile.member_id); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }

  const GOALS = [
    { value: 'client', title: 'Završiti poslove', text: 'Objavljujem poslove i biram izvođače' },
    { value: 'provider', title: 'Zaraditi novac', text: 'Radim poslove za druge' },
    { value: 'both', title: 'Oboje', text: 'I objavljujem i radim poslove' },
  ]

  return (
    <div className="account-section pe">
      <div className="account-section-head"><h1>Profil</h1></div>
      <AccountSwitch />

      {/* how others see you, live while typing; the photo changes with one tap */}
      <section className="pe-card pe-hero" aria-label="Ovako te drugi vide">
        <button type="button" className="pe-hero-avatar" onClick={openAvatarPicker} disabled={uploadingAvatar} aria-label={profile.avatar_url ? 'Promijeni profilnu sliku' : 'Dodaj profilnu sliku'}>
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={34} strokeWidth={1.6} />}
          <span className="pe-hero-cam"><Camera size={14} /></span>
        </button>
        <div className="pe-hero-text">
          <strong>{shownName || 'Tvoje ime'}</strong>
          <span>{[form.city, GOAL_LABEL[form.accountType]].filter(Boolean).join(' · ') || 'Dodaj mjesto'}</span>
          <Link to={`/korisnik/${user.id}`} className="pe-hero-link">Pogledaj javni profil <ChevronRight size={15} /></Link>
        </div>
      </section>
      <p className="pe-note">{uploadingAvatar ? 'Učitavam sliku…' : 'Jasna slika lica, bez brojeva telefona i natpisa.'}</p>

      <div className="st-group pe-verif-group"><VerificationRow /></div>

      <form className="pe-form" onSubmit={submit}>
        <h2 className="st-group-title">O tebi <small>vide svi</small></h2>
        <div className="pe-card">
          <div className="pe-grid">
            <label className="account-field">
              <span>Ime*</span>
              <input value={form.firstName} onChange={set('firstName')} required autoComplete="given-name" />
            </label>
            <label className="account-field">
              <span>Prezime*</span>
              <input value={form.lastName} onChange={set('lastName')} required autoComplete="family-name" />
            </label>
            <small className={`pe-span ${!nameOk ? 'is-error' : 'pe-hint'}`}>{!nameOk ? 'Pravo ime i prezime, samo slova.' : `Drugi te vide kao ${shownName || '—'}`}</small>
          </div>
          <div className="account-field">
            <span>Mjesto</span>
            <CityField id="acc-city" value={form.city} onChange={(city) => setForm((current) => ({ ...current, city }))} onAddress={(next) => { setExact(next); setExactTouched(true) }} label="Mjesto ili adresa" />
            {(knowsPlace(form.city) || exact) && (
              <ExactLocationPicker
                town={form.city}
                value={exact}
                onChange={(next) => { setExact(next); setExactTouched(true) }}
                openLabel="Dodaj svoju tačnu lokaciju (opciono)"
                placeholder="Ulica i broj, npr. Ilirska 67"
                hint="Tvoju tačnu lokaciju niko ne vidi. Koristimo je samo da izračunamo koliko si daleko od poslova (zaokruženo na oko 1 km) i da ti pokažemo poslove blizu tebe. Sačuvaj promjene da se primijeni."
              />
            )}
          </div>
          <label className="account-field">
            <span>O meni</span>
            <textarea id="o-meni" value={form.bio} onChange={set('bio')} rows={5} maxLength={1000} placeholder="Ko si, šta radiš i koliko dugo. Kratko i jasno." />
            <small className={!bioScan.clean ? 'is-error' : 'pe-count'}>{!bioScan.clean ? contactInfoMessage(bioScan, 'opis') : `${form.bio.length} / 1000`}</small>
          </label>
          <RuleOneNotice compact />
        </div>

        <h2 className="st-group-title">Šta želiš na Zadatku?</h2>
        <div className="pe-choices" role="radiogroup" aria-label="Glavni cilj">
          {GOALS.map((goal) => (
            <label key={goal.value} className={`pe-choice ${form.accountType === goal.value ? 'is-on' : ''}`}>
              <input type="radio" name="accountType" value={goal.value} checked={form.accountType === goal.value} onChange={() => setForm((current) => ({ ...current, accountType: goal.value }))} />
              <span><strong>{goal.title}</strong><small>{goal.text}</small></span>
            </label>
          ))}
        </div>

        <h2 className="st-group-title">Privatno <small><Lock size={11} /> vidiš samo ti</small></h2>
        <div className="pe-card">
          <div className="account-field">
            <span>Datum rođenja</span>
            <div className="account-date">
              <input value={form.d} onChange={set('d')} placeholder="DD" inputMode="numeric" maxLength={2} aria-label="Dan" />
              <input value={form.m} onChange={set('m')} placeholder="MM" inputMode="numeric" maxLength={2} aria-label="Mjesec" />
              <input value={form.y} onChange={set('y')} placeholder="GGGG" inputMode="numeric" maxLength={4} aria-label="Godina" />
            </div>
            {!birthOk && <small className="is-error">Provjeri datum.</small>}
          </div>
          <label className="account-field">
            <span>JMBG / JIB (opciono)</span>
            <div className="account-secret">
              <input
                value={showTax || taxFocused ? form.taxId : form.taxId.replace(/\d(?=\d{4})/g, '•')}
                onChange={set('taxId')}
                onFocus={() => setTaxFocused(true)}
                onBlur={() => setTaxFocused(false)}
                inputMode="numeric"
                maxLength={13}
                placeholder="13 cifara"
              />
              <button type="button" onClick={() => setShowTax((v) => !v)} aria-label={showTax ? 'Sakrij' : 'Prikaži'}>{showTax ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
            <small className={!taxOk ? 'is-error' : ''}>{!taxOk ? 'JMBG / JIB ima tačno 13 cifara.' : 'Samo za verifikaciju i isplate. Nikad se ne prikazuje.'}</small>
          </label>
          <div className="account-field">
            <span>Tvoj privatni ID</span>
            <div className="pe-id">
              <code>{showId ? profile.member_id : 'PB-••••-••••'}</code>
              <button type="button" onClick={() => setShowId((v) => !v)}>{showId ? <EyeOff size={14} /> : <Eye size={14} />} {showId ? 'Sakrij' : 'Prikaži'}</button>
              <button type="button" onClick={copyId} disabled={!showId}><Copy size={14} /> {copied ? 'Kopirano' : 'Kopiraj'}</button>
            </div>
            <small>Vidiš ga samo ti i podrška. Ne dijeli ga.</small>
          </div>
        </div>

        <div className="pe-save">
          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}
          <button type="submit" className="primary-button" disabled={saving || !canSave}>{saving ? 'Čuvam…' : 'Sačuvaj promjene'}</button>
        </div>
      </form>

      <Link to="/account/postavke" replace className="pe-elsewhere">
        <Settings size={16} />
        <span>Email, telefon, lozinka i brisanje naloga su u <strong>Postavkama</strong></span>
        <ChevronRight size={16} />
      </Link>
    </div>
  )
}

export default ProfileSettingsPage
