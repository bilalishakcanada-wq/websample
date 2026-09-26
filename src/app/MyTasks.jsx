import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronDown, MapPin, Plus, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useMyBids, useMyListings } from '../hooks/queries'
import { timeAgo } from '../utils/dateFormat'
import { useMode } from './mode'
import { useBackToClose } from '../hooks/useBackToClose'
import { usePresence } from '../hooks/usePresence'
import { EmptyBoxMascot } from './Mascots'
import NotifBellLink from '../components/NotifBellLink'
import './app.css'
import { SkeletonMtCard } from '../components/Skeleton'

const STATUS = { published: ['Objavljen', 'open'], assigned: ['Dodijeljen', 'assigned'], completed: ['Završen', 'done'], cancelled: ['Otkazan', 'off'] }
const BID_STATUS = { pending: ['Ponuda poslana', 'open'], accepted: ['Dodijeljen tebi', 'done'], rejected: ['Nije prošla', 'off'], withdrawn: ['Povučena', 'off'] }
const JOB_FILTERS = [['all', 'Svi poslovi'], ['published', 'Objavljeni'], ['assigned', 'Dodijeljeni'], ['completed', 'Završeni'], ['cancelled', 'Otkazani']]
const BID_FILTERS = [['all', 'Sve ponude'], ['pending', 'Čekaju odgovor'], ['accepted', 'Dodijeljeni meni'], ['rejected', 'Nisu prošle']]
const EMPTY = []
const money = (value) => (value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} KM`)
const when = (description) => ((description || '').split('\n\nKada:')[1] || '').trim() || 'Fleksibilan termin'

/** "Moji poslovi": jobs I posted and offers I sent — cards like the browse list, with a status filter. */
function MyTasks() {
  const { user } = useAuth()
  const [mode] = useMode()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || (mode === 'tasker' ? 'ponude' : 'objavljeni')
  const [filter, setFilter] = useState('all')
  const [pick, setPick] = useState(false)
  useBackToClose(pick, () => setPick(false))
  const pickSheet = usePresence(pick, 220)

  // cached reads: the tab opens instantly with what was there, then refreshes
  const jobsQuery = useMyListings(user.id)
  const bidsQuery = useMyBids(user.id)
  const jobs = useMemo(() => (jobsQuery.isPending ? null : (jobsQuery.data || EMPTY)), [jobsQuery.isPending, jobsQuery.data])
  const bids = useMemo(() => (bidsQuery.isPending ? null : (bidsQuery.data || EMPTY)), [bidsQuery.isPending, bidsQuery.data])
  const failed = jobsQuery.isError || bidsQuery.isError
  // a failed load says so (with a retry) instead of pretending the list is empty
  const retryCard = failed && (
    <div className="ap-empty">
      <strong>Nije se učitalo</strong>
      <span>Provjeri internet i pokušaj ponovo.</span>
      <button type="button" className="ap-btn ap-btn-primary ap-btn-inline" onClick={() => { jobsQuery.refetch(); bidsQuery.refetch() }}>Pokušaj ponovo</button>
    </div>
  )

  const switchTab = (next) => { setParams({ tab: next }, { replace: true }); setFilter('all') }
  const filters = tab === 'objavljeni' ? JOB_FILTERS : BID_FILTERS
  const filterLabel = filters.find(([id]) => id === filter)?.[1] || filters[0][1]
  const visibleJobs = useMemo(() => (jobs || []).filter((job) => filter === 'all' || job.status === filter), [jobs, filter])
  const visibleBids = useMemo(() => (bids || []).filter((bid) => filter === 'all' || bid.status === filter), [bids, filter])

  return (
    <div className="ap ap-page mt">
      <div className="ap-sticky">
        <header className="ap-page-head"><h1>Moji poslovi</h1><NotifBellLink /></header>
        <div className="ap-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'objavljeni'} className={tab === 'objavljeni' ? 'active' : ''} onClick={() => switchTab('objavljeni')}>Objavio/la sam {jobs ? `(${jobs.length})` : ''}</button>
          <button type="button" role="tab" aria-selected={tab === 'ponude'} className={tab === 'ponude' ? 'active' : ''} onClick={() => switchTab('ponude')}>Moje ponude {bids ? `(${bids.length})` : ''}</button>
        </div>
      </div>

      <button type="button" className="mt-filter" onClick={() => setPick(true)} aria-haspopup="listbox" aria-expanded={pick}>{filterLabel} <ChevronDown size={16} /></button>
      {pickSheet.mounted && (
        <div className={`ap-sheet-backdrop ${pickSheet.closing ? 'is-closing' : ''}`} inert={pickSheet.closing || undefined} onClick={() => setPick(false)}>
          <div className="ap-sheet" role="listbox" onClick={(event) => event.stopPropagation()}>
            <span className="ap-sheet-handle" style={{ display: "block" }} />
            {filters.map(([id, label]) => (
              <button key={id} type="button" role="option" aria-selected={filter === id} className={`ap-sheet-option ${filter === id ? 'active' : ''}`} onClick={() => { setFilter(id); setPick(false) }}>{label}{filter === id && <Check size={18} />}</button>
            ))}
          </div>
        </div>
      )}

      {tab === 'objavljeni' && (
        <section className="ap-section">
          {jobs === null && <div className="mt-list"><SkeletonMtCard /><SkeletonMtCard /></div>}
          {retryCard}
          {jobs && jobs.length === 0 && !failed && (
            <div className="ap-empty ap-empty-art">
              <EmptyBoxMascot />
              <strong>Još nemaš objavljenih poslova</strong>
              <span>Opiši šta ti treba i ponude stižu brzo.</span>
              <Link to="/objavi" className="ap-btn ap-btn-primary ap-btn-inline"><Plus size={16} /> Objavi posao</Link>
            </div>
          )}
          {jobs && jobs.length > 0 && visibleJobs.length === 0 && <p className="jd-empty">Nema poslova u ovom filteru.</p>}
          <div className="mt-list">
            {visibleJobs.map((job) => {
              const [label, tone] = STATUS[job.status] || STATUS.published
              const offers = job.bids?.[0]?.count || 0
              return (
                <Link key={job.id} to={`/listings/${job.id}`} className="mt-card">
                  <div className="mt-card-head"><strong>{job.title}</strong><em>{money(job.price)}</em></div>
                  <span><MapPin size={14} /> {job.location || 'Online'}</span>
                  <span><CalendarDays size={14} /> {when(job.description)}</span>
                  <div className="mt-card-foot">
                    <b className={`mt-state s-${tone}`}>{label}</b>
                    <small><Users size={13} /> {offers === 0 ? 'Još nema ponuda' : `${offers} ${offers === 1 ? 'ponuda' : offers < 5 ? 'ponude' : 'ponuda'}`}</small>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'ponude' && (
        <section className="ap-section">
          {bids === null && <div className="mt-list"><SkeletonMtCard /><SkeletonMtCard /></div>}
          {retryCard}
          {bids && bids.length === 0 && !failed && (
            <div className="ap-empty ap-empty-art">
              <EmptyBoxMascot />
              <strong>Još nisi poslao/la nijednu ponudu</strong>
              <span>Pronađi posao koji ti odgovara i pošalji cijenu.</span>
              <Link to="/search" className="ap-btn ap-btn-primary ap-btn-inline">Pregledaj poslove</Link>
            </div>
          )}
          {bids && bids.length > 0 && visibleBids.length === 0 && <p className="jd-empty">Nema ponuda u ovom filteru.</p>}
          <div className="mt-list">
            {visibleBids.map((bid) => {
              const [label, tone] = BID_STATUS[bid.status] || BID_STATUS.pending
              return (
                <Link key={bid.id} to={`/listings/${bid.listing_id}`} className="mt-card">
                  <div className="mt-card-head"><strong>{bid.listing?.title || 'Posao'}</strong><em>{money(bid.amount)}</em></div>
                  <span><MapPin size={14} /> {bid.listing?.location || 'Online'}</span>
                  <span><CalendarDays size={14} /> Ponuda poslana {timeAgo(bid.created_at)}</span>
                  <div className="mt-card-foot">
                    <b className={`mt-state s-${tone}`}>{label}</b>
                    <small>Tvoja cijena</small>
                  </div>
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
