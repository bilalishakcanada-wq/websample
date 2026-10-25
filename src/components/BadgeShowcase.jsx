import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import TierMedal from './TierMedal'
import BadgeDetail from './BadgeDetail'
import { BadgeVaultModal } from './BadgeVault'
import { useTopBadges } from '../hooks/useTopBadges'
import { formatBosnianDate } from '../utils/dateFormat'
import './BadgeRanking.css'

const TIER_NAME = { bronze: 'Bronza', silver: 'Srebro', gold: 'Zlato', platinum: 'Platina' }
const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'značka' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'značke' : 'znački')

/**
 * Profile: the 5 strongest badges (by weight) as a row of medals. The chosen one (the strongest
 * at first; hover or tap picks another) is named and explained underneath; a second tap opens it
 * up close. The rest stay in the vault, which only the profile's owner opens ("Sve značke").
 */
function BadgeShowcase({ badges, isOwn = false, userId, compact = false }) {
  const { top, rest } = useTopBadges(badges, 5)
  const [picked, setPicked] = useState(null)
  const [detail, setDetail] = useState(null)
  const [vaultOpen, setVaultOpen] = useState(false)
  if (top.length === 0 && !isOwn) return null

  const active = top.find((badge) => badge.code === picked) || top[0]
  const choose = (badge) => (active?.code === badge.code ? setDetail(badge) : setPicked(badge.code))

  return (
    <section className={`badge-showcase ${compact ? 'is-compact' : ''}`} aria-label="Značke">
      {top.length > 0 ? (
        <>
          <ul className="badge-shelf">
            {top.map((badge, index) => (
              <li key={badge.code} style={{ '--i': index }}>
                <button
                  type="button"
                  className={`badge-shelf-item tier-${badge.tier.key} ${active.code === badge.code ? 'is-active' : ''}`}
                  onClick={() => choose(badge)}
                  onPointerEnter={(event) => { if (event.pointerType === 'mouse') setPicked(badge.code) }}
                  aria-label={`${badge.label}, ${badge.tier.label}`}
                  aria-pressed={active.code === badge.code}
                >
                  <TierMedal badge={badge} size={compact ? 52 : 48} className="medal-pop" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" key={active.code} className={`badge-spotlight tier-${active.tier.key}`} onClick={() => setDetail(active)}>
            <span className="badge-spotlight-head">
              <strong>{active.label}</strong>
              <span className={`badge-tier-tag tier-${active.tier.key}`}>{TIER_NAME[active.tier.key]}</span>
            </span>
            {active.description && <span className="badge-spotlight-text">{active.description}</span>}
            {active.awarded_at && <small>Osvojeno {formatBosnianDate(active.awarded_at)}</small>}
          </button>
        </>
      ) : (
        <p className="muted-text">Još nemaš značku. Prva stiže kad potvrdiš e-mail ili telefon.</p>
      )}
      {(rest.length > 0 || isOwn) && (
        <div className="badge-showcase-foot">
          <small>{isOwn ? `${top.length + rest.length} ${plural(top.length + rest.length)} ukupno` : `i još ${rest.length} ${plural(rest.length)}`}</small>
          {isOwn && (
            <button type="button" className="badge-showcase-all" onClick={() => setVaultOpen(true)}>
              Sve značke <ChevronRight size={15} />
            </button>
          )}
        </div>
      )}
      {detail && <BadgeDetail badge={detail} onClose={() => setDetail(null)} />}
      {vaultOpen && <BadgeVaultModal userId={userId} earnedBadges={badges} onClose={() => setVaultOpen(false)} />}
    </section>
  )
}

export default BadgeShowcase
