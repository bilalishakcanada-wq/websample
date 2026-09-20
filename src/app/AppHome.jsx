import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, MapPin, Search, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useMode } from './mode'
import { serviceCategories } from '../data/categories'
import { listingService } from '../services/listingService'
import { bidService } from '../services/bidService'
import { matchService } from '../services/matchService'
import { useLiveListings } from '../hooks/useLiveListings'
import { formatBosnianDate } from '../utils/dateFormat'
import { haptic } from '../utils/native'
import { prefetchRoute } from '../utils/prefetch'
import PushPrompt from '../components/PushPrompt'
import './app.css'

const QUICK_IDEAS = ['Pomozi mi sa selidbom', 'Generalno čišćenje stana', 'Popravi slavinu', 'Sastavi namještaj', 'Okreči sobu', 'Pomoć oko računara', 'Prošetaj psa', 'Dostavi paket']
const TRENDING = ['gardening', 'painting', 'cleaning', 'moving-transport', 'handyman', 'furniture', 'it-support', 'delivery']
const BID_STATUS = { pending: ['Čeka odgovor', 'open'], accepted: ['Prihvaćena', 'done'], rejected: ['Odbijena', 'off'], withdrawn: ['Povučena', 'off'] }
const money = (value) => (value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} KM`)

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 10) return 'Dobro jutro'
  if (hour < 18) return 'Dobar dan'
  return 'Dobro veče'
}

/** Signed-in phone home. Poster face: "Objavi posao. Riješeno." Tasker face: jobs to take. */
function AppHome() {
  const { user } = useAuth()
  const [mode] = useMode()
  const firstName = (user?.user_metadata?.full_name || '').split(' ')[0]
  return mode === 'tasker' ? <TaskerHome user={user} firstName={firstName} /> : <PosterHome firstName={firstName} />
}

function PosterHome({ firstName }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')

  const start = (text) => {
    haptic('light')
    const draft = { form: { title: (text || '').slice(0, 70), timing: '', date: '', mode: '', location: '', description: '', category: '', price: '' }, step: 0 }
    try { localStorage.setItem('poso-post-draft', JSON.stringify(draft)) } catch { /* ignore */ }
    navigate('/objavi')
  }

  return (
    <div className="ap ap-home">
      <section className="ap-hero">
        <span className="ap-hero-greet">{greeting()}{firstName ? `, ${firstName}` : ''}</span>
        <h1>Objavi posao. Riješeno.</h1>
        <form className="ap-hero-form" onSubmit={(event) => { event.preventDefault(); start(title) }}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} placeholder="U par riječi, šta ti treba?" enterKeyHint="go" onFocus={() => prefetchRoute('/objavi')} />
          <button type="submit"><span>Dobij ponude</span><ArrowRight size={18} /></button>
        </form>
        <div className="ap-hero-chips">
          {QUICK_IDEAS.map((idea) => <button key={idea} type="button" onClick={() => start(idea)}>{idea}</button>)}
        </div>
      </section>

      <div className="ap-home-body">
        <PushPrompt compact />
        <section className="ap-section">
          <h2 className="ap-h2">Treba ti nešto?</h2>
          <p className="ap-p">Pregledaj najtraženije kategorije</p>
          <div className="ap-tiles">
            {TRENDING.map((id) => serviceCategories.find((item) => item.id === id)).filter(Boolean).map(({ id, name, icon: Icon }) => (
              <button key={id} type="button" className="ap-tile" onClick={() => start(name === 'Majstor za sve' ? '' : `${name}: `)}>
                <Icon size={20} />
                <span>{name.split(' i ')[0].split('/')[0]}</span>
              </button>
            ))}
          </div>
          <Link to="/search" className="ap-more">Sve kategorije <ChevronRight size={16} /></Link>
        </section>
      </div>
    </div>
  )
}

function TaskerHome({ user, firstName }) {
  const navigate = useNavigate()
  const { combined: jobs, loading } = useLiveListings({ limit: 8, fallbackToDemo: false })
  const [recommended, setRecommended] = useState([])
  const [bids, setBids] = useState(null)

  useEffect(() => {
    let alive = true
    matchService.recommendedListings(6).then((rows) => alive && setRecommended(rows || [])).catch(() => {})
    bidService.listMine(user.id, 3).then((rows) => alive && setBids(rows)).catch(() => alive && setBids([]))
    return () => { alive = false }
  }, [user.id])

  const feed = recommended.length > 0 ? recommended : jobs

  return (
    <div className="ap ap-home">
      <section className="ap-hero ap-hero-tasker">
        <span className="ap-hero-greet">{greeting()}{firstName ? `, ${firstName}` : ''}</span>
        <h1>Pronađi posao. Zaradi.</h1>
        <button type="button" className="ap-hero-btn" onClick={() => { haptic('light'); navigate('/search') }} onPointerDown={() => prefetchRoute('/search')}>
          <Search size={18} /> <span>Pregledaj poslove u blizini</span> <ArrowRight size={18} />
        </button>
        <div className="ap-hero-chips">
          {['Čišćenje', 'Selidbe i transport', 'Majstor za sve', 'IT podrška', 'Dizajn i kreativne usluge'].map((category) => (
            <Link key={category} to={`/search?category=${encodeURIComponent(category)}`}>{category.split(' i ')[0]}</Link>
          ))}
        </div>
      </section>

      <div className="ap-home-body">
        <PushPrompt compact reason="Javit ćemo ti čim se pojavi posao za tebe." />
        <section className="ap-section">
          <h2 className="ap-h2">{recommended.length > 0 ? 'Poslovi za tebe' : 'Novi poslovi'}</h2>
          <p className="ap-p">{recommended.length > 0 ? 'Odabrani prema tvojim vještinama i gradu' : 'Najnovije objavljeno'}</p>
          {loading && feed.length === 0 && <div className="ap-skeleton" />}
          {!loading && feed.length === 0 && <div className="ap-empty"><strong>Trenutno nema otvorenih poslova</strong><span>Uključi obavijesti — javit ćemo ti čim se pojavi novi.</span></div>}
          <div className="ap-list">
            {feed.map((job) => (
              <Link key={job.id} to={`/listings/${job.id}`} className="ap-job" onPointerDown={() => prefetchRoute('/listings')}>
                <div className="ap-job-main">
                  <strong>{job.title}</strong>
                  <span><MapPin size={13} /> {job.location || 'Bez lokacije'}</span>
                  <span className="ap-job-state">Otvoren{job.bid_count > 0 ? ` · ${job.bid_count} ponuda` : ''}{job.match_score != null ? ` · ${Math.round(job.match_score)}% match` : ''}</span>
                </div>
                <em className="ap-price">{typeof job.price === 'string' ? job.price : money(job.price)}</em>
              </Link>
            ))}
          </div>
          <Link to="/search" className="ap-more">Svi poslovi <ChevronRight size={16} /></Link>
        </section>

        <section className="ap-section">
          <h2 className="ap-h2">Moje ponude</h2>
          {bids === null && <div className="ap-skeleton" />}
          {bids && bids.length === 0 && <div className="ap-empty"><strong>Još nisi poslao/la ponudu</strong><span>Otvori posao i klikni „Pošalji ponudu“.</span></div>}
          {bids && bids.length > 0 && (
            <div className="ap-list">
              {bids.map((bid) => {
                const [label, tone] = BID_STATUS[bid.status] || BID_STATUS.pending
                return (
                  <Link key={bid.id} to={`/listings/${bid.listing_id}`} className="ap-row">
                    <div><strong>{bid.listing?.title || 'Posao'}</strong><span><Users size={13} /> Tvoja ponuda: {money(bid.amount)} · {formatBosnianDate(bid.created_at)}</span></div>
                    <em className={`ap-pill ap-pill-${tone}`}>{label}</em>
                    <ChevronRight size={18} />
                  </Link>
                )
              })}
            </div>
          )}
          <Link to="/moji-poslovi?tab=ponude" className="ap-more">Sve ponude <ChevronRight size={16} /></Link>
        </section>
      </div>
    </div>
  )
}

export default AppHome
