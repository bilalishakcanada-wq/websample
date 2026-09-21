import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Banknote, CheckCircle2, Copy, Eye, EyeOff, Lock, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { accountService } from '../../services/accountService'
import { isValidFullName } from '../../services/profileService'
import { contactInfoMessage, scanContactInfo } from '../../utils/moderation'
import { formatBosnianPhone, isValidBosnianPhone } from '../../utils/phone'
import CityField from '../../components/CityField'
import RuleOneNotice from '../../components/RuleOneNotice'
import { withBase } from '../../utils/paths'

const splitName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}
const splitDate = (value) => {
  const [y = '', m = '', d = ''] = String(value || '').split('-')
  return { d, m, y }
}

function VerificationMeter() {
  const [progress, setProgress] = useState(null)
  useEffect(() => { accountService.verificationProgress().then(setProgress) }, [])
  // deep links from "Informacije o nalogu" (#telefon, #brisanje)
  useEffect(() => {
    const id = window.location.hash.replace('#', '')
    if (!id) return undefined
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
    return () => window.clearTimeout(timer)
  }, [])
  if (!progress) return null
  return (
    <div className="verif-meter" title={progress.items.map((item) => `${item.done ? '✓' : '○'} ${item.label}`).join('\n')}>
      <span>Tvoje verifikacije su {progress.percent}% završene</span>
      <div className="verif-meter-bar"><span style={{ width: `${progress.percent}%` }} /></div>
    </div>
  )
}

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

  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
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
      setMessage('Profil je sačuvan.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const removeAccount = async () => {
    if (!window.confirm('Ovo trajno briše tvoj nalog i sve lične podatke. Nastaviti?')) return
    setDeleting(true)
    try { await deleteAccount(); window.location.assign(withBase('/')) } catch (requestError) { setError(requestError.message); setDeleting(false) }
  }

  const copyId = async () => {
    try { await navigator.clipboard.writeText(profile.member_id); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }

  return (
    <div className="account-section">
      <div className="account-section-head">
        <h1>Profil</h1>
        <VerificationMeter />
      </div>

      <h3 className="account-sub">Profilna slika</h3>
      <div className="account-avatar-row">
        <div className="account-avatar-mini">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={22} />}</div>
        <button type="button" className="primary-button" onClick={openAvatarPicker} disabled={uploadingAvatar}>{uploadingAvatar ? 'Učitavam…' : 'Učitaj sliku'}</button>
        <Link to={`/korisnik/${user.id}`} className="ghost-button account-public-link">Pogledaj svoj javni profil</Link>
      </div>

      <form className="account-form" onSubmit={submit}>
        <label className="account-field">
          <span>Ime*</span>
          <input value={form.firstName} onChange={set('firstName')} required autoComplete="given-name" />
        </label>
        <label className="account-field">
          <span>Prezime*</span>
          <input value={form.lastName} onChange={set('lastName')} required autoComplete="family-name" />
          <small className={!nameOk ? 'is-error' : ''}>{!nameOk ? 'Pravo ime i prezime, samo slova.' : `Javno se prikazuje kao ${fullName ? `${form.firstName.trim()} ${form.lastName.trim().charAt(0).toUpperCase()}.` : '—'}`}</small>
        </label>
        <div className="account-field">
          <span>Lokacija</span>
          <CityField id="acc-city" value={form.city} onChange={(city) => setForm((current) => ({ ...current, city }))} label="Grad" />
        </div>
        <label className="account-field">
          <span>Email</span>
          <input value={user.email} readOnly className="is-readonly" />
        </label>
        <label className="account-field">
          <span id="telefon">Telefon (privatno)</span>
          <input value={form.phone} onChange={set('phone')} type="tel" inputMode="tel" placeholder="061 234 567" autoComplete="tel" />
          <small className={!phoneOk ? 'is-error' : ''}>{!phoneOk ? 'Oblik: 061 234 567 ili +387 61 234 567.' : profile.phone_verified_at ? '✓ Verifikovan SMS kodom' : 'Verifikuj ga u Značkama za značku "Telefon verifikovan".'}</small>
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
        <label className="account-field">
          <span>JMBG / JIB (opciono, privatno)</span>
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
          <small className={!taxOk ? 'is-error' : ''}><Lock size={11} /> {!taxOk ? 'JMBG / JIB ima tačno 13 cifara.' : 'Koristi se samo za verifikaciju i isplate. Nikad se ne prikazuje.'}</small>
        </label>
        <label className="account-field account-field-wide">
          <span>O meni</span>
          <textarea value={form.bio} onChange={set('bio')} rows={4} maxLength={1000} />
          <small className={!bioScan.clean ? 'is-error' : ''}>{!bioScan.clean ? contactInfoMessage(bioScan, 'opis') : `${form.bio.length}/1000`}</small>
        </label>

        <div className="account-field account-field-wide">
          <span>Šta ti je glavni cilj na Poso.ba?</span>
          <div className="goal-cards">
            <button type="button" className={`goal-card ${form.accountType === 'client' ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, accountType: 'client' }))}>
              <CheckCircle2 size={26} /><span>Završiti poslove</span><small>Objavljujem i biram majstore</small>
            </button>
            <button type="button" className={`goal-card ${form.accountType === 'provider' ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, accountType: 'provider' }))}>
              <Banknote size={26} /><span>Zaraditi novac</span><small>Radim poslove za druge</small>
            </button>
            <button type="button" className={`goal-card ${form.accountType === 'both' ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, accountType: 'both' }))}>
              <UserRound size={26} /><span>Oboje</span><small>I jedno i drugo</small>
            </button>
          </div>
        </div>

        <div className="account-field-wide"><RuleOneNotice compact /></div>
        {error && <div className="form-error account-field-wide">{error}</div>}
        {message && <div className="form-success account-field-wide">{message}</div>}
        <div className="account-field-wide">
          <button type="submit" className="primary-button" disabled={saving || !canSave}>{saving ? 'Čuvam…' : 'Sačuvaj profil'}</button>
        </div>
      </form>

      <div className="member-id-card account-id-card">
        <div className="member-id-head"><Lock size={15} /><strong>Tvoj privatni ID</strong></div>
        <code className="member-id-value">{showId ? profile.member_id : 'PB-••••-••••'}</code>
        <div className="member-id-actions">
          <button type="button" className="ghost-button" onClick={() => setShowId((v) => !v)}>{showId ? <EyeOff size={14} /> : <Eye size={14} />} {showId ? 'Sakrij' : 'Prikaži'}</button>
          <button type="button" className="ghost-button" onClick={copyId} disabled={!showId}><Copy size={14} /> {copied ? 'Kopirano' : 'Kopiraj'}</button>
        </div>
        <small>Vidiš ga samo ti i podrška. Ne dijeli ga.</small>
      </div>

      {searchParams.get('setup') !== '1' && (
        <div className="account-danger" id="brisanje">
          <button type="button" className="danger-button" onClick={removeAccount} disabled={deleting}><Trash2 size={15} /> {deleting ? 'Brišem…' : 'Obriši moj nalog'}</button>
        </div>
      )}
    </div>
  )
}

export default ProfileSettingsPage
