import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HelpCircle, Lock } from 'lucide-react'
import { accountService } from '../../services/accountService'

const formatKM = (value) => `${String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} KM`

/** Medal illustration per tier — ribbon in our navy/gold, disc in the tier metal. */
export function TierMedal({ code, size = 64, locked = false }) {
  const metal = { bronze: ['#c8792c', '#8a4d15'], silver: ['#d9dde3', '#8f97a3'], gold: ['#f5c542', '#b8860b'], platinum: ['#e9f1ff', '#7f9bbf'] }[code] || ['#ccc', '#999']
  return (
    <svg className={`tier-medal ${locked ? 'locked' : ''}`} viewBox="0 0 64 80" width={size} height={size * 1.25} aria-hidden="true">
      <path d="M20 0h24l-6 30H26z" fill="#0d2a52" />
      <path d="M26 0h12l-3 30h-6z" fill="#f5b400" />
      <circle cx="32" cy="52" r="24" fill={metal[1]} />
      <circle cx="32" cy="52" r="19" fill={metal[0]} />
      <circle cx="32" cy="52" r="19" fill="url(#shine)" opacity="0.35" />
      <polygon points="32,40 43,59 21,59" fill="none" stroke="#0d2a52" strokeWidth="3" strokeLinejoin="round" />
      <defs><linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
    </svg>
  )
}

function TierDashboardPage() {
  const [data, setData] = useState(null)
  useEffect(() => { accountService.tierDashboard().then(setData) }, [])

  if (!data) return <div className="account-section"><div className="skeleton-card" /></div>

  const { current, next, tiers, earned_30d: earned, completed_30d: completed, cancelled_30d: cancelled } = data
  const max = tiers[tiers.length - 1].min_30d_km
  const pct = Math.min(100, Math.round((Number(earned) / max) * 100))
  const toNext = next ? Math.max(0, Number(next.min_30d_km) - Number(earned)) : 0

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Ploča izvođača</h1></div>

      <span className="account-eyebrow">Tvoj trenutni nivo</span>
      <div className="tier-current">
        <TierMedal code={current.code} />
        <div>
          <strong>{current.label}</strong>
          <span>{current.fee_percent}% naknada platforme po završenom poslu</span>
        </div>
      </div>

      {next && (
        <>
          <span className="account-eyebrow">Sljedeći nivo</span>
          <div className="tier-current tier-next">
            <TierMedal code={next.code} size={56} locked />
            <div>
              <strong>{next.label} <Lock size={16} /></strong>
              <span>{next.fee_percent}% naknada platforme</span>
            </div>
          </div>
        </>
      )}

      <h3 className="account-sub">Tvoja zarada (zadnjih 30 dana)</h3>
      <p>
        {next
          ? <>Nedostaje ti <strong>{formatKM(toNext)}</strong> do nivoa <strong>{next.label}</strong> i niže naknade.</>
          : <>Na najvišem si nivou — najniža naknada na platformi.</>}
        {' '}Završeno: {completed} {completed === 1 ? 'posao' : 'poslova'}{cancelled ? `, otkazano: ${cancelled}` : ''}.
      </p>
      <div className="tier-bar">
        <div className="tier-bar-fill" style={{ width: `${pct}%` }}><span>{formatKM(earned)}</span></div>
      </div>
      <div className="tier-bar-scale">
        {tiers.map((tier) => <span key={tier.code}>{tier.sort === tiers.length ? `${formatKM(tier.min_30d_km)}+` : formatKM(tier.min_30d_km)}</span>)}
      </div>

      <Link to="/nivoi" className="tier-help"><HelpCircle size={18} /> Kako funkcionišu nivoi?</Link>
    </div>
  )
}

export default TierDashboardPage
