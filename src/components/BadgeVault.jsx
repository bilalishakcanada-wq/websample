import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import TierMedal from './TierMedal'
import { useBadgeVault } from '../hooks/useTopBadges'
import { TIERS, progressOf } from '../utils/badgeRanking'
import { formatBosnianDate } from '../utils/dateFormat'
import './BadgeRanking.css'

const seenKey = (userId) => `zadatak:badges-seen:${userId}`
const readSeen = (userId) => {
  try { return JSON.parse(window.localStorage.getItem(seenKey(userId)) || 'null') } catch { return null }
}
const writeSeen = (userId, codes) => {
  try { window.localStorage.setItem(seenKey(userId), JSON.stringify(codes)) } catch { /* privatni prozor */ }
}

function ProgressLine({ progress }) {
  const value = progressOf(progress)
  if (!value) return null
  return (
    <span className="vault-progress">
      <span className="vault-progress-bar"><span style={{ width: `${Math.round(value.ratio * 100)}%` }} /></span>
      <small>{value.current} / {value.target} {value.unit}{value.left > 0 ? ` · još ${value.left}` : ''}</small>
    </span>
  )
}

/**
 * Trezor znački (vidi ga samo vlasnik): sve osvojene značke po težini, pa zaključane (sive)
 * s uputom kako ih otključati. Dodir / hover / fokus na pločicu otvara objašnjenje.
 */
export function BadgeVault({ userId, earnedBadges }) {
  const { loading, badges } = useBadgeVault(userId, earnedBadges)
  const [open, setOpen] = useState(null)
  const earned = useMemo(() => badges.filter((badge) => badge.earned), [badges])

  // značke osvojene od zadnje posjete trezoru dobiju "Novo" i kratku proslavu
  const [seen] = useState(() => readSeen(userId))
  const fresh = useMemo(() => (seen ? new Set(earned.map((badge) => badge.code).filter((code) => !seen.includes(code))) : new Set()), [seen, earned])
  useEffect(() => { if (!loading) writeSeen(userId, earned.map((badge) => badge.code)) }, [loading, userId, earned])

  if (loading) return <div className="vault-grid vault-loading">{Array.from({ length: 8 }, (_, index) => <span key={index} className="vault-tile skeleton-card" />)}</div>

  const counts = [4, 3, 2, 1].map((level) => ({ level, n: earned.filter((badge) => badge.tier_level === level).length }))

  return (
    <div className="vault">
      <div className="vault-summary">
        <strong>{earned.length} od {badges.length} znački</strong>
        <span className="vault-tier-counts">
          {counts.map(({ level, n }) => <span key={level} className={`vault-tier-count tier-${TIERS[level].key}`}><i />{TIERS[level].label} {n}</span>)}
        </span>
      </div>
      {fresh.size > 0 && (
        <p className="vault-celebrate"><Sparkles size={16} /> Nova značka{fresh.size > 1 ? ` (${fresh.size})` : ''}! Svaka je odmah na tvom profilu, a 5 najjačih je na vrhu.</p>
      )}

      <div className="vault-grid" onMouseLeave={() => setOpen(null)}>
        {badges.map((badge) => {
          const isOpen = open === badge.code
          return (
            <button
              key={badge.code}
              type="button"
              className={`vault-tile ${badge.earned ? 'is-earned' : 'is-locked'} ${fresh.has(badge.code) ? 'is-fresh' : ''} ${isOpen ? 'is-open' : ''}`}
              onClick={() => setOpen(badge.code)}
              onMouseEnter={() => setOpen(badge.code)}
              onFocus={() => setOpen(badge.code)}
              onBlur={() => setOpen(null)}
              aria-expanded={isOpen}
              aria-label={`${badge.label}, ${badge.tier.label}${badge.earned ? '' : ', zaključana'}`}
            >
              {fresh.has(badge.code) && <span className="vault-new">Novo</span>}
              <TierMedal badge={badge} size={52} locked={!badge.earned} />
              <strong>{badge.label}</strong>
              <small className={`vault-tier tier-${badge.tier.key}`}>{badge.tier.label}</small>
              {!badge.earned && <ProgressLine progress={badge.progress} />}
              <span className="vault-tip" role="tooltip">
                {badge.earned
                  ? <>{badge.description}{badge.awarded_at && <em>Osvojeno {formatBosnianDate(badge.awarded_at)}</em>}</>
                  : <><b>Kako je otključati</b>{badge.unlock_hint || badge.description}</>}
              </span>
            </button>
          )
        })}
      </div>
      <p className="muted-text vault-foot">Drugi vide samo tvojih 5 najjačih znački. Licence i dokumente dodaješ u <Link to="/account/znacke">Moj nalog → Značke</Link>.</p>
    </div>
  )
}

/** Trezor u prozoru (s javnog profila): bottom sheet na telefonu, centriran na računaru. */
export function BadgeVaultModal({ userId, earnedBadges, onClose }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
  }, [onClose])

  return createPortal(
    <div className="vault-backdrop" role="presentation" onClick={onClose}>
      <div className="vault-panel" role="dialog" aria-modal="true" aria-label="Sve moje značke" onClick={(event) => event.stopPropagation()}>
        <div className="vault-panel-head">
          <h2>Sve moje značke</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
        </div>
        <BadgeVault userId={userId} earnedBadges={earnedBadges} />
      </div>
    </div>,
    document.body,
  )
}
