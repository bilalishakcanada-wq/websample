import { useState } from 'react'
import { quartersFor } from '../data/cityQuarters'
import './QuarterChips.css'

const SHOWN = 10

/**
 * "Koji dio grada?" under the place field: picking "Grbavica" instead of just "Sarajevo" puts the job on
 * that part of town on the map, so jobs from one big town don't all stand on its centre. Optional.
 */
function QuarterChips({ location, onPick }) {
  const [all, setAll] = useState(false)
  const found = quartersFor(location)
  if (!found) return null
  const { city, quarters } = found
  const selected = quarters.findIndex((quarter) => quarter.label === location)
  const visible = all || selected >= SHOWN ? quarters : quarters.slice(0, SHOWN)
  return (
    <div className="qc" role="group" aria-label={`Dio grada: ${city}`}>
      <div className="qc-head">
        <strong>Koji dio grada?</strong>
        <span>Opciono, da se posao na mapi vidi na pravom mjestu</span>
      </div>
      <div className="qc-list">
        {visible.map(({ label, name }) => {
          const active = label === location
          return (
            <button key={label} type="button" className={`qc-chip ${active ? 'active' : ''}`} aria-pressed={active}
              onClick={() => onPick(active ? city : label)}>
              {name}
            </button>
          )
        })}
        {visible.length < quarters.length && (
          <button type="button" className="qc-more" onClick={() => setAll(true)}>Još {quarters.length - visible.length}</button>
        )}
      </div>
    </div>
  )
}

export default QuarterChips
