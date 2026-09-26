import { Link } from 'react-router-dom'
import { Car, MapPin } from 'lucide-react'
import { reachFor, reachLabel, travelLabel } from '../utils/reach'
import './TaskExtras.css'

const R = 70 // radius of the reach ring in the drawing

/**
 * "Doseg ponuda": a small radar with the job in the middle, the ring at the distance offers may
 * come from, and the viewer's own city as a dot. Explains why a cheap job far away can't be taken.
 */
function ReachRadar({ listing, myCity, isOwner = false, signedIn = false, compact = false }) {
  const state = reachFor(listing, isOwner ? null : myCity)
  if (!state || state.status === 'remote') return null
  const travel = travelLabel(listing)
  const km = state.reachKm
  const showDot = !isOwner && state.distanceKm != null
  // place my dot on a fixed bearing; past the ring when too far, kept inside the drawing
  const scale = km == null ? Math.min(1, (state.distanceKm || 0) / 150) : Math.min(1.3, (state.distanceKm || 0) / km)
  const dotR = Math.max(10, scale * R)
  const dot = { x: 90 + dotR * Math.cos(-0.7), y: 90 + dotR * Math.sin(-0.7) }

  let tone = 'neutral'
  let title = km == null ? 'Ponude iz cijele BiH' : `Ponude do ${km} km`
  let text
  if (isOwner) {
    text = km == null
      ? 'Posao je dobro plaćen, pa ponude mogu slati izvođači iz cijele BiH.'
      : `Ponude mogu slati izvođači ${reachLabel(km)}. Veći budžet ili plaćen put (gorivo, taksi) proširuje krug.`
  } else if (!signedIn) {
    text = km == null ? 'Dobro plaćen posao — mogu se javiti izvođači iz cijele BiH.' : `Ponude mogu slati izvođači ${reachLabel(km)}. Što je posao bolje plaćen, to izdaleka se izvođači mogu javiti.`
  } else if (state.status === 'ok') {
    tone = 'ok'
    title = 'U dosegu si'
    text = `Udaljen/a si oko ${Math.round(state.distanceKm)} km (${myCity}), a posao prima ponude ${reachLabel(km)}.`
  } else if (state.status === 'too_far') {
    tone = 'far'
    title = 'Predaleko za ovaj posao'
    text = `Udaljen/a si oko ${Math.round(state.distanceKm)} km (${myCity}), a posao prima ponude ${reachLabel(km)}. Za ovu cijenu se ne isplati putovati.`
  } else if (state.status === 'no_limit') {
    tone = 'ok'
    text = state.distanceKm != null
      ? `Dobro plaćen posao — ponude iz cijele BiH. Udaljen/a si oko ${Math.round(state.distanceKm)} km.`
      : 'Dobro plaćen posao — ponude iz cijele BiH.'
  } else if (state.status === 'no_city') {
    tone = 'far'
    title = 'Dodaj svoj grad'
    text = `Posao prima ponude ${reachLabel(km)}. Dodaj grad u profil da vidimo jesi li u dosegu.`
  } else {
    text = `Ponude mogu slati izvođači ${reachLabel(km)}.`
  }

  return (
    <div className={`reach reach-${tone} ${compact ? 'reach-compact' : ''}`}>
      <svg className="reach-radar" viewBox="0 0 180 180" role="img" aria-label={title}>
        <circle cx="90" cy="90" r="88" className="reach-bg" />
        {[0.33, 0.66].map((f) => <circle key={f} cx="90" cy="90" r={R * f} className="reach-grid" />)}
        <circle cx="90" cy="90" r={R} className="reach-ring" />
        <g className="reach-sweep"><path d={`M90 90 L90 ${90 - 88} A88 88 0 0 1 ${90 + 88 * Math.sin(0.6)} ${90 - 88 * Math.cos(0.6)} Z`} /></g>
        <circle cx="90" cy="90" r="6" className="reach-job" />
        {showDot && <circle cx={dot.x} cy={dot.y} r="6" className="reach-me" />}
        <text x="90" y={90 - R - 4} textAnchor="middle" className="reach-km">{km == null ? 'BiH' : `${km} km`}</text>
      </svg>
      <div className="reach-copy">
        <strong>{title}</strong>
        <p>{text}</p>
        {travel && <p className="reach-travel"><Car size={15} /> {travel} (gorivo, taksi, prevoz)</p>}
        {showDot && <p className="reach-legend"><span className="reach-legend-job" /> posao <span className="reach-legend-me" /> ti</p>}
        {!isOwner && signedIn && state.status === 'no_city' && <Link to="/account/profil" className="reach-link"><MapPin size={14} /> Dodaj grad u profil</Link>}
        {isOwner && km != null && listing.status === 'published' && <Link to={`/objavi?edit=${listing.id}&step=budget`} className="reach-link">Povećaj budžet ili dodaj put</Link>}
      </div>
    </div>
  )
}

export default ReachRadar
