import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, MapPin, Search, Users, Truck, Sparkles, Wrench, Armchair, PaintRoller, Laptop, Dog, Package } from 'lucide-react'
import { EarnMascot } from './Mascots'
import { useAuth } from '../context/AuthContext'
import { useMode } from './mode'
import { serviceCategories } from '../data/categories'
import { useMyBids, useMyListings, useRecommendedListings } from '../hooks/queries'
import { useLiveListings } from '../hooks/useLiveListings'
import { formatBosnianDate } from '../utils/dateFormat'
import { haptic } from '../utils/native'
import { dropBootScreen } from '../utils/boot'
import { prefetchRoute } from '../utils/prefetch'
import PushPrompt from '../components/PushPrompt'
import NotifBellLink from '../components/NotifBellLink'
import './app.css'

const QUICK_IDEAS = [
  ['Pomozi mi sa selidbom', Truck], ['Generalno čišćenje stana', Sparkles], ['Popravi slavinu', Wrench], ['Sastavi namještaj', Armchair],
  ['Okreči sobu', PaintRoller], ['Pomoć oko računara', Laptop], ['Prošetaj psa', Dog], ['Dostavi paket', Package],
]
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
  useEffect(() => { dropBootScreen() }, [])
  const firstName = (user?.user_metadata?.full_name || '').split(' ')[0]
  return mode === 'tasker' ? <TaskerHome user={user} firstName={firstName} /> : <PosterHome firstName={firstName} />
}

const STATE = { published: ['Čekaš ponude', 'open'], assigned: ['Dodijeljen', 'assigned'] }

/** The poster's open jobs, right under the hero — one tap to the offers (like "Your tasks" in the apps people know). */
function MyOpenJobs({ userId }) {
  const { data } = useMyListings(userId)
  const jobs = (data || []).filter((job) => job.status === 'published' || job.status === 'assigned').slice(0, 3)
  if (jobs.length === 0) return null
  return (
    <section className="ap-section ap-myjobs">
      <div className="ap-row-head"><h2 className="ap-h2">Tvoji poslovi</h2><Link to="/moji-poslovi" className="ap-more">Svi <ChevronRight size={16} /></Link></div>
      <div className="mt-list">
        {jobs.map((job) => {
          const [label, tone] = STATE[job.status] || STATE.published
          const offers = job.bids?.[0]?.count || 0
          return (
            <Link key={job.id} to={`/listings/${job.id}`} className="mt-card mt-card-compact" onClick={() => haptic('light')}>
              <div className="mt-card-head"><strong>{job.title}</strong><em>{job.price == null ? 'Po dogovoru' : `${Number(job.price).toLocaleString('bs-BA')} KM`}</em></div>
              <div className="mt-card-foot">
                <b className={`mt-state s-${tone}`}>{label}</b>
                <small><Users size={13} /> {offers === 0 ? 'Još nema ponuda' : `${offers} ${offers === 1 ? 'ponuda' : offers < 5 ? 'ponude' : 'ponuda'}`}</small>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function PosterHome({ firstName }) {
  const navigate = useNavigate()
  const { user } = useAuth()
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
        <div className="ap-hero-top"><span className="ap-hero-greet">{greeting()}{firstName ? `, ${firstName}` : ''}</span><NotifBellLink className="ap-hero-bell" /></div>
        <h1>Objavi posao. Riješeno.</h1>
        <form className="ap-hero-form" onSubmit={(event) => { event.preventDefault(); start(title) }}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} placeholder="U par riječi, šta ti treba?" enterKeyHint="go" onFocus={() => prefetchRoute('/objavi')} />
          <button type="submit"><span>Dobij ponude</span><ArrowRight size={18} /></button>
        </form>
        <div className="ap-hero-chips">
          {QUICK_IDEAS.map(([idea, Icon]) => <button key={idea} type="button" onClick={() => start(idea)}><Icon size={18} /> {idea}</button>)}
        </div>
      </section>

      <div className="ap-home-body">
        <PushPrompt compact />
        <MyOpenJobs userId={user.id} />
        <Link to="/account/profil" className="ap-promo" onClick={() => haptic('light')}>
          <div>
            <span className="ap-promo-eyebrow">Poso.ba za izvođače</span>
            <strong>Zaradi uz poslove u svom gradu</strong>
            <p>Pošalji ponudu za minutu — klijent plaća unaprijed, tebi zarada sjeda na balans.</p>
            <em>Postani izvođač →</em>
          </div>
          <EarnMascot />
        </Link>
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
  const recommendedQuery = useRecommendedListings(user.id, 6)
  const bidsQuery = useMyBids(user.id, 3)
  const recommended = recommendedQuery.data || []
  const bids = bidsQuery.isPending ? null : (bidsQuery.data || [])

  const feed = recommended.length > 0 ? recommended : jobs

  return (
    <div className="ap ap-home">
      <section className="ap-hero ap-hero-tasker">
        <div className="ap-hero-top"><span className="ap-hero-greet">{greeting()}{firstName ? `, ${firstName}` : ''}</span><NotifBellLink className="ap-hero-bell" /></div>
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
          {loading && feed.length === 0 && <><div className="ap-skeleton" /><div className="ap-skeleton" /><div className="ap-skeleton" /></>}
          {!loading && feed.length === 0 && <div className="ap-empty"><strong>Trenutno nema otvorenih poslova</strong><span>Uključi obavijesti — javit ćemo ti čim se pojavi novi.</span></div>}
          <div className="ap-list">
            {feed.map((job) => (
              <Link key={job.id} to={`/listings/${job.id}`} className="ap-job" onPointerDown={() => prefetchRoute('/listings')}>
                <div className="ap-job-main">
                  <strong>{job.title}</strong>
                  <span><MapPin size={13} /> {job.location || 'Bez lokacije'}</span>
                  <span className="ap-job-state">Otvoren{job.bid_count > 0 ? ` · ${job.bid_count} ponuda` : ''}{job.match_score != null ? ` · ${Math.round(job.match_score)}% za tebe` : ''}</span>
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
