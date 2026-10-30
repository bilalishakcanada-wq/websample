import { useEffect, useState } from 'react'
import { TrendingUp, UserPlus, Zap } from 'lucide-react'
import { adminService } from '../../services/adminService'
import { SkeletonRows } from '../../components/Skeleton'

const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : '–')
// written by hand: some browsers lack 'bs-BA' date data (see utils/dateFormat.js)
const weekLabel = (iso) => { const [, month, day] = iso.split('-'); return `${Number(day)}.${Number(month)}.` }

/**
 * Rast: new accounts per week and how many of them got going in their first 7 days
 * (posted a job or sent an offer). Counted in the database (supabase/analytics/01_signups_activation.sql).
 */
function GrowthTab() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminService.growth(8).then(setRows).catch((requestError) => setError(requestError.message))
  }, [])

  if (error) return <div className="dossier-card"><p className="form-error">{error}</p></div>
  if (!rows) return <SkeletonRows n={4} />

  const signups = rows.reduce((sum, row) => sum + row.signups, 0)
  const activated = rows.reduce((sum, row) => sum + row.activated, 0)

  return (
    <div className="admin-table">
      <div className="wallet-kpis growth-kpis">
        <div className="wallet-kpi main"><UserPlus size={18} /><strong>{signups}</strong><span>novih naloga u 8 sedmica</span></div>
        <div className="wallet-kpi"><Zap size={18} /><strong>{activated}</strong><span>aktivirano (posao ili ponuda u prvih 7 dana)</span></div>
        <div className="wallet-kpi"><TrendingUp size={18} /><strong>{percent(activated, signups)}</strong><span>stopa aktivacije</span></div>
      </div>
      <section className="dossier-card">
        <h3><TrendingUp size={16} /> Po sedmicama</h3>
        <p className="muted-text">Aktiviran je nalog koji je u prvih 7 dana objavio posao ili poslao ponudu. Za nalog iz ove sedmice broj još raste.</p>
        <div className="growth-table" role="table" aria-label="Registracije i aktivacija po sedmicama">
          <div className="growth-row growth-head" role="row">
            <span role="columnheader">Sedmica od</span>
            <span role="columnheader">Novi nalozi</span>
            <span role="columnheader">Aktivirano</span>
            <span role="columnheader">Objavili posao</span>
            <span role="columnheader">Poslali ponudu</span>
          </div>
          {rows.map((row) => (
            <div className="growth-row" role="row" key={row.week_start}>
              <span role="cell">{weekLabel(row.week_start)}</span>
              <span role="cell">{row.signups}</span>
              <span role="cell">{row.activated} <small className="muted-text">({percent(row.activated, row.signups)})</small></span>
              <span role="cell">{row.posted_job}</span>
              <span role="cell">{row.sent_offer}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default GrowthTab
