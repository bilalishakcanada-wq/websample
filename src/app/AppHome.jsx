import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, MapPin, Search, Users, Truck, Sparkles, Wrench, Armchair, PaintRoller, Laptop, Dog, Package } from 'lucide-react'
import { CropArt, useShuffle } from '../components/BosniaArt'
import { useAuth } from '../context/AuthContext'
import { useMode } from './mode'
import { serviceCategories } from '../data/categories'
import { useMyBids, useMyListings } from '../hooks/queries'
import { useJobFeed } from '../hooks/useFeed'
import { useSimpleMode } from '../hooks/useSimpleMode'
import '../components/SimpleOfferSheet.css'
import { LocationNudge } from '../components/RequiredPermissions'
import { formatBosnianDate } from '../utils/dateFormat'
import { haptic } from '../utils/native'
import { dropBootScreen } from '../utils/boot'
import { prefetchRoute } from '../utils/prefetch'
import PushPrompt from '../components/PushPrompt'
import NotifBellLink from '../components/NotifBellLink'
import './app.css'
import { SkeletonApJob } from '../components/Skeleton'
import { gsap, onView, reducedMotion, revealWords, useGSAP } from '../lib/motion'

// the hero builds itself the first time Home opens in a session; tab switches after that stay instant
let heroPlayed = false
function useHeroMotion(scope) {
  useGSAP(() => {
    if (heroPlayed || reducedMotion()) return
    heroPlayed = true
    gsap.set('.ap-hero-chips > *', { transition: 'none' }) // their CSS press transition would fight the tween
    revealWords(scope.current.querySelector('.ap-hero h1'), { scroll: false, stagger: 0.08 })
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.ap-hero-greet', { opacity: 0, y: -8, duration: 0.4 })
      .from('.ap-hero-form, .ap-hero-btn', { opacity: 0, y: 14, duration: 0.5 }, 0.2)
      .from('.ap-hero-chips > *', { opacity: 0, x: 28, duration: 0.45, stagger: 0.04, clearProps: 'transform,transition' }, 0.3)
  }, { scope })
}

/** Category tiles pop in, one after another, the first time they scroll into view. */
function useTilesMotion(scope, ready) {
  useGSAP(() => {
    if (!ready || reducedMotion() || !scope.current?.querySelector('.ap-tiles')) return
    gsap.set('.ap-tile', { transition: 'none' })
    gsap.from('.ap-tile', { opacity: 0, scale: 0.85, y: 12, duration: 0.4, ease: 'back.out(1.8)', stagger: 0.04, clearProps: 'transform,transition', scrollTrigger: onView('.ap-tiles', 'top 95%') })
  }, { scope, dependencies: [ready] })
}

