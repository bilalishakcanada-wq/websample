import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Copy, Eye, EyeOff, Lock, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { accountService } from '../../services/accountService'
import { isValidFullName } from '../../services/profileService'
import { contactInfoMessage, scanContactInfo } from '../../utils/moderation'
import { formatBosnianPhone, isValidBosnianPhone } from '../../utils/phone'
import CityField from '../../components/CityField'
import ExactLocationPicker from '../../components/ExactLocationPicker'
import { placeService } from '../../services/placeService'
import { knowsPlace } from '../../data/cityCoordinates'
import { queryClient } from '../../lib/queryClient'
import RuleOneNotice from '../../components/RuleOneNotice'
import { withBase } from '../../utils/paths'
import { confirmDialog } from '../../utils/dialog'
import ProfileCardArt from '../../components/ProfileCardArt'

const splitName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}
const splitDate = (value) => {
  const [y = '', m = '', d = ''] = String(value || '').split('-')
  return { d, m, y }
}

// where each verification step is done (keys from my_verification_progress)
const STEP_LINKS = {
  email: '/account/informacije',
  mobile: '/account/znacke#mobile_verified',
  id: '/account/verifikacija',
  payment: '/account/nacini-placanja',
}

/** The real verification checks as a short list; each open step says where it is done. */
function ProfileSteps({ onPickAvatar }) {
  const [progress, setProgress] = useState(null)
  useEffect(() => { accountService.verificationProgress().then(setProgress) }, [])
  if (!progress) return null
  const items = progress.items || []
  const done = items.filter((item) => item.done).length
  const open = (item) => {
    if (item.key === 'avatar') return <button type="button" onClick={onPickAvatar}>Dodaj</button>
    if (item.key === 'bio') return <a href="#o-meni" onClick={(event) => { event.preventDefault(); const box = document.getElementById('o-meni'); box?.scrollIntoView({ behavior: 'smooth', block: 'center' }); box?.focus({ preventScroll: true }) }}>Napiši</a>
    return STEP_LINKS[item.key] ? <Link to={STEP_LINKS[item.key]}>Uradi</Link> : null
  }
  return (
    <section className="pe-steps" aria-label="Verifikacije">
      <div className="pe-steps-head">
        <h2>Verifikacije</h2>
        <span>{done} od {items.length}</span>
      </div>
      <div className="pe-steps-bar" aria-hidden="true"><span style={{ width: `${progress.percent}%` }} /></div>
      <ul>
        {items.map((item) => (
          <li key={item.key} className={item.done ? 'is-done' : ''}>
            {item.done ? <Check size={15} strokeWidth={2.4} /> : <span className="pe-step-dot" />}
            <span>{item.label}</span>
            {!item.done && open(item)}
          </li>
        ))}
      </ul>
    </section>
  )
}

const GOAL_LABEL = { client: 'Klijent', provider: 'Izvođač', both: 'Klijent i izvođač' }

