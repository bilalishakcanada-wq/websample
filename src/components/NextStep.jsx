import { ArrowRight } from 'lucide-react'

const SECONDARY = { workflow: 'Pogledaj detalje', messages: 'Poruke', offers: 'Ponude' }

/**
 * „Sljedeći korak“ na vrhu posla: šta se sad dešava i jedno dugme za ono što se od tebe traži.
 * Sadržaj dolazi iz utils/jobStep.js; `onAction` pretvara action u radnju na stranici.
 */
function NextStep({ step, onAction, busy = false, phone = false }) {
  if (!step) return null
  const primary = phone ? 'ap-btn ap-btn-primary' : 'primary-button full-width'
  const quiet = phone ? 'ap-btn ap-btn-light' : 'ghost-button full-width'
  return (
    <div className={`next-step tone-${step.tone} ${phone ? 'is-phone' : ''}`} data-testid="next-step" role="status">
      <strong className="next-step-title">{step.title}</strong>
      <p className="next-step-text">{step.text}</p>
      {step.action && step.cta && (
        <div className="next-step-actions">
          <button type="button" className={step.tone === 'act' ? primary : quiet} onClick={() => onAction(step.action)} disabled={busy} data-testid="next-step-action">
            {step.cta} {step.tone === 'act' && <ArrowRight size={16} />}
          </button>
          {step.secondary && <button type="button" className={`${quiet} next-step-second`} onClick={() => onAction(step.secondary)}>{step.secondaryCta || SECONDARY[step.secondary]}</button>}
        </div>
      )}
    </div>
  )
}

export default NextStep
