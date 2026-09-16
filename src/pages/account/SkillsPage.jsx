import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useAccount } from './AccountLayout'
import { serviceCategories } from '../../data/categories'
import { contactInfoMessage, scanContactInfo } from '../../utils/moderation'
import RuleOneNotice from '../../components/RuleOneNotice'

const TRANSPORT = ['Bicikl', 'Auto', 'Online', 'Skuter', 'Kamion', 'Kombi', 'Pješke', 'Javni prevoz']
const LANGUAGES = ['Bosanski', 'Hrvatski', 'Srpski', 'Engleski', 'Njemački', 'Turski', 'Arapski', 'Italijanski', 'Francuski', 'Španski']

function ListEditor({ title, items, placeholder, onChange, max = 10 }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const value = draft.trim()
    if (!value || items.includes(value)) return
    onChange([...items, value].slice(0, max))
    setDraft('')
  }
  return (
    <div className="account-field account-field-wide">
      <span>{title} <small>({items.length}/{max})</small></span>
      {items.length > 0 && (
        <ul className="list-editor-items">
          {items.map((item) => <li key={item}><span>{item}</span><button type="button" onClick={() => onChange(items.filter((entry) => entry !== item))} aria-label="Ukloni"><X size={14} /></button></li>)}
        </ul>
      )}
      <div className="list-editor-add">
        <input value={draft} placeholder={placeholder} maxLength={120} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }} />
        <button type="button" className="ghost-button" onClick={add}><Plus size={14} /> Dodaj</button>
      </div>
    </div>
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const scan = useMemo(() => scanContactInfo(...education, ...work, ...specialties), [education, work, specialties])
  const toggle = (list, setList, value) => setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await saveProfile({ trades, transportation: transport, languages, education, work_experience: work, specialties, account_type: profile.account_type === 'client' ? 'provider' : profile.account_type })
      setMessage('Vještine su sačuvane.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Vještine</h1></div>
      <p className="muted-text">Ovo su tvoje vještine. Drži ih ažurnim — klijenti ih vide na tvom javnom profilu i po njima te platforma predlaže za poslove.</p>

      <form className="account-form" onSubmit={submit}>
        <div className="account-field account-field-wide">
          <span>U čemu si dobar/dobra?</span>
          <div className="trade-chips">
            {serviceCategories.map(({ id, name }) => (
              <button key={id} type="button" className={`trade-chip ${trades.includes(name) ? 'active' : ''}`} onClick={() => toggle(trades, setTrades, name)} aria-pressed={trades.includes(name)}>{name}</button>
            ))}
          </div>
        </div>

        <div className="account-field account-field-wide">
          <span>Kako se krećeš?</span>
          <div className="check-row">
            {TRANSPORT.map((option) => (
              <label key={option} className={`check-pill ${transport.includes(option) ? 'active' : ''}`}>
                <input type="checkbox" checked={transport.includes(option)} onChange={() => toggle(transport, setTransport, option)} /> {option}
              </label>
            ))}
          </div>
        </div>

        <div className="account-field account-field-wide">
          <span>Koje jezike govoriš / pišeš?</span>
          <div className="check-row">
            {LANGUAGES.map((option) => (
              <label key={option} className={`check-pill ${languages.includes(option) ? 'active' : ''}`}>
                <input type="checkbox" checked={languages.includes(option)} onChange={() => toggle(languages, setLanguages, option)} /> {option}
              </label>
            ))}
          </div>
        </div>

        <ListEditor title="Koje kvalifikacije imaš?" items={education} onChange={setEducation} placeholder="npr. Elektrotehnička škola Sarajevo, 2014" />
        <ListEditor title="Radno iskustvo" items={work} onChange={setWork} placeholder="npr. Električar — Elektroprivreda BiH, 6 godina" />
        <ListEditor title="Specijalnosti" items={specialties} onChange={setSpecialties} placeholder="npr. Rasvjeta, Solarni sistemi" max={15} />

        {!scan.clean && <div className="form-error account-field-wide">{contactInfoMessage(scan, 'vještine')}</div>}
        <div className="account-field-wide"><RuleOneNotice compact /></div>
        {error && <div className="form-error account-field-wide">{error}</div>}
        {message && <div className="form-success account-field-wide">{message}</div>}
        <div className="account-field-wide">
          <button type="submit" className="primary-button" disabled={saving || !scan.clean}>{saving ? 'Čuvam…' : 'Sačuvaj vještine'}</button>
        </div>
      </form>
    </div>
  )
}

export default SkillsPage
