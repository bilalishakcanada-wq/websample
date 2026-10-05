import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Crown, Flame, Megaphone } from 'lucide-react'
import { keys } from '../hooks/queryKeys'
import { activePromotion, promotionService } from '../services/promotionService'
import { confirmDialog } from '../utils/dialog'
import { toast } from './Toaster'
import ActionError from './ActionError'
import './Promotion.css'

const km = (value) => `${Number(value || 0).toLocaleString('bs-BA', { maximumFractionDigits: 2 })} KM`
const untilLabel = (iso) => new Date(iso).toLocaleDateString('bs-BA', { day: 'numeric', month: 'long' })

const TIER_COPY = {
  standard: { title: 'Standardni', hint: 'Redovno mjesto u pretrazi' },
  hitno: { title: 'Hitno', hint: 'Žuto istaknut, uvijek iznad običnih oglasa' },
  vip: { title: 'VIP', hint: 'Prvi u pretrazi i zlatni pin koji pulsira na mapi' },
}
const TierIcon = ({ tier, size = 16 }) => (tier === 'vip' ? <Crown size={size} /> : tier === 'hitno' ? <Flame size={size} /> : <Megaphone size={size} />)

/** Packages + the signed-in person's balance; null until supabase/marketplace/01 is on the database (UI stays hidden). */
export function usePromotionOptions(userId, enabled = true) {
  return useQuery({
    queryKey: keys.promotionOptions(userId),
    queryFn: () => promotionService.options(),
    enabled: Boolean(userId) && enabled,
    staleTime: 60 * 1000,
    meta: { persist: false },
  }).data ?? null
}

/** "Hitno" / "VIP" chip on cards, the map popup and the job page. */
export function PromoBadge({ tier, className = '' }) {
  if (!tier || tier === 'standard') return null
  return (
    <span className={`promo-badge is-${tier} ${className}`} data-testid={`promo-badge-${tier}`}>
      <TierIcon tier={tier} size={12} /> {tier === 'vip' ? 'VIP' : 'Hitno'}
    </span>
  )
}

/**
 * Izbor paketa pri objavi posla (računar i telefon). Plaća se sa Zadatak Pay balansa tek
 * kad se posao objavi; paket koji balans ne pokriva nudi dopunu umjesto da padne pri objavi.
 */
export function PromotionPicker({ value = 'standard', onChange, options }) {
  if (!options?.plans?.length) return null
  const balance = Number(options.balance || 0)
  const rows = [{ tier: 'standard', price_km: 0 }, ...options.plans]
  return (
    <fieldset className="promo-picker" data-testid="promo-picker">
      <legend>Izdvoji oglas <small>(opciono)</small></legend>
      {rows.map((plan) => {
        const copy = TIER_COPY[plan.tier] || { title: plan.label, hint: '' }
        const short = Number(plan.price_km) > balance
        const selected = value === plan.tier
        return (
          <button
            key={plan.tier}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`promo-option is-${plan.tier} ${selected ? 'is-selected' : ''} ${short ? 'is-short' : ''}`}
            onClick={() => !short && onChange(plan.tier)}
            aria-disabled={short || undefined}
            data-testid={`promo-option-${plan.tier}`}
          >
            <span className="promo-option-icon"><TierIcon tier={plan.tier} size={18} /></span>
            <span className="promo-option-text">
              <strong>{copy.title}</strong>
              <small>{copy.hint}{plan.days ? ` · ${plan.days} dana` : ''}</small>
              {short && <small className="promo-option-short">Treba ti još {km(Number(plan.price_km) - balance)}</small>}
            </span>
            <span className="promo-option-price">{Number(plan.price_km) > 0 ? km(plan.price_km) : 'Besplatno'}</span>
            <span className="promo-option-check" aria-hidden="true">{selected && <Check size={16} />}</span>
          </button>
        )
      })}
      <p className="promo-picker-note">
        Plaća se sa Zadatak Pay balansa kad objaviš posao. Stanje: <strong>{km(balance)}</strong>
        {rows.some((plan) => Number(plan.price_km) > balance) && <> · <Link to="/account/novcanik">Dopuni balans</Link></>}
      </p>
    </fieldset>
  )
}

/** After a new job is published: buy the package picked in the form. The job stays published either way. */
export async function promoteAfterPublish(listingId, tier) {
  if (!tier || tier === 'standard') return
  try {
    await promotionService.promote(listingId, tier)
    toast(tier === 'vip' ? 'Oglas je VIP: prvi je u pretrazi.' : 'Oglas je označen kao hitan.', { kind: 'success' })
  } catch (error) {
    toast(`Posao je objavljen, ali nije izdvojen: ${error.message} Možeš ga izdvojiti na stranici posla.`, { kind: 'error', duration: 7000 })
  }
}

/** Vlasnik na stranici svog otvorenog posla: izdvoji ga ili ga podigni na VIP. */
export function PromoteCard({ listing, userId, onDone, compact = false }) {
  const queryClient = useQueryClient()
  const eligible = listing?.status === 'published' && !listing?.invited_provider && listing?.user_id === userId
  const options = usePromotionOptions(userId, eligible)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)
  if (!eligible || !options?.plans?.length) return null

  const active = activePromotion(listing)
  const rank = { hitno: 1, vip: 2 }
  const offers = options.plans.filter((plan) => (rank[plan.tier] || 0) > (rank[active] || 0))

  const buy = async (plan) => {
    const ok = await confirmDialog({
      title: `Izdvojiti posao kao ${plan.label}?`,
      text: `${km(plan.price_km)} se skida sa tvog Zadatak Pay balansa (stanje ${km(options.balance)}). Traje ${plan.days} dana.`,
      confirmLabel: `Plati ${km(plan.price_km)}`,
    })
    if (!ok) return
    setBusy(plan.tier)
    setError(null)
    try {
      await promotionService.promote(listing.id, plan.tier)
      toast(plan.tier === 'vip' ? 'Posao je VIP: prvi je u pretrazi i ima zlatni pin.' : 'Posao je označen kao hitan.', { kind: 'success' })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      queryClient.invalidateQueries({ queryKey: keys.promotionOptions(userId) })
      await onDone?.()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setBusy('')
    }
  }

  return (
    <section className={`promo-card ${active ? `is-${active}` : ''} ${compact ? 'is-compact' : ''}`} data-testid="promote-card">
      <div className="promo-card-head">
        <TierIcon tier={active || 'standard'} size={18} />
        {active
          ? <strong>{active === 'vip' ? 'VIP oglas' : 'Hitan oglas'} do {untilLabel(listing.promoted_until)}</strong>
          : <strong>Brže do ponuda: izdvoji oglas</strong>}
      </div>
      {!active && <p>Izdvojeni poslovi su uvijek na vrhu pretrage u svom radijusu.</p>}
      {offers.length > 0 && (
        <div className="promo-card-actions">
          {offers.map((plan) => (
            <button key={plan.tier} type="button" className={`promo-buy is-${plan.tier}`} disabled={Boolean(busy)} onClick={() => buy(plan)} data-testid={`promote-${plan.tier}`}>
              <TierIcon tier={plan.tier} size={15} />
              {busy === plan.tier ? 'Plaćam…' : `${active ? 'Podigni na ' : ''}${plan.label} · ${km(plan.price_km)}`}
            </button>
          ))}
        </div>
      )}
      <ActionError error={error} />
    </section>
  )
}