const QUICK_IDEAS = [
  ['Pomozi mi sa selidbom', Truck], ['Generalno čišćenje stana', Sparkles], ['Popravi slavinu', Wrench], ['Sastavi namještaj', Armchair],
  ['Okreči sobu', PaintRoller], ['Pomoć oko računara', Laptop], ['Prošetaj psa', Dog], ['Dostavi paket', Package],
]
const TRENDING = ['gardening', 'painting', 'cleaning', 'moving-transport', 'handyman', 'furniture', 'it-support', 'delivery']
const BID_STATUS = { pending: ['Čeka odgovor', 'open'], accepted: ['Prihvaćena', 'done'], rejected: ['Odbijena', 'off'], withdrawn: ['Povučena', 'off'] }
const money = (value) => (value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('hr-HR')} KM`)

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 10) return 'Dobro jutro'
  if (hour < 18) return 'Dobar dan'
  return 'Dobro veče'
}

/** Signed-in phone home. Poster face: "Objavi posao. Riješeno." Tasker face: jobs to take. */
// the little Bosnian characters in the header and the promo card; a random other one every few seconds
const HEADER_ART = ['diver', 'dzezva', 'navijac', 'majstor', 'somun']
const PROMO_ART = ['most', 'sebilj', 'somun']

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
              <div className="mt-card-head"><strong>{job.title}</strong><em>{job.price == null ? 'Po dogovoru' : `${Number(job.price).toLocaleString('hr-HR')} KM`}</em></div>
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
  const artIndex = useShuffle(HEADER_ART.length, 8000)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  // the poster's own jobs go right under the hero: until we know whether there are any, nothing sits there to be pushed down
  const ownJobs = useMyListings(user.id)
  const ownJobsKnown = !ownJobs.isPending || ownJobs.fetchStatus === 'paused'
  const homeRef = useRef(null)
  useHeroMotion(homeRef)
  useTilesMotion(homeRef, ownJobsKnown)

  const start = (text) => {
    haptic('light')
    const draft = { form: { title: (text || '').slice(0, 70), timing: '', date: '', mode: '', location: '', description: '', category: '', price: '' }, step: 0 }
    try { localStorage.setItem('zadatak-post-draft', JSON.stringify(draft)) } catch { /* ignore */ }
    navigate('/objavi')
  }

  return (
    <div className="ap ap-home" ref={homeRef}>
      <section className="ap-hero">
        {HEADER_ART.map((crop, i) => <CropArt key={crop} crop={crop} className={`ap-hero-art bz-turn ${i === artIndex ? 'is-on' : ''}`} />)}
        <div className="ap-hero-top"><span className="ap-hero-greet">{greeting()}{firstName ? `, ${firstName}` : ''}</span><NotifBellLink className="ap-hero-bell" /></div>
        <h1>Objavi posao. <em>Riješeno.</em></h1>
        <form className="ap-hero-form" onSubmit={(event) => { event.preventDefault(); start(title) }}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} placeholder="U par riječi, šta ti treba?" aria-label="Šta ti treba?" enterKeyHint="go" onFocus={() => prefetchRoute('/objavi')} />
          <button type="submit"><span>Dobij ponude</span><ArrowRight size={18} /></button>
        </form>
        <div className="ap-hero-chips">
          {QUICK_IDEAS.map(([idea, Icon]) => <button key={idea} type="button" onClick={() => start(idea)}><Icon size={18} /> {idea}</button>)}
        </div>
      </section>

      <div className="ap-home-body">
        <PushPrompt compact />
        <MyOpenJobs userId={user.id} />
        {ownJobsKnown && (
          <>
            <Link to="/account/profil" className="ap-promo" onClick={() => haptic('light')}>
              <div>
                <span className="ap-promo-eyebrow">Zadatak za izvođače</span>
                <strong>Zaradi uz poslove u svom gradu</strong>
                <p>Pošalji ponudu za minutu — klijent plaća unaprijed, tebi zarada sjeda na balans.</p>
                <em>Postani izvođač →</em>
              </div>
              <CropArt crop={PROMO_ART[artIndex % PROMO_ART.length]} className="ap-promo-art" />
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
          </>
        )}
      </div>
    </div>
  )
}

function TaskerHome({ user, firstName }) {
  const artIndex = useShuffle(HEADER_ART.length, 8000)
  const navigate = useNavigate()
  const { feed, loading, personalised } = useJobFeed({ userId: user.id, limit: 8 })
  const bidsQuery = useMyBids(user.id, 3)
  // jednostavan način: svaka kartica posla dobija veliko dugme "Želim ovaj posao" (2 dodira do poslane prijave)
  const simple = useSimpleMode(user.id)
  const bids = bidsQuery.isPending ? null : (bidsQuery.data || [])
  // what sits below the job list comes in after it, so the list filling in can't push it down or out of sight
  const ready = !loading && bids !== null
  const homeRef = useRef(null)
  useHeroMotion(homeRef)

  return (
    <div className="ap ap-home" ref={homeRef}>
      <section className="ap-hero ap-hero-tasker">
        {HEADER_ART.map((crop, i) => <CropArt key={crop} crop={crop} className={`ap-hero-art bz-turn ${i === artIndex ? 'is-on' : ''}`} />)}
        <div className="ap-hero-top"><span className="ap-hero-greet">{greeting()}{firstName ? `, ${firstName}` : ''}</span><NotifBellLink className="ap-hero-bell" /></div>
        <h1>Pronađi posao. <em>Zaradi.</em></h1>
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
        <LocationNudge auto={false} />
        <PushPrompt compact reason="Javit ćemo ti čim se pojavi posao za tebe." />
        <section className="ap-section">
          <h2 className="ap-h2">{personalised ? 'Poslovi za tebe' : 'Novi poslovi'}</h2>
          <p className="ap-p">{personalised ? 'Prema tvojim vještinama, gradu i onome što pregledaš' : 'Svježe i s malo ponuda na vrhu'}</p>
          {loading && feed.length === 0 && <div className="ap-list">{[1, 2, 3].map((i) => <SkeletonApJob key={i} />)}</div>}
          {!loading && feed.length === 0 && <div className="ap-empty"><strong>Trenutno nema otvorenih poslova</strong><span>Uključi obavijesti — javit ćemo ti čim se pojavi novi.</span></div>}
          <div className="ap-list">
            {feed.map((job) => {
              const card = (
                <Link key={job.id} to={`/listings/${job.id}`} className={`ap-job ${simple.enabled ? 'ap-job-simple' : ''}`} onPointerDown={() => prefetchRoute('/listings')}>
                  <div className="ap-job-main">
                    <strong>{job.title}</strong>
                    <span><MapPin size={simple.enabled ? 18 : 13} /> {job.location || 'Bez lokacije'}</span>
                    <span className="ap-job-state">Otvoren{job.bid_count > 0 ? ` · ${job.bid_count} ponuda` : ''}{job.reasons?.[0] ? ` · ${job.reasons[0]}` : ''}</span>
                  </div>
                  <em className="ap-price">{typeof job.price === 'string' ? job.price : money(job.price)}</em>
                </Link>
              )
              if (!simple.enabled) return card
              return (
                <div key={job.id} className="ap-job-simple-wrap">
                  {card}
                  <Link to={`/listings/${job.id}?prijava=1`} className="simple-apply-btn" data-testid="simple-apply" onClick={() => haptic('light')}>Želim ovaj posao</Link>
                </div>
              )
            })}
          </div>
          {ready && <Link to="/search" className="ap-more">Svi poslovi <ChevronRight size={16} /></Link>}
        </section>

        {ready && (
          <section className="ap-section">
            <h2 className="ap-h2">Moje ponude</h2>
            {bids.length === 0 && <div className="ap-empty"><strong>Još nisi poslao/la ponudu</strong><span>Otvori posao i klikni „Pošalji ponudu“.</span></div>}
            {bids.length > 0 && (
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
        )}
      </div>
    </div>
  )
}

export default AppHome
