import { useMemo, useState } from 'react'
import { Award, Bike, BriefcaseBusiness, Bus, Car, Check, Footprints, GraduationCap, Languages, Laptop, Plus, Route, Scooter, Sparkles, Truck, Van, X } from 'lucide-react'
import { useAccount } from './AccountLayout'
import { serviceCategories } from '../../data/categories'
import { contactInfoMessage, scanContactInfo } from '../../utils/moderation'
import RuleOneNotice from '../../components/RuleOneNotice'
import './SkillsPage.css'

const TRANSPORT = [
  ['Bicikl', Bike], ['Auto', Car], ['Online', Laptop], ['Skuter', Scooter],
  ['Kamion', Truck], ['Kombi', Van], ['Pješke', Footprints], ['Javni prevoz', Bus],
]
const LANGUAGES = [
  ['Bosanski', 'BS'], ['Hrvatski', 'HR'], ['Srpski', 'SR'], ['Engleski', 'EN'], ['Njemački', 'DE'],
  ['Turski', 'TR'], ['Arapski', 'AR'], ['Italijanski', 'IT'], ['Francuski', 'FR'], ['Španski', 'ES'],
]

/** One white card per question: icon, title, a short hint and how many are picked. */
function SkillsCard({ icon: Icon, title, hint, count, children, className = '' }) {
  return (
    <section className={`sk-card ${className}`}>
      <header className="sk-card-head">
        <span className="sk-card-icon"><Icon size={20} /></span>
        <div className="sk-card-title">
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        {count && <span className="sk-count">{count}</span>}
      </header>
      {children}
    </section>
  )
}

