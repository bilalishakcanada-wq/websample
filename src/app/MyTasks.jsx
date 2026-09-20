import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listingService } from '../services/listingService'
import { bidService } from '../services/bidService'
import { formatBosnianDate } from '../utils/dateFormat'
import { useMode } from './mode'
import { EmptyBoxMascot } from './Mascots'
import './app.css'

const STATUS = { published: ['Otvoren', 'open'], assigned: ['Dodijeljen', 'assigned'], completed: ['Završen', 'done'], cancelled: ['Otkazan', 'off'] }
const BID_STATUS = { pending: ['Čeka odgovor', 'open'], accepted: ['Prihvaćena', 'done'], rejected: ['Odbijena', 'off'], withdrawn: ['Povučena', 'off'] }
const money = (value) => (value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} KM`)

/** "Moji poslovi": the jobs I posted and the offers I sent, as two simple lists. */
function MyTasks() {
  const { user } = useAuth()
  const [mode] = useMode()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || (mode === 'tasker' ? 'ponude' : 'objavljeni')
  const [jobs, setJobs] = useState(null)
  const [bids, setBids] = useState(null)

  useEffect(() => {
    let alive = true
    listingService.listAll({ status: 'published', pageSize: 50, ownerId: user.id }).then((result) => alive && setJobs(result.data || [])).catch(() => alive && setJobs([]))
    bidService.listMine(user.id).then((rows) => alive && setBids(rows)).catch(() => alive && setBids([]))
    return () => { alive = false }
  }, [user.id])

  return (
    <div className="ap ap-page">
      <header className="ap-page-head"><h1>Moji poslovi</h1></header>
      <div className="ap-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'objavljeni'} className={tab === 'objavljeni' ? 'active' : ''} onClick={() => setParams({ tab: 'objavljeni' }, { replace: true })}>Objavljeni {jobs ? `(${jobs.length})` : ''}</button>
        <button type="button" role="tab" aria-selected={tab === 'ponude'} className={tab === 'ponude' ? 'active' : ''} onClick={() => setParams({ tab: 'ponude' }, { replace: true })}>Moje ponude {bids ? `(${bids.length})` : ''}</button>
      </div>

      {tab === 'objavljeni' && (
        <section className="ap-section">
          {jobs === null && <div className="ap-skeleton" />}
          {jobs && jobs.length === 0 && (
            <div className="ap-empty ap-empty-art">
              <EmptyBoxMascot />
              <strong>Još nemaš objavljenih poslova</strong>
              <span>Opiši šta ti treba i ponude stižu brzo.</span>
              <Link to="/objavi" className="ap-btn ap-btn-primary ap-btn-inline"><Plus size={16} /> Objavi posao</Link>
            </div>
          )}
          <div className="ap-list">
            {(jobs || []).map((job) => {
              const [label, tone] = STATUS[job.status] || STATUS.published
              return (
                <Link key={job.id} to={`/listings/${job.id}`} className="ap-row">
                  <div>
                    <strong>{job.title}</strong>
                    <span><Users size={13} /> {job.bids?.[0]?.count || 0} ponuda · {money(job.price)}</span>
                  </div>
                  <em className={`ap-pill ap-pill-${tone}`}>{label}</em>
                  <ChevronRight size={18} />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'ponude' && (
        <section className="ap-section">
          {bids === null && <div className="ap-skeleton" />}
          {bids && bids.length === 0 && (
            <div className="ap-empty ap-empty-art">
              <EmptyBoxMascot />
              <strong>Još nisi poslao/la nijednu ponudu</strong>
              <span>Pronađi posao koji ti odgovara i pošalji cijenu.</span>
              <Link to="/search" className="ap-btn ap-btn-primary ap-btn-inline">Pregledaj poslove</Link>
            </div>
          )}
          <div className="ap-list">
            {(bids || []).map((bid) => {
              const [label, tone] = BID_STATUS[bid.status] || BID_STATUS.pending
              return (
                <Link key={bid.id} to={`/listings/${bid.listing_id}`} className="ap-row">
                  <div>
                    <strong>{bid.listing?.title || 'Posao'}</strong>
                    <span>Tvoja ponuda: {money(bid.amount)} · {formatBosnianDate(bid.created_at)}</span>
                  </div>
                  <em className={`ap-pill ap-pill-${tone}`}>{label}</em>
                  <ChevronRight size={18} />
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

export default MyTasks
