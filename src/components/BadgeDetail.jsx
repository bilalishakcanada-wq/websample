import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import TierMedal from './TierMedal'
import { progressOf } from '../utils/badgeRanking'
import { formatBosnianDate } from '../utils/dateFormat'
import { useBackToClose } from '../hooks/useBackToClose'
import './BadgeRanking.css'

const TIER_NAME = { bronze: 'Bronzana značka', silver: 'Srebrna značka', gold: 'Zlatna značka', platinum: 'Platinasta značka' }

/** Napredak do zaključane značke: traka + "3 / 10 poslova · još 7". */
export function BadgeProgress({ progress, className = '' }) {
  const value = progressOf(progress)
  if (!value) return null
  return (
    <span className={`badge-progress ${className}`}>
      <span className="badge-progress-bar"><span style={{ '--fill': value.ratio }} /></span>
      <small>{value.current} / {value.target} {value.unit}{value.left > 0 ? ` · još ${value.left}` : ''}</small>
    </span>
  )
}

/**
 * Jedna značka izbliza: velika medalja, nivo, opis i kad je osvojena, ili kako se otključava.
 * Centrirano na računaru, list odozdo na telefonu. Escape, dodir pored ili "nazad" zatvara.
 */
function BadgeDetail({ badge, onClose }) {
  useBackToClose(true, onClose)
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = overflow }
  }, [onClose])

  const locked = badge.earned === false
  return createPortal(
    <div className="badge-detail-backdrop" role="presentation" onClick={onClose}>
      <div className={`badge-detail tier-${badge.tier.key} ${locked ? 'is-locked' : ''}`} role="dialog" aria-modal="true" aria-label={badge.label} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="badge-detail-close" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
        <div className="badge-detail-stage">
          <TierMedal badge={badge} size={168} locked={locked} stamp={!locked} />
        </div>
        <span className={`badge-tier-tag tier-${badge.tier.key}`}>{locked ? `${badge.tier.label} · zaključana` : TIER_NAME[badge.tier.key]}</span>
        <h2>{badge.label}</h2>
        {locked ? (
          <>
            <p><b>Kako je otključati: </b>{badge.unlock_hint || badge.description}</p>
            <BadgeProgress progress={badge.progress} className="is-wide" />
          </>
        ) : (
          <>
            {badge.description && <p>{badge.description}</p>}
            {badge.awarded_at && <small className="badge-detail-date">Osvojeno {formatBosnianDate(badge.awarded_at)}</small>}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default BadgeDetail
