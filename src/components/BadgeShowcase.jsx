import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import TierMedal from './TierMedal'
import { BadgeVaultModal } from './BadgeVault'
import { useTopBadges } from '../hooks/useTopBadges'
import './BadgeRanking.css'

/**
 * Zaglavlje profila: 5 najjačih znački (po težini). Ostale ostaju u trezoru,
 * koji vidi i otvara samo vlasnik profila ("Pogledaj sve značke").
 */
function BadgeShowcase({ badges, isOwn = false, userId, compact = false }) {
  const { top, rest } = useTopBadges(badges, 5)
  const [vaultOpen, setVaultOpen] = useState(false)
  if (top.length === 0 && !isOwn) return null

  return (
    <section className={`badge-showcase ${compact ? 'is-compact' : ''}`} aria-label="Najjače značke">
      {top.length > 0 ? (
        <ul className="badge-showcase-list">
          {top.map((badge) => (
            <li key={badge.code} className={`badge-showcase-item tier-${badge.tier.key}`} title={badge.description || badge.label}>
              <TierMedal badge={badge} size={compact ? 40 : 46} />
              <span className="badge-showcase-text">
                <strong>{badge.label}</strong>
                <small>{badge.tier.label}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-text">Još nemaš značku. Prva stiže kad potvrdiš e-mail ili telefon.</p>
      )}
      <div className="badge-showcase-foot">
        {rest.length > 0 && <small>+{rest.length} {rest.length === 1 ? 'značka' : rest.length < 5 ? 'značke' : 'znački'}</small>}
        {isOwn && (
          <button type="button" className="badge-showcase-all" onClick={() => setVaultOpen(true)}>
            Pogledaj sve značke <ChevronRight size={15} />
          </button>
        )}
      </div>
      {vaultOpen && <BadgeVaultModal userId={userId} earnedBadges={badges} onClose={() => setVaultOpen(false)} />}
    </section>
  )
}

export default BadgeShowcase
