import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Eye, MapPin, Pencil, Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listingService } from '../services/listingService'
import { formatBosnianDate } from '../utils/dateFormat'
import CountUp from '../components/CountUp'
import PushPrompt from '../components/PushPrompt'
import { useQueryClient } from '@tanstack/react-query'
import { keys, useMyBids, useMyListings, useRecommendedListings } from '../hooks/queries'
import { useAccount } from './account/AccountLayout'
import { confirmDialog } from '../utils/dialog'
import ProviderDashboard from '../components/ProviderDashboard'
import { useQuery } from '@tanstack/react-query'
import { providerBoardService } from '../services/providerBoardService'
import { clientStep } from '../utils/jobStep'

const money = (value) => (value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} KM`)

const STATUS_LABELS = {
  published: 'Objavljen',
  assigned: 'Izvođač odabran · plaćeno',
  completed: 'Završen',
  cancelled: 'Otkazan',
  draft: 'Nacrt',
  paused: 'Pauziran',
  closed: 'Zatvoren',
  archived: 'Uklonjen',
}

function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  // the dashboard has two faces: what I posted (client) and what I offered on (provider); "both" sees both
  const { profile, isProvider } = useAccount()
  const isClient = !isProvider || profile?.account_type === 'both'
  // all three reads are cached: the dashboard paints from cache and refreshes behind the scenes
  const listingsQuery = useMyListings(user.id)
  const bidsQuery = useMyBids(user.id, 20)
  const recommendedQuery = useRecommendedListings(user.id, 6)
  const listings = listingsQuery.data || []
  const loading = listingsQuery.isPending
  const bids = isProvider ? (bidsQuery.data ?? null) : null
  const recommended = recommendedQuery.data || []
  const paymentsQuery = useQuery({ queryKey: keys.clientPayments(user.id), queryFn: () => providerBoardService.clientPayments(user.id), enabled: isClient, meta: { persist: false } })
  const paymentByJob = new Map((paymentsQuery.data || []).map((row) => [row.listing_id, row]))
  const recommendedLoading = recommendedQuery.isPending
  const loadError = listingsQuery.error && !listingsQuery.data ? listingsQuery.error.message : ''

  const deleteListing = async (listing) => {
    if (!(await confirmDialog({ title: 'Obrisati oglas?', text: `„${listing.title}“ nestaje sa Zadatka zajedno sa ponudama.`, confirmLabel: 'Obriši', danger: true }))) return
    setDeletingId(listing.id)
    setError('')
    try {
      await listingService.deleteListing(listing.id)
      setMessage('Oglas je obrisan.')
      queryClient.setQueryData(keys.myListings(user.id), (current) => (current || []).filter((item) => item.id !== listing.id))
      queryClient.invalidateQueries({ queryKey: ['search'] })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="dashboard-main account-home">
        <div className="dashboard-topline">
          <div>
            <span className="eyebrow small-eyebrow">Nadzorna ploča</span>
            <h1>Dobrodošao/la, {(user?.user_metadata?.full_name || user?.email || '').split(/[\s@]/)[0]}</h1>
          </div>
          <button type="button" className="primary-button" onClick={() => navigate('/objavi')}>
            <Plus size={18} /> Objavi posao
          </button>
        </div>

        {isProvider ? (
          <div className="dashboard-grid">
            <div className="stat-card"><strong><CountUp value={(bids || []).filter((item) => item.status === 'pending').length} /></strong><span>Ponude koje čekaju</span></div>
            <div className="stat-card"><strong><CountUp value={(bids || []).filter((item) => item.status === 'accepted').length} /></strong><span>Dodijeljeni poslovi</span></div>
            <div className="stat-card"><strong>{money(profile?.balance ?? 0)}</strong><span>Balans</span></div>
          </div>
        ) : (
          <div className="dashboard-grid">
            <div className="stat-card"><strong><CountUp value={listings.length} /></strong><span>Objavljeni poslovi</span></div>
            <div className="stat-card"><strong><CountUp value={listings.reduce((sum, item) => sum + (item.bids?.[0]?.count || 0), 0)} /></strong><span>Primljene ponude</span></div>
            <div className="stat-card"><strong><CountUp value={listings.filter((item) => item.status === 'published').length} /></strong><span>Aktivni oglasi</span></div>
          </div>
        )}

        <PushPrompt />

        {message && <div className="form-success">{message}</div>}
        {(error || loadError) && <div className="form-error">{error || loadError}</div>}

        {isProvider && (
          <section className="dashboard-section">
            <div className="rec-heading">
              <h2>Ploča izvođača</h2>
              <p>Sve tvoje ponude i poslovi na jednom mjestu: šta čeka klijenta, šta je u toku i šta si zaradio/la.</p>
            </div>
            <ProviderDashboard userId={user.id} />
          </section>
        )}

        {isProvider && !recommendedLoading && recommended.length > 0 && (
          <section className="dashboard-section">
            <div className="rec-heading">
              <h2>Preporučeno za tebe</h2>
              <p>Poslovi odabrani prema tvom gradu, iskustvu i konkurenciji.</p>
            </div>
            <div className="rec-grid">
              {recommended.map((item) => (
                <Link className="rec-card" key={item.id} to={`/listings/${item.id}`}>
                  <div className="rec-card-top">
                    <span className="tag">{item.category}</span>
                    <span className="rec-score" title="Koliko posao odgovara tebi">
                      <Sparkles size={13} /> {Math.round(item.match_score)}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <div className="rec-card-meta">
                    <span><MapPin size={14} /> {item.location || 'Bez lokacije'}</span>
                    <strong>{item.price == null ? 'Po dogovoru' : `${Number(item.price).toLocaleString('bs-BA')} KM`}</strong>
                  </div>
                  {item.reasons?.length > 0 && (
                    <ul className="rec-reasons">
                      {item.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {isClient && (
        <section className="dashboard-section">
          <h2>Moji oglasi</h2>
          {loading && <div className="skeleton-list">{[1, 2].map((item) => <div className="skeleton-card" key={item} />)}</div>}

          {!loading && listings.length === 0 && (
            <div className="empty-state dashboard-empty">
              <Plus size={38} />
              <h3>Još nemate objavljenih poslova</h3>
              <p>Objavite prvi posao i za par minuta počnite primati ponude od izvođača.</p>
              <button type="button" className="primary-button" onClick={() => navigate('/objavi')}>Objavi prvi posao</button>
            </div>
          )}

          {!loading && listings.map((listing) => {
            const payment = paymentByJob.get(listing.id) || null
            const offers = listing.bids?.[0]?.count || 0
            const next = clientStep({ listing, payment, pending: listing.status === 'published' ? offers : 0, expired: listing.status === 'expired', reviewed: true })
            // dodijeljen, plaćen ili završen posao se ne uređuje; dok je novac na Zadatku ne briše se ni on
            const editable = ['published', 'expired', 'draft', 'paused'].includes(listing.status) && !payment
            const deletable = listing.status !== 'assigned' && !['funded', 'requested', 'disputed'].includes(payment?.status)
            return (
            <article data-testid="dashboard-listing" className="dashboard-listing" key={listing.id}>
              <div className="dashboard-listing-main">
                <span className={`status-pill status-${listing.status}`}>{STATUS_LABELS[listing.status] || listing.status}</span>
                <h3><Link to={`/listings/${listing.id}`}>{listing.title}</Link></h3>
                <div className="dashboard-listing-meta">
                  <span><MapPin size={14} /> {listing.location || 'Bez lokacije'}</span>
                  <span><Users size={14} /> {offers} {[2, 3, 4].includes(offers) ? 'ponude' : 'ponuda'}</span>
                  <span>{formatBosnianDate(listing.created_at)}</span>
                </div>
                {next.tone === 'act' && <Link to={`/listings/${listing.id}`} className="dashboard-next" data-testid="dashboard-next">{next.short} <ChevronRight size={15} /></Link>}
              </div>
              <div className="dashboard-listing-actions">
                <strong>{money(payment ? payment.amount : listing.price)}</strong>
                <div className="dashboard-listing-buttons">
                  <Link className="ghost-button" to={`/listings/${listing.id}`}><Eye size={15} /> Pogledaj</Link>
                  {editable && <Link className="ghost-button" to={`/objavi?edit=${listing.id}`}><Pencil size={15} /> Uredi</Link>}
                  {deletable && (
                    <button type="button" className="danger-button" disabled={deletingId === listing.id} onClick={() => deleteListing(listing)}>
                      <Trash2 size={15} /> {deletingId === listing.id ? 'Brišem...' : 'Obriši'}
                    </button>
                  )}
                </div>
              </div>
            </article>
            )
          })}
        </section>
        )}
    </div>
  )
}

export default DashboardPage
