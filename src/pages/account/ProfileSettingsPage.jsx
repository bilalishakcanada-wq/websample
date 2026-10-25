import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BadgeCheck, Camera, ChevronRight, Copy, Eye, EyeOff, Lock, MapPin, PenLine, Quote, Settings, ShieldCheck, Star, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { accountService } from '../../services/accountService'
import { isValidFullName } from '../../services/profileService'
import { contactInfoMessage, scanContactInfo } from '../../utils/moderation'
import { formatBosnianMonthYear, reviewsLabel } from '../../utils/dateFormat'
import CityField from '../../components/CityField'
import ExactLocationPicker from '../../components/ExactLocationPicker'
import { placeService } from '../../services/placeService'
import { knowsPlace } from '../../data/cityCoordinates'
import { queryClient } from '../../lib/queryClient'
import RuleOneNotice from '../../components/RuleOneNotice'
import { toast } from '../../components/Toaster'
import AccountSwitch from './AccountSwitch'
import './SettingsPage.css'
import './ProfilePage.css'

const splitName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }
}
const splitDate = (value) => {
  const [y = '', m = '', d = ''] = String(value || '').split('-')
  return { d, m, y }
}
const fromProfile = (profile) => ({
  ...splitName(profile.full_name),
  city: profile.city || '',
  bio: profile.bio || '',
  taxId: profile.tax_id || '',
  ...splitDate(profile.birth_date),
  accountType: profile.account_type || 'client',
})
// which form fields each card edits: "Odustani" puts only these back
const SECTION_FIELDS = {
  about: ['bio'],
  basic: ['firstName', 'lastName', 'city', 'accountType'],
  private: ['d', 'm', 'y', 'taxId'],
}

/** "1 posao", "3 posla", "5 poslova" */
const jobsWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'posao' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'posla' : 'poslova')

const GOAL_LABEL = { client: 'Klijent', provider: 'Izvođač', both: 'Klijent i izvođač' }
const GOALS = [
  { value: 'client', title: 'Završiti poslove', text: 'Objavljujem poslove i biram izvođače' },
  { value: 'provider', title: 'Zaraditi novac', text: 'Radim poslove za druge' },
  { value: 'both', title: 'Oboje', text: 'I objavljujem i radim poslove' },
]

/** Verifications as a ring: how far along, and the way to Značke where each step is done. */
function VerificationCard() {
  const [progress, setProgress] = useState(null)
  useEffect(() => { accountService.verificationProgress().then(setProgress).catch(() => {}) }, [])
  const items = progress?.items || []
  const done = items.filter((item) => item.done).length
  const percent = Math.max(0, Math.min(100, Number(progress?.percent || 0)))
  const all = progress && done === items.length
  return (
    <Link to="/account/znacke" className="pp-card pp-verif" data-testid="profile-verifications">
      <span className="pp-ring" style={{ '--p': percent }} aria-hidden="true">
        <span>{progress ? `${percent}%` : '…'}</span>
      </span>
      <span className="pp-verif-text">
        <strong>{all ? 'Potpuno verifikovan' : 'Verifikacije'}</strong>
        <span>{progress ? (all ? 'Klijenti ti više vjeruju.' : `${done} od ${items.length} urađeno. Verifikovani dobijaju više poslova.`) : 'Učitavam…'}</span>
      </span>
      <span className="pp-verif-go">{all ? 'Značke' : 'Dovrši'} <ChevronRight size={16} /></span>
    </Link>
  )
}

/** A card that reads like a profile, and turns into a small form after "Uredi". */
function Section({ id, icon: Icon, tone, title, note, editing, onEdit, onCancel, onSave, saving, canSave, children, form }) {
  return (
    <section className={`pp-card pp-section${editing ? ' is-editing' : ''}`} id={id} aria-label={title}>
      <header className="pp-section-head">
        <span className={`st-tile st-tile-${tone}`} aria-hidden="true"><Icon size={17} strokeWidth={2.2} /></span>
        <span className="pp-section-title"><h2>{title}</h2>{note && <small>{note}</small>}</span>
        {!editing && <button type="button" className="pp-edit" onClick={onEdit} data-testid={`edit-${id}`}><PenLine size={15} /> Uredi</button>}
      </header>
      {editing ? (
        <form className="pp-form" onSubmit={(event) => { event.preventDefault(); onSave() }}>
          {form}
          <div className="pp-form-actions">
            <button type="button" className="pp-cancel" onClick={onCancel} disabled={saving}>Odustani</button>
            <button type="submit" className="pp-save" disabled={saving || !canSave} data-testid={`save-${id}`}>{saving ? 'Čuvam…' : 'Sačuvaj'}</button>
          </div>
        </form>
      ) : children}
    </section>
  )
}