function ProfileSettingsPage() {
  const { user, updateProfile, deleteAccount } = useAuth()
  const { profile, saveProfile, openAvatarPicker, uploadingAvatar } = useAccount()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState(() => ({
    ...splitName(profile.full_name),
    city: profile.city || '',
    phone: formatBosnianPhone(profile.phone || ''),
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
  const [deleting, setDeleting] = useState(false)
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

  // deep links from "Informacije o nalogu" (#telefon, #brisanje)
  useEffect(() => {
    const id = window.location.hash.replace('#', '')
    if (!id) return undefined
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
    return () => window.clearTimeout(timer)
  }, [])

  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
  const shownName = [form.firstName.trim(), form.lastName.trim() && `${form.lastName.trim().charAt(0).toUpperCase()}.`].filter(Boolean).join(' ')
  const nameOk = fullName === '' || isValidFullName(fullName)
  const phoneOk = isValidBosnianPhone(form.phone)
  const bioScan = useMemo(() => scanContactInfo(form.bio), [form.bio])
  const nameScan = useMemo(() => scanContactInfo(fullName), [fullName])
  const birthDate = form.y && form.m && form.d ? `${form.y.padStart(4, '0')}-${form.m.padStart(2, '0')}-${form.d.padStart(2, '0')}` : ''
  const birthOk = !birthDate || (!Number.isNaN(Date.parse(birthDate)) && new Date(birthDate) < new Date())
  const taxOk = !form.taxId || /^\d{13}$/.test(form.taxId.replace(/\s+/g, ''))
  const canSave = nameOk && phoneOk && bioScan.clean && nameScan.clean && birthOk && taxOk && fullName.length > 0

  const set = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: key === 'phone' ? formatBosnianPhone(value) : value }))
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
        phone: form.phone,
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

  const removeAccount = async () => {
    if (!(await confirmDialog({ title: 'Obrisati nalog?', text: 'Trajno briše tvoj nalog, oglase, poruke i sve lične podatke. Ovo se ne može poništiti.', confirmLabel: 'Obriši nalog', danger: true }))) return
    setDeleting(true)
    try { await deleteAccount(); window.location.assign(withBase('/')) } catch (requestError) { setError(requestError.message); setDeleting(false) }
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
      <header className="pe-head">
        <div>
          <h1>Profil</h1>
          <p>Ime, slika i opis su javni. Telefon, datum rođenja i JMBG vidiš samo ti.</p>
        </div>
        <ProfileCardArt className="pe-head-art" />
      </header>

      <div className="pe-layout">
      <aside className="pe-aside">
        <section className="pe-preview" aria-label="Ovako te drugi vide">
          <span className="pe-preview-label">Ovako te drugi vide</span>
          <div className="pe-preview-who">
            <div className="pe-preview-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={24} strokeWidth={1.6} />}</div>
            <div>
              <strong>{shownName || 'Tvoje ime'}</strong>
              <small>{[form.city, GOAL_LABEL[form.accountType]].filter(Boolean).join(' · ')}</small>
            </div>
          </div>
          <p className={form.bio.trim() ? '' : 'is-empty'}>{form.bio.trim() ? (form.bio.trim().length > 160 ? `${form.bio.trim().slice(0, 160)}…` : form.bio.trim()) : 'Još nema opisa. Napiši par rečenica o sebi ispod.'}</p>
          <Link to={`/korisnik/${user.id}`} className="pe-preview-link">Pogledaj javni profil <ArrowRight size={15} /></Link>
        </section>
        <ProfileSteps onPickAvatar={openAvatarPicker} />
      </aside>

      <form className="pe-form" onSubmit={submit}>
        <section className="pe-section">
          <h2>Profilna slika</h2>
          <div className="pe-avatar-row">
            <div className="pe-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={30} strokeWidth={1.6} />}</div>
            <div>
              <button type="button" className="ghost-button" onClick={openAvatarPicker} disabled={uploadingAvatar}>{uploadingAvatar ? 'Učitavam…' : profile.avatar_url ? 'Promijeni sliku' : 'Učitaj sliku'}</button>
              <small>Jasna slika lica. Bez brojeva telefona i natpisa na slici.</small>
            </div>
          </div>
        </section>

        <section className="pe-section">
          <h2>Lični podaci</h2>
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
            <label className="account-field">
              <span>Email</span>
              <input value={user.email} readOnly className="is-readonly" />
            </label>
            <label className="account-field">
              <span id="telefon">Telefon (privatno)</span>
              <input value={form.phone} onChange={set('phone')} type="tel" inputMode="tel" placeholder="061 234 567" autoComplete="tel" />
              <small className={!phoneOk ? 'is-error' : ''}>{!phoneOk ? 'Oblik: 061 234 567 ili +387 61 234 567.' : profile.phone_verified_at ? 'Verifikovan SMS kodom' : <>Verifikuj ga u <Link to="/account/znacke#mobile_verified">Značkama</Link>.</>}</small>
            </label>
            <div className="account-field">
              <span>Datum rođenja</span>
              <div className="account-date">
                <input value={form.d} onChange={set('d')} placeholder="DD" inputMode="numeric" maxLength={2} aria-label="Dan" />
                <input value={form.m} onChange={set('m')} placeholder="MM" inputMode="numeric" maxLength={2} aria-label="Mjesec" />
                <input value={form.y} onChange={set('y')} placeholder="GGGG" inputMode="numeric" maxLength={4} aria-label="Godina" />
              </div>
              {!birthOk && <small className="is-error">Provjeri datum.</small>}
            </div>
          </div>
        </section>

        <section className="pe-section">
          <h2>Lokacija</h2>
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
        </section>

        <section className="pe-section">
          <h2>O meni</h2>
          <label className="account-field">
            <span className="visually-hidden">O meni</span>
            <textarea id="o-meni" value={form.bio} onChange={set('bio')} rows={5} maxLength={1000} placeholder="Ko si, šta radiš i koliko dugo. Kratko i jasno." />
            <small className={!bioScan.clean ? 'is-error' : 'pe-count'}>{!bioScan.clean ? contactInfoMessage(bioScan, 'opis') : `${form.bio.length} / 1000`}</small>
          </label>
          <RuleOneNotice compact />
        </section>

        <section className="pe-section">
          <h2>Šta ti je glavni cilj na Zadatku?</h2>
          <div className="pe-choices" role="radiogroup" aria-label="Glavni cilj">
            {GOALS.map((goal) => (
              <label key={goal.value} className={`pe-choice ${form.accountType === goal.value ? 'is-on' : ''}`}>
                <input type="radio" name="accountType" value={goal.value} checked={form.accountType === goal.value} onChange={() => setForm((current) => ({ ...current, accountType: goal.value }))} />
                <span><strong>{goal.title}</strong><small>{goal.text}</small></span>
              </label>
            ))}
          </div>
        </section>

        <section className="pe-section">
          <h2>Privatno</h2>
          <div className="pe-grid pe-grid-one">
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
              <small><Lock size={11} /> Vidiš ga samo ti i podrška. Ne dijeli ga.</small>
            </div>
          </div>
        </section>

        <div className="pe-save">
          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}
          <button type="submit" className="primary-button" disabled={saving || !canSave}>{saving ? 'Čuvam…' : 'Sačuvaj promjene'}</button>
        </div>
      </form>
      </div>

      {searchParams.get('setup') !== '1' && (
        <section className="pe-danger" id="brisanje">
          <div>
            <h2>Obriši nalog</h2>
            <p>Trajno briše tvoj nalog, oglase, poruke i sve lične podatke.</p>
          </div>
          <button type="button" className="pe-danger-btn" onClick={removeAccount} disabled={deleting}><Trash2 size={15} /> {deleting ? 'Brišem…' : 'Obriši nalog'}</button>
        </section>
      )}
    </div>
  )
}

export default ProfileSettingsPage
