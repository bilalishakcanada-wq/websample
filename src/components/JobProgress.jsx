import { AlertTriangle, Check, FileCheck2, Megaphone, UserCheck, Wallet, Wrench } from 'lucide-react'
import { workStateOf } from '../utils/jobStep'

const kratko = (value) => (value ? new Date(value).toLocaleDateString('bs-BA', { day: 'numeric', month: 'short' }) : '')
const km = (value) => `${Number(value || 0).toLocaleString('de-DE', { maximumFractionDigits: 2 })} KM`
const ponude = (count) => `${count} ${count === 1 ? 'ponuda' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'ponude' : 'ponuda'}`

/**
 * Cijeli put posla na jednom mjestu: Objavljen → Izvođač → Radi se → Rad predat → Isplaćeno.
 * Svaki korak ima ikonu i datum (ili šta se trenutno čeka), trenutni korak je istaknut.
 */
function JobProgress({ listing, payment = null, bids = [], acceptedBid = null, expired = false }) {
  const state = workStateOf(payment)
  const pending = bids.filter((bid) => bid.status === 'pending').length
  const done = listing.status === 'completed' || state === 'completed'
  const stopped = !done && (listing.status === 'cancelled' || state === 'cancelled' || expired || state === 'disputed')

  let at = 1
  if (done) at = 5
  else if (['submitted', 'disputed'].includes(state) || payment?.status === 'requested') at = 3
  else if (payment || acceptedBid || listing.status === 'assigned') at = 2

  const steps = [
    { icon: Megaphone, label: 'Objavljen', meta: kratko(listing.created_at) },
    { icon: UserCheck, label: 'Izvođač', meta: at > 1 ? (payment ? `${km(payment.amount)} osigurano` : 'Dogovoren') : pending ? ponude(pending) : 'Čeka ponude' },
    { icon: Wrench, label: 'Radi se', meta: at > 2 ? '' : { revision: 'Ispravka', cancel_requested: 'Traži se prekid' }[state] || (at === 2 ? 'U toku' : '') },
    { icon: FileCheck2, label: 'Rad predat', meta: at > 3 ? kratko(payment?.submitted_at) : at === 3 && payment?.review_deadline && state !== 'disputed' ? `Pregled do ${kratko(payment.review_deadline)}` : state === 'disputed' ? 'Prijavljen problem' : '' },
    { icon: Wallet, label: payment ? 'Isplaćeno' : 'Završen', meta: done ? kratko(payment?.released_at) : '' },
  ]
  if (stopped && !['disputed'].includes(state)) steps[at] = { icon: AlertTriangle, label: expired ? 'Rok prošao' : 'Otkazan', meta: '' }

  return (
    <ol className={`job-progress ${done ? 'is-complete' : ''}`} aria-label="Napredak posla" data-testid="job-progress" style={{ '--jp-fill': `${(Math.min(at, 4) / 4) * 100}%` }}>
      {steps.map(({ icon: Icon, label, meta }, index) => {
        const isDone = index < at
        const isNow = index === at && !done
        return (
          <li key={label} className={`${isDone ? 'is-done' : ''} ${isNow ? 'is-now' : ''} ${isNow && stopped ? 'is-stopped' : ''}`} aria-current={isNow ? 'step' : undefined}>
            <span className="jp-dot">{isDone ? <Check size={15} strokeWidth={3} /> : <Icon size={15} />}</span>
            <span className="jp-label">{label}</span>
            {meta && <span className="jp-meta">{meta}</span>}
          </li>
        )
      })}
    </ol>
  )
}

export default JobProgress