/** Every choice on the page is the same chip: a button that is either on or off. */
function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`sk-chip ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}>
      {children}
      {active && <Check size={15} strokeWidth={3} className="sk-chip-check" />}
    </button>
  )
}

/** The draft lives in the parent, so text typed but not yet added with "Dodaj" is still saved. */
function ListEditor({ icon, title, hint, items, placeholder, onChange, draft, setDraft, max = 10, empty }) {
  const add = () => {
    const value = draft.trim()
    if (!value || items.includes(value)) return
    onChange([...items, value].slice(0, max))
    setDraft('')
  }
  const full = items.length >= max
  return (
    <SkillsCard icon={icon} title={title} hint={hint} count={`${items.length}/${max}`}>
      {items.length > 0 ? (
        <ul className="sk-list">
          {items.map((item) => (
            <li key={item}>
              <span className="sk-list-dot" aria-hidden="true" />
              <span className="sk-list-text">{item}</span>
              <button type="button" onClick={() => onChange(items.filter((entry) => entry !== item))} aria-label={`Ukloni: ${item}`}><X size={16} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sk-empty">{empty}</p>
      )}
      <div className="sk-add">
        <input value={draft} placeholder={full ? `Dodano je najviše (${max})` : placeholder} aria-label={title} maxLength={120} disabled={full} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }} />
        <button type="button" className="sk-add-button" onClick={add} disabled={full || !draft.trim()}><Plus size={16} strokeWidth={2.6} /> Dodaj</button>
      </div>
    </SkillsCard>
  )
}

function SkillsPage() {
  const { profile, saveProfile } = useAccount()
  const [trades, setTrades] = useState(profile.trades || [])
  const [transport, setTransport] = useState(profile.transportation || [])
  const [languages, setLanguages] = useState(profile.languages || [])
  const [education, setEducation] = useState(profile.education || [])
  const [work, setWork] = useState(profile.work_experience || [])
  const [specialties, setSpecialties] = useState(profile.specialties || [])
  const [drafts, setDrafts] = useState({ education: '', work: '', specialties: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const draftProps = (key) => ({ draft: drafts[key], setDraft: (text) => setDrafts((current) => ({ ...current, [key]: text })) })
  const withDraft = (items, key, max) => {
    const value = drafts[key].trim()
    return value && !items.includes(value) ? [...items, value].slice(0, max) : items
  }

  const scan = useMemo(() => scanContactInfo(...education, ...work, ...specialties, ...Object.values(drafts)), [education, work, specialties, drafts])
  const toggle = (list, setList, value) => {
    setMessage('')
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const nextEducation = withDraft(education, 'education', 10)
      const nextWork = withDraft(work, 'work', 10)
      const nextSpecialties = withDraft(specialties, 'specialties', 15)
      await saveProfile({ trades, transportation: transport, languages, education: nextEducation, work_experience: nextWork, specialties: nextSpecialties, account_type: profile.account_type === 'client' ? 'provider' : profile.account_type })
      setEducation(nextEducation)
      setWork(nextWork)
      setSpecialties(nextSpecialties)
      setDrafts({ education: '', work: '', specialties: '' })
      setMessage('Vještine su sačuvane.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="account-section skills-page">
      <div className="account-section-head"><h1>Vještine</h1></div>
      <p className="muted-text">Ovo su tvoje vještine. Drži ih ažurnim, klijenti ih vide na tvom javnom profilu i po njima te platforma predlaže za poslove.</p>

      <form className="sk-form" onSubmit={submit}>
        <SkillsCard icon={Sparkles} title="U čemu si dobar/dobra?" hint="Označi sve usluge koje nudiš." count={trades.length > 0 ? `${trades.length} odabrano` : null}>
          <div className="sk-chips">
            {serviceCategories.map(({ id, name, icon: Icon }) => (
              <Chip key={id} active={trades.includes(name)} onClick={() => toggle(trades, setTrades, name)}>
                <Icon size={16} className="sk-chip-icon" /> {name}
              </Chip>
            ))}
          </div>
        </SkillsCard>

        <div className="sk-pair">
          <SkillsCard icon={Route} title="Kako se krećeš?" hint="Kako dolaziš do posla." count={transport.length > 0 ? `${transport.length}` : null}>
            <div className="sk-chips">
              {TRANSPORT.map(([name, Icon]) => (
                <Chip key={name} active={transport.includes(name)} onClick={() => toggle(transport, setTransport, name)}>
                  <Icon size={16} className="sk-chip-icon" /> {name}
                </Chip>
              ))}
            </div>
          </SkillsCard>

          <SkillsCard icon={Languages} title="Koje jezike govoriš / pišeš?" hint="Klijenti biraju po jeziku." count={languages.length > 0 ? `${languages.length}` : null}>
            <div className="sk-chips">
              {LANGUAGES.map(([name, code]) => (
                <Chip key={name} active={languages.includes(name)} onClick={() => toggle(languages, setLanguages, name)}>
                  <span className="sk-chip-code" aria-hidden="true">{code}</span> {name}
                </Chip>
              ))}
            </div>
          </SkillsCard>
        </div>

        <ListEditor icon={GraduationCap} title="Koje kvalifikacije imaš?" hint="Škole, kursevi, certifikati." empty="Još nema kvalifikacija. Dodaj školu, kurs ili certifikat." items={education} onChange={setEducation} {...draftProps('education')} placeholder="npr. Elektrotehnička škola Sarajevo, 2014" />
        <ListEditor icon={BriefcaseBusiness} title="Radno iskustvo" hint="Gdje si radio/la i koliko dugo." empty="Još nema radnog iskustva. Dodaj posao i koliko si ga radio/la." items={work} onChange={setWork} {...draftProps('work')} placeholder="npr. Električar. Elektroprivreda BiH, 6 godina" />
        <ListEditor icon={Award} title="Specijalnosti" hint="Ono po čemu si poseban/posebna." empty="Još nema specijalnosti. Npr. rasvjeta ili solarni sistemi." items={specialties} onChange={setSpecialties} {...draftProps('specialties')} placeholder="npr. Rasvjeta, Solarni sistemi" max={15} />

        {!scan.clean && <div className="form-error">{contactInfoMessage(scan, 'vještine')}</div>}
        {error && <div className="form-error">{error}</div>}

        <div className="sk-savebar">
          <div className="sk-savebar-note">
            {message ? <span className="sk-saved"><Check size={16} strokeWidth={3} /> {message}</span> : <RuleOneNotice compact />}
          </div>
          <button type="submit" className="primary-button" disabled={saving || !scan.clean}>{saving ? 'Čuvam…' : 'Sačuvaj vještine'}</button>
        </div>
      </form>
    </div>
  )
}

export default SkillsPage
