import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { MAX_REQUIREMENTS, REQUIREMENT_MAX_LENGTH, TIME_OF_DAY } from '../utils/schedule'
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
