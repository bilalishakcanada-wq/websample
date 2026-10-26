import { BadgeCheck, Star } from 'lucide-react'

const jobsDone = (n) => {
  const last = n % 10
  const teen = n % 100 >= 11 && n % 100 <= 14
  return `${n} ${last === 1 && !teen ? 'završen posao' : 'završenih poslova'}`
}

/**
 * What a client looks at before choosing someone, on every offer card: verified, rating and how many
 * jobs they finished. `m` is a row of bidder_metrics (null while it loads or for people who can't see it).
 */
function TrustLine({ m }) {
  if (!m) return null
  const reviews = Number(m.review_count) || 0
  const done = Number(m.completed_jobs) || 0
  return (
    <span className="trust-line">
      {m.is_verified && <span className="trust-line-verified"><BadgeCheck size={15} /> Provjeren</span>}
      {reviews > 0
        ? <span className="trust-line-rating"><Star size={14} fill="currentColor" /> <b>{Number(m.avg_rating).toFixed(1)}</b> ({reviews})</span>
        : <span className="trust-line-muted">Bez recenzija</span>}
      <span className={done > 0 ? '' : 'trust-line-muted'}>{done > 0 ? jobsDone(done) : 'Još nema završenih'}</span>
      {m.success_rate != null && done > 0 && <span><b>{Math.round(m.success_rate)}%</b> uspješnost</span>}
    </span>
  )
}

export default TrustLine