function ProfileSettingsPage() {
  const { user, updateProfile } = useAuth()
  const { profile, bundle, saveProfile, openAvatarPicker, uploadingAvatar } = useAccount()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState(() => fromProfile(profile))
  // a new account (?setup=1, or no name yet) starts with the basic card open
  const [editing, setEditing] = useState(() => (searchParams.get('setup') === '1' || !profile.full_name ? { basic: true } : {}))
  const [saving, setSaving] = useState('')
  const [showTax, setShowTax] = useState(false)
  const [taxFocused, setTaxFocused] = useState(false)
  const [showId, setShowId] = useState(false)
  const [copied, setCopied] = useState(false)
  // exact location (street and number or GPS): private, used for distance to jobs; saved with the basic card
  const [exact, setExact] = useState(null)
  const [savedExact, setSavedExact] = useState(null)
  const [exactTouched, setExactTouched] = useState(false)
  useEffect(() => {
    let live = true
    placeService.myLocation(user.id).then((row) => {
      if (!live || !row) return
      const value = { address: row.address, lat: row.lat, lng: row.lng, accuracy: row.accuracy_m, source: row.source }
      setExact(value)
      setSavedExact(value)
    }).catch(() => {})
    return () => { live = false }
  }, [user.id])

  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
  const shownName = [form.firstName.trim(), form.lastName.trim() && `${form.lastName.trim().charAt(0).toUpperCase()}.`].filter(Boolean).join(' ')
  const nameOk = fullName === '' || isValidFullName(fullName)
  const bioScan = useMemo(() => scanContactInfo(form.bio), [form.bio])
  const nameScan = useMemo(() => scanContactInfo(fullName), [fullName])
  const birthDate = form.y && form.m && form.d ? `${form.y.padStart(4, '0')}-${form.m.padStart(2, '0')}-${form.d.padStart(2, '0')}` : ''
  const birthPartial = [form.d, form.m, form.y].some(Boolean) && !birthDate
  const birthOk = !birthPartial && (!birthDate || (!Number.isNaN(Date.parse(birthDate)) && new Date(birthDate) < new Date()))
  const taxOk = !form.taxId || /^\d{13}$/.test(form.taxId.replace(/\s+/g, ''))

  const set = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
  }
  const open = (section) => setEditing((current) => ({ ...current, [section]: true }))
  const close = (section) => setEditing((current) => ({ ...current, [section]: false }))
  const cancel = (section) => {
    const stored = fromProfile(profile)
    setForm((current) => ({ ...current, ...Object.fromEntries(SECTION_FIELDS[section].map((key) => [key, stored[key]])) }))
    if (section === 'basic') { setExact(savedExact); setExactTouched(false) }
    close(section)
  }

  const save = async (section) => {
    setSaving(section)
    try {
      if (section === 'about') await saveProfile({ bio: form.bio })
      if (section === 'private') await saveProfile({ tax_id: form.taxId, birth_date: birthDate || null })
      if (section === 'basic') {
        const saved = await saveProfile({ full_name: fullName, city: form.city, account_type: form.accountType })
        updateProfile({ user_metadata: { ...user.user_metadata, full_name: saved.full_name, city: saved.city, phone: saved.phone } })
        if (exactTouched) {
          try {
            if (exact) await placeService.setMyLocation(exact)
            else await placeService.clearMyLocation()
            setSavedExact(exact)
            setExactTouched(false)
            queryClient.invalidateQueries({ queryKey: ['me', user.id] })
          } catch (locationError) {
            toast(`Profil je sačuvan, ali tačna lokacija nije: ${locationError.message}`, { kind: 'error', duration: 5200 })
            return
          }
        }
      }
      close(section)
      toast('Sačuvano.', { kind: 'success' })
    } catch (requestError) {
      toast(requestError.message, { kind: 'error', duration: 5200 })
    } finally {
      setSaving('')
    }
  }

  const copyId = async () => {
    try { await navigator.clipboard.writeText(profile.member_id); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }

  // the real numbers from the trust summary; a client is counted by posted jobs, a worker by finished ones
  const trust = bundle?.trust || {}
  const reviews = Number(trust.review_count || 0)
  const isProvider = profile.account_type === 'provider' || profile.account_type === 'both'
  const jobs = Number((isProvider ? trust.completed_jobs : trust.jobs_posted) || 0)
  const idVerified = bundle?.verification?.status === 'approved'
  const storedBio = (profile.bio || '').trim()
  const birthShown = profile.birth_date ? profile.birth_date.split('-').reverse().join('.') + '.' : null
  const taxShown = profile.tax_id ? profile.tax_id.replace(/\d(?=\d{4})/g, '•') : null

  return (
    <div className="account-section pp">
      <div className="account-section-head"><h1>Profil</h1></div>
      <AccountSwitch />

      <div className="pp-layout">
        {/* how others see you, live while the basic card is open */}
        <section className="pp-hero" aria-label="Ovako te drugi vide">
          <div className="pp-cover" aria-hidden="true" />
          <div className="pp-hero-body">
            <button type="button" className="pp-avatar" onClick={openAvatarPicker} disabled={uploadingAvatar} aria-label={profile.avatar_url ? 'Promijeni profilnu sliku' : 'Dodaj profilnu sliku'}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span className="pp-initial">{(shownName || 'Z').charAt(0).toUpperCase()}</span>}
              <span className="pp-cam">{uploadingAvatar ? '…' : <Camera size={15} />}</span>
            </button>
            <div className="pp-who">
              <h2 className="pp-name">{shownName || 'Tvoje ime'}{idVerified && <BadgeCheck size={20} className="pp-verified" aria-label="Verifikovan identitet" />}</h2>
              <p className="pp-meta">
                {form.city && <span><MapPin size={14} /> {form.city}</span>}
                <span className="pp-role">{GOAL_LABEL[form.accountType]}</span>
              </p>
            </div>
            <Link to={`/korisnik/${user.id}`} className="pp-public">Pogledaj javni profil <ChevronRight size={16} /></Link>
          </div>
          <dl className="pp-stats">
            <div>
              <dt>Ocjena</dt>
              <dd>{reviews > 0 ? <>{Number(trust.avg_rating).toFixed(1)} <Star size={15} fill="currentColor" className="pp-star" /></> : '—'}</dd>
              <small>{reviews > 0 ? reviewsLabel(reviews) : 'još bez recenzija'}</small>
            </div>
            <div>
              <dt>{isProvider ? 'Urađeno' : 'Objavljeno'}</dt>
              <dd>{jobs}</dd>
              <small>{jobsWord(jobs)}</small>
            </div>
            <div>
              <dt>Član od</dt>
              <dd className="pp-since">{formatBosnianMonthYear(profile.created_at) || '—'}</dd>
            </div>
          </dl>
        </section>

        <div className="pp-main">
          <Section id="about" icon={Quote} tone="blue" title="O meni" note="Vide svi"
            editing={editing.about} onEdit={() => open('about')} onCancel={() => cancel('about')} onSave={() => save('about')}
            saving={saving === 'about'} canSave={bioScan.clean}
            form={(
              <label className="pp-field">
                <span className="visually-hidden">O meni</span>
                <textarea id="o-meni" value={form.bio} onChange={set('bio')} rows={6} maxLength={1000} placeholder="Ko si, šta radiš i koliko dugo. Kratko i jasno." />
                <small className={!bioScan.clean ? 'is-error' : 'pp-count'}>{!bioScan.clean ? contactInfoMessage(bioScan, 'opis') : `${form.bio.length} / 1000`}</small>
                <RuleOneNotice compact />
              </label>
            )}>
            {storedBio
              ? <p className="pp-bio">{storedBio}</p>
              : (
                <button type="button" className="pp-empty" onClick={() => open('about')}>
                  <strong>Napiši par rečenica o sebi</strong>
                  <span>Profil sa opisom dobija više odgovora.</span>
                </button>
              )}
          </Section>

          <Section id="basic" icon={UserRound} tone="green" title="Osnovni podaci" note="Ime i mjesto vide svi"
            editing={editing.basic} onEdit={() => open('basic')} onCancel={() => cancel('basic')} onSave={() => save('basic')}
            saving={saving === 'basic'} canSave={nameOk && nameScan.clean && fullName.length > 0}
            form={(
              <>
                <div className="pp-grid">
                  <label className="pp-field">
                    <span>Ime*</span>
                    <input value={form.firstName} onChange={set('firstName')} required autoComplete="given-name" />
                  </label>
                  <label className="pp-field">
                    <span>Prezime*</span>
                    <input value={form.lastName} onChange={set('lastName')} required autoComplete="family-name" />
                  </label>
                </div>
                <small className={!nameOk || !nameScan.clean ? 'is-error' : 'pp-hint'}>{!nameOk ? 'Pravo ime i prezime, samo slova.' : !nameScan.clean ? contactInfoMessage(nameScan, 'ime') : `Drugi te vide kao ${shownName || '—'}`}</small>
                <div className="pp-field">
                  <CityField id="acc-city" value={form.city} onChange={(city) => setForm((current) => ({ ...current, city }))} onAddress={(next) => { setExact(next); setExactTouched(true) }} label="Mjesto ili adresa" />
                  {(knowsPlace(form.city) || exact) && (
                    <ExactLocationPicker
                      town={form.city}
                      value={exact}
                      onChange={(next) => { setExact(next); setExactTouched(true) }}
                      openLabel="Dodaj svoju tačnu lokaciju (opciono)"
                      placeholder="Ulica i broj, npr. Ilirska 67"
                      hint="Tvoju tačnu lokaciju niko ne vidi. Koristimo je samo da izračunamo koliko si daleko od poslova (zaokruženo na oko 1 km)."
                    />
                  )}
                </div>
                <div className="pp-field">
                  <span>Šta želiš na Zadatku?</span>
                  <div className="pp-choices" role="radiogroup" aria-label="Glavni cilj">
                    {GOALS.map((goal) => (
                      <label key={goal.value} className={`pp-choice ${form.accountType === goal.value ? 'is-on' : ''}`}>
                        <input type="radio" name="accountType" value={goal.value} checked={form.accountType === goal.value} onChange={() => setForm((current) => ({ ...current, accountType: goal.value }))} />
                        <span><strong>{goal.title}</strong><small>{goal.text}</small></span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}>
            <dl className="pp-facts">
              <div><dt>Ime i prezime</dt><dd>{profile.full_name || <em>Nije upisano</em>}</dd></div>
              <div><dt>Mjesto</dt><dd>{profile.city || <em>Nije upisano</em>}</dd></div>
              <div><dt>Tačna lokacija</dt><dd>{savedExact ? <>Dodana <small>· vidiš samo ti</small></> : <em>Nije dodana</em>}</dd></div>
              <div><dt>Na Zadatku</dt><dd>{GOAL_LABEL[profile.account_type || 'client']}</dd></div>
            </dl>
          </Section>
        </div>

        <aside className="pp-side">
          <VerificationCard />

          <Section id="private" icon={Lock} tone="gray" title="Privatno" note="Vidiš samo ti"
            editing={editing.private} onEdit={() => open('private')} onCancel={() => cancel('private')} onSave={() => save('private')}
            saving={saving === 'private'} canSave={birthOk && taxOk}
            form={(
              <>
                <div className="pp-field">
                  <span>Datum rođenja</span>
                  <div className="pp-date">
                    <input value={form.d} onChange={set('d')} placeholder="DD" inputMode="numeric" maxLength={2} aria-label="Dan" />
                    <input value={form.m} onChange={set('m')} placeholder="MM" inputMode="numeric" maxLength={2} aria-label="Mjesec" />
                    <input value={form.y} onChange={set('y')} placeholder="GGGG" inputMode="numeric" maxLength={4} aria-label="Godina" />
                  </div>
                  {!birthOk && <small className="is-error">Provjeri datum.</small>}
                </div>
                <label className="pp-field">
                  <span>JMBG / JIB (opciono)</span>
                  <div className="pp-secret">
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
                  <small className={!taxOk ? 'is-error' : 'pp-hint'}>{!taxOk ? 'JMBG / JIB ima tačno 13 cifara.' : 'Samo za verifikaciju i isplate. Nikad se ne prikazuje.'}</small>
                </label>
              </>
            )}>
            <dl className="pp-facts">
              <div><dt>Datum rođenja</dt><dd>{birthShown || <em>Nije upisan</em>}</dd></div>
              <div><dt>JMBG / JIB</dt><dd className="pp-mono">{taxShown || <em>Nije upisan</em>}</dd></div>
            </dl>
          </Section>

          <section className="pp-card pp-id" aria-label="Tvoj privatni ID">
            <span className="pp-id-label"><ShieldCheck size={15} /> Tvoj privatni ID</span>
            <code>{showId ? profile.member_id : 'PB-••••-••••'}</code>
            <div className="pp-id-actions">
              <button type="button" onClick={() => setShowId((v) => !v)}>{showId ? <EyeOff size={14} /> : <Eye size={14} />} {showId ? 'Sakrij' : 'Prikaži'}</button>
              <button type="button" onClick={copyId} disabled={!showId}><Copy size={14} /> {copied ? 'Kopirano' : 'Kopiraj'}</button>
            </div>
            <small>Vidiš ga samo ti i podrška. Ne dijeli ga.</small>
          </section>

          <Link to="/account/postavke" replace className="pp-elsewhere">
            <Settings size={16} />
            <span>Email, telefon, lozinka i brisanje naloga su u <strong>Postavkama</strong></span>
            <ChevronRight size={16} />
          </Link>
        </aside>
      </div>
    </div>
  )
}

export default ProfileSettingsPage
