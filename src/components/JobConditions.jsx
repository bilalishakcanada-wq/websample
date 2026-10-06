import { Link } from 'react-router-dom'
import { BadgeCheck, Car, Check, Gift, IdCard, Lock, Sparkles, X } from 'lucide-react'
import { MAX_REQUIRED_BADGES, PERKS, REQUIREMENTS, badgeFixLink, perkShown, requirementLabel, suggestedRequirement } from '../utils/jobConditions'
import './JobConditions.css'

/**
 * "Uslovi i pogodnosti" u formi za objavu (računar i telefon).
 * value = { requires: [...kodovi značaka], perks: [...] } — isti oblik ide u listings.conditions.
 */
export function ConditionsBuilder({ value = {}, onChange, category }) {
  const requires = value.requires || []
  const perks = value.perks || []
  const full = requires.length >= MAX_REQUIRED_BADGES
  const suggested = suggestedRequirement(category)
  const toggle = (key, list, code) => onChange({ ...value, [key]: list.includes(code) ? list.filter((item) => item !== code) : [...list, code] })
  const chip = (key, list, item, disabled = false) => {
    const on = list.includes(item.code)
    return (
      <button
        key={item.code} type="button" data-testid={`condition-${item.code}`}
        className={`jc-chip ${on ? 'is-on' : ''} ${!on && item.code === suggested ? 'is-suggested' : ''}`}
        aria-pressed={on} disabled={!on && disabled}
        onClick={() => toggle(key, list, item.code)}
      >
        {on ? <Check size={15} aria-hidden="true" /> : null}
        <span>{item.label}</span>
        {!on && item.code === suggested && <em>preporučeno</em>}
      </button>
    )
  }
  return (
    <div className="jc-builder">
      <div className="jc-group">
        <strong className="jc-group-title"><BadgeCheck size={16} /> Izvođač mora imati</strong>
        <p className="jc-group-hint">Ponudu mogu poslati samo izvođači s ovim značkama. Potvrđena lična karta važi za svaki posao.</p>
        <div className="jc-chips" role="group" aria-label="Značke koje izvođač mora imati">
          <span className="jc-chip is-fixed"><IdCard size={15} aria-hidden="true" /> <span>Lična karta verifikovana</span></span>
          {REQUIREMENTS.map((item) => chip('requires', requires, item, full))}
        </div>
        {full && <small className="jc-note">Najviše {MAX_REQUIRED_BADGES} značaka — što više uslova, to manje ponuda.</small>}
      </div>
      <div className="jc-group">
        <strong className="jc-group-title"><Gift size={16} /> Ja obezbjeđujem</strong>
        <div className="jc-chips" role="group" aria-label="Šta klijent obezbjeđuje">
          {PERKS.map((item) => chip('perks', perks, item))}
        </div>
      </div>
    </div>
  )
}

/**
 * Na stranici posla: pogodnosti za sve, a uslovi s kvačicom ili križićem za prijavljenog
 * izvođača. Svaki križić vodi pravo na mjesto gdje se značka dobija.
 * held = Set kodova koje korisnik ima (null = gost ili se učitava), identityOk = prošao kapiju identiteta.
 */
export function ConditionsCard({ conditions, travelAllowance, held, identityOk, isOwner, next, phone = false }) {
  const requires = conditions?.requires || []
  const perks = conditions?.perks || []
  const travel = Number(travelAllowance) > 0 ? Number(travelAllowance) : 0
  if (!requires.length && !perks.length && !travel) return null
  const checking = Boolean(held) && !isOwner
  const missing = checking ? requires.filter((code) => !held.has(code)) : []
  const Wrap = phone ? 'div' : 'section'
  const Title = phone ? 'h3' : 'h2'
  return (
    <Wrap className={phone ? 'jd-reqs jc-card' : 'job-card jc-card'} data-testid="job-conditions">
      {requires.length > 0 && (
        <>
          <Title>Traženi uslovi</Title>
          <p className="muted-text">
            {isOwner ? 'Ponude šalju samo izvođači koji imaju ove značke.'
              : checking ? (missing.length ? 'Za ponudu ti nedostaje značka označena crveno.' : 'Ispunjavaš sve uslove — možeš poslati ponudu.')
                : 'Ponudu mogu poslati samo izvođači koji imaju ove značke.'}
          </p>
          <ul className="jc-list">
            {checking && (
              <li className={identityOk ? 'is-met' : 'is-missing'}>
                {identityOk ? <Check size={16} aria-label="Ispunjeno" /> : <X size={16} aria-label="Nedostaje" />}
                <span>Lična karta verifikovana</span>
                {!identityOk && <Link to={badgeFixLink('id_verified', next)}>Potvrdi</Link>}
              </li>
            )}
            {requires.map((code) => {
              const met = checking && held.has(code)
              const state = !checking ? 'is-neutral' : met ? 'is-met' : 'is-missing'
              return (
                <li key={code} className={state} data-testid={`condition-state-${code}`} data-met={checking ? String(met) : undefined}>
                  {!checking ? <Lock size={15} aria-hidden="true" /> : met ? <Check size={16} aria-label="Ispunjeno" /> : <X size={16} aria-label="Nedostaje" />}
                  <span>{requirementLabel(code)}</span>
                  {checking && !met && <Link to={badgeFixLink(code, next)} data-testid={`condition-fix-${code}`}>Osvoji značku</Link>}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {(perks.length > 0 || travel > 0) && (
        <>
          <Title className={requires.length ? 'jc-sub' : ''}>Klijent obezbjeđuje</Title>
          <ul className="jc-perks">
            {travel > 0 && <li><Car size={15} aria-hidden="true" /> Plaća put do {travel.toLocaleString('bs-BA')} KM</li>}
            {perks.map((code) => <li key={code}><Sparkles size={15} aria-hidden="true" /> {perkShown(code)}</li>)}
          </ul>
        </>
      )}
    </Wrap>
  )
}
