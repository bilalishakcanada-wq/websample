import { useState } from 'react'
import { Car, Check, Plus, Radar, X } from 'lucide-react'
import { MAX_REQUIREMENTS, REQUIREMENT_MAX_LENGTH, TIME_OF_DAY } from '../utils/schedule'
import { MAX_TRAVEL_ALLOWANCE, TRAVEL_CHIPS, reachKm, reachLabel } from '../utils/reach'
import './TaskExtras.css'

/** "U koje doba dana?" — optional, several can be picked (empty = any time). */
export function TimeOfDayPicker({ value = [], onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])
  return (
    <div className="tx-tod" role="group" aria-label="Doba dana">
      {TIME_OF_DAY.map((slot) => {
        const on = value.includes(slot.id)
        return (
          <button key={slot.id} type="button" className={`tx-tod-chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(slot.id)}>
            <strong>{slot.label}</strong>
            <span>{slot.hint}</span>
            {on && <Check size={14} className="tx-tod-check" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

/** Up to three must-haves ("Ima svoj alat", "Ima auto"), shown to taskers before they offer. */
export function RequirementsEditor({ value = [], onChange }) {
  const [draft, setDraft] = useState('')
  const full = value.length >= MAX_REQUIREMENTS
  const add = () => {
    const clean = draft.replace(/\s+/g, ' ').trim().slice(0, REQUIREMENT_MAX_LENGTH)
    if (!clean || full || value.some((item) => item.toLowerCase() === clean.toLowerCase())) return
    onChange([...value, clean])
    setDraft('')
  }
  return (
    <div className="tx-req">
      {value.length > 0 && (
        <ul className="tx-req-list">
          {value.map((item) => (
            <li key={item}>
              <Check size={15} aria-hidden="true" /> <span>{item}</span>
              <button type="button" onClick={() => onChange(value.filter((other) => other !== item))} aria-label={`Ukloni: ${item}`}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div className="tx-req-add">
          <input
            value={draft}
            maxLength={REQUIREMENT_MAX_LENGTH}
            placeholder={value.length === 0 ? 'npr. Ima svoj alat' : 'Dodaj još jedan uslov'}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }}
            enterKeyHint="done"
          />
          <button type="button" onClick={add} disabled={!draft.trim()} aria-label="Dodaj uslov"><Plus size={18} /></button>
        </div>
      )}
      <small className="tx-req-hint">Opciono · najviše {MAX_REQUIREMENTS} · izvođači ih vide prije nego pošalju ponudu</small>
    </div>
  )
}

/** Read-only list on the job page. */
export function RequirementsList({ items = [] }) {
  if (!items.length) return null
  return (
    <ul className="tx-req-list tx-req-readonly">
      {items.map((item) => <li key={item}><Check size={15} aria-hidden="true" /> <span>{item}</span></li>)}
    </ul>
  )
}

/** Live hint while setting the budget: how far away providers may be for this pay. */
export function ReachHint({ price, travel }) {
  const km = reachKm(price, travel)
  return (
    <p className="tx-reach-hint"><Radar size={15} /> Ponude mogu slati izvođači <strong>{reachLabel(km)}</strong></p>
  )
}

/** "Platiću put": the poster adds money for the provider's travel (gorivo, taksi, prevoz). */
export function TravelPicker({ value, onChange }) {
  const amount = Number(value) > 0 ? Number(value) : 0
  const on = amount > 0
  const custom = on && !TRAVEL_CHIPS.includes(amount)
  return (
    <div className="tx-travel">
      <button type="button" className={`tx-travel-toggle ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? '' : String(TRAVEL_CHIPS[1]))}>
        <Car size={20} />
        <span>Platiću put izvođaču<small>Gorivo, taksi ili prevoz. Izvođači izdaleka se češće jave.</small></span>
        {on && <Check size={18} style={{ marginLeft: 'auto' }} />}
      </button>
      {on && (
        <div className="tx-travel-chips" role="group" aria-label="Iznos za put">
          {TRAVEL_CHIPS.map((chip) => (
            <button key={chip} type="button" className={amount === chip ? 'active' : ''} onClick={() => onChange(String(chip))}>{chip} KM</button>
          ))}
          <input
            type="number" inputMode="numeric" min="1" max={MAX_TRAVEL_ALLOWANCE} placeholder="Drugo"
            aria-label="Drugi iznos za put (KM)"
            value={custom ? amount : ''}
            onChange={(event) => onChange(String(Math.min(MAX_TRAVEL_ALLOWANCE, Math.max(0, Math.round(Number(event.target.value) || 0))) || ''))}
          />
        </div>
      )}
    </div>
  )
}
