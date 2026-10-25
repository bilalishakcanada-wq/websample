import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import TierMedal from './TierMedal'
import { useBadgeVault } from '../hooks/useTopBadges'
import BadgeDetail, { BadgeProgress } from './BadgeDetail'
import { TIERS } from '../utils/badgeRanking'
import { useBackToClose } from '../hooks/useBackToClose'
import './BadgeRanking.css'

const seenKey = (userId) => `zadatak:badges-seen:${userId}`
const readSeen = (userId) => {
  try { return JSON.parse(window.localStorage.getItem(seenKey(userId)) || 'null') } catch { return null }
}
const writeSeen = (userId, codes) => {
  try { window.localStorage.setItem(seenKey(userId), JSON.stringify(codes)) } catch { /* privatni prozor */ }
}

/**
 * Trezor znački (vidi ga samo vlasnik): osvojene značke po težini, pa zaključane (sive) s napretkom.
 * Dodir na pločicu otvara značku izbliza (opis, datum ili kako je otključati).
 */
export function BadgeVault({ userId, earnedBadges }) {
  const { loading, badges } = useBadgeVault(userId, earnedBadges)
  const [open, setOpen] = useState(null)
  const earned = useMemo(() => badges.filter((badge) => badge.earned), [badges])
  const locked = useMemo(() => badges.filter((badge) => !badge.earned), [badges])

  // značke osvojene od zadnje posjete trezoru dobiju "Novo" i jedan odsjaj
  const [seen] = useState(() => readSeen(userId))
  const fresh = useMemo(() => (seen ? new Set(earned.map((badge) => badge.code).filter((code) => !seen.includes(code))) : new Set()), [seen, earned])
  useEffect(() => { if (!loading) writeSeen(userId, earned.map((badge) => badge.code)) }, [loading, userId, earned])

  if (loading) return <div className="vault-grid vault-loading">{Array.from({ length: 8 }, (_, index) => <span key={index} className="vault-tile skeleton-card" />)}</div>

  const counts = [4, 3, 2, 1].map((level) => ({ level, n: earned.filter((badge) => badge.tier_level === level).length }))
  const tile = (badge, index) => (
    <button
      key={badge.code}
      type="button"
      className={`vault-tile tier-${badge.tier.key} ${badge.earned ? 'is-earned' : 'is-locked'} ${fresh.has(badge.code) ? 'is-fresh' : ''}`}
      style={{ '--i': index }}
      onClick={() => setOpen(badge)}
      aria-label={`${badge.label}, ${badge.tier.label}${badge.earned ? '' : ', zaključana'}`}
    >
      {fresh.has(badge.code) && <span className="vault-new">Novo</span>}
      <TierMedal badge={badge} size={78} locked={!badge.earned} stamp={fresh.has(badge.code)} className={fresh.has(badge.code) ? '' : 'medal-pop'} />
      <strong>{badge.label}</strong>
      <small className={`vault-tier tier-${badge.tier.key}`}>{badge.tier.label}</small>
      {!badge.earned && <BadgeProgress progress={badge.progress} />}
    </button>
  )

  return (
    <div className="vault">
      <div className="vault-summary">
        <div className="vault-score">
          <strong>{earned.length}<span> / {badges.length}</span></strong>
          <small>osvojenih znački</small>
          <span className="badge-progress-bar"><span style={{ '--fill': badges.length ? earned.length / badges.length : 0 }} /></span>
        </div>
        <ul className="vault-tier-counts">
          {counts.map(({ level, n }) => (
            <li key={level} className={`vault-tier-count tier-${TIERS[level].key} ${n ? '' : 'is-zero'}`}>
              <i aria-hidden="true">{'★'.repeat(level)}</i>
              <span><b>{n}</b>{TIERS[level].label}</span>
            </li>
          ))}
        </ul>
      </div>
      {fresh.size > 0 && (
        <p className="vault-celebrate">{fresh.size > 1 ? `${fresh.size} nove značke` : 'Nova značka'} od tvoje zadnje posjete. Odmah je na tvom profilu.</p>
      )}

      {earned.length > 0 && (
        <section className="vault-section" aria-label="Osvojene">
          <h3>Osvojene <span>{earned.length}</span></h3>
          <div className="vault-grid">{earned.map(tile)}</div>
        </section>
      )}
      {locked.length > 0 && (
        <section className="vault-section" aria-label="Još za otključati">
          <h3>Još za otključati <span>{locked.length}</span></h3>
          <div className="vault-grid">{locked.map((badge, index) => tile(badge, earned.length + index))}</div>
        </section>
      )}
      <p className="muted-text vault-foot">Drugi vide samo tvojih 5 najjačih znački. Licence i dokumente dodaješ u <Link to="/account/znacke">Moj nalog → Značke</Link>.</p>
      {open && <BadgeDetail badge={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** Trezor u prozoru (s javnog profila): bottom sheet na telefonu, centriran na računaru. */
export function BadgeVaultModal({ userId, earnedBadges, onClose }) {
  useBackToClose(true, onClose)
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
