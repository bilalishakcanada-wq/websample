import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '../components/Toaster'
import SuccessSplash from '../components/SuccessSplash'
import { useBackToClose } from '../hooks/useBackToClose'
import { useCategoryPrice } from '../hooks/useCategoryPrice'
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Flag, Images, Lock, MapPin, MessageCircle, Pencil, ShieldCheck, Send, Share2, Sparkles, Star, Tag, UserRound, Users, Wallet, X, XCircle } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ListingCard from '../components/ListingCard'
import { bidService } from '../services/bidService'
import { listingService } from '../services/listingService'
import { reportService } from '../services/reportService'
import { profileService } from '../services/profileService'
import { reviewService } from '../services/reviewService'
import { matchService } from '../services/matchService'
import { useAuth } from '../context/AuthContext'
import { formatBosnianDate } from '../utils/dateFormat'
import { contactInfoMessage, findProhibitedTerm, scanContactInfo } from '../utils/moderation'
import RuleOneNotice from '../components/RuleOneNotice'
import { AcceptOfferSheet, HowPaymentWorks, JobPaymentCard } from '../components/JobPayment'
import WorkFlow from '../components/WorkFlow'
import { paymentService } from '../services/paymentService'
import { setPageTitle } from '../utils/pageTitle'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { keys } from '../hooks/queries'
import { questionService } from '../services/questionService'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { shareLink } from '../utils/native'
import { useFullscreen } from '../app/useFullscreen'
import JobDetail from '../app/JobDetail'
import { confirmDialog, promptDialog } from '../utils/dialog'
import { SkeletonJobPhone } from '../components/Skeleton'
import { recordInterest } from '../utils/interests'

const formatDate = formatBosnianDate
const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

/** Cover photo + thumbnail strip; a soft category placeholder when the job has no photos. */
function Gallery({ images, title, category, onOpen }) {
  const [active, setActive] = useState(0)
  if (images.length === 0) {
    return (
      <div className="job-gallery job-gallery-empty">
        <Images size={30} />
        <span>{category || 'Oglas'}</span>
        <small>Vlasnik nije dodao slike</small>
      </div>
    )
  }
  const current = images[Math.min(active, images.length - 1)]
  return (
    <div className="job-gallery">
      <button type="button" className="job-gallery-main" onClick={() => onOpen(active)} aria-label="Uvećaj sliku">
        <img src={current.url} alt={title} />
        <span className="job-gallery-count"><Images size={13} /> {active + 1}/{images.length}</span>
      </button>
      {images.length > 1 && (
        <div className="job-gallery-thumbs">
          {images.map((image, index) => (
            <button key={image.id || image.url} type="button" className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Slika ${index + 1}`}>
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const BID_STATUS_LABEL = {
  pending: 'Na čekanju',
  accepted: 'Prihvaćena',
  rejected: 'Odbijena',
  withdrawn: 'Povučena',
}

function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const justPublished = searchParams.get('published') === '1'
  const closeSplash = useCallback(() => setSearchParams((params) => { params.delete('published'); return params }, { replace: true }), [setSearchParams])
  const { user } = useAuth()
  const [listing, setListing] = useState(null)
  const [related, setRelated] = useState([])
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [bidForm, setBidForm] = useState({ amount: '', message: '' })
  const [sending, setSending] = useState(false)
  const [bidError, setBidError] = useState('')
  const [message, setMessage] = useState('')
  const [poster, setPoster] = useState(null)
  const [suggested, setSuggested] = useState([])
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [payment, setPayment] = useState(null)
  const [acceptBid, setAcceptBid] = useState(null)
  const [questions, setQuestions] = useState([])
  const [feePercent, setFeePercent] = useState(null)
  useEffect(() => {
    if (!sheetOpen || !user || feePercent != null) return undefined
    let alive = true
    paymentService.feePercentFor(user.id).then((value) => alive && setFeePercent(value)).catch(() => {})
    return () => { alive = false }
  }, [sheetOpen, user, feePercent])
  const [metrics, setMetrics] = useState({})
  const isPhone = useMediaQuery('(max-width: 768px)')
  const queryClient = useQueryClient()
  // the phone job screen draws its own top bar; the not-found state keeps the tab bar so people can leave
  useFullscreen(isPhone && (loading || Boolean(listing)))
  const tab = searchParams.get('tab') === 'pitanja' ? 'pitanja' : 'ponude'
  const setTab = (value) => setSearchParams((params) => { if (value === 'pitanja') params.set('tab', 'pitanja'); else params.delete('tab'); return params }, { replace: true })
  const images = useMemo(() => [...(listing?.listing_images || [])].sort((a, b) => a.position - b.position), [listing])

  const priceStats = useCategoryPrice(listing?.category)

  // phone back button closes overlays instead of leaving the job
  useBackToClose(sheetOpen, () => setSheetOpen(false))
  useBackToClose(Boolean(acceptBid), () => setAcceptBid(null))
  useBackToClose(lightbox !== null, () => setLightbox(null))

  const share = async () => {
    const url = window.location.href
    try {
      const shared = await shareLink({ title: listing?.title, text: `${listing?.title} — Poso.ba`, url })
      if (!shared) { await navigator.clipboard.writeText(url); setMessage('Link je kopiran.'); toast('Link kopiran.') }
    } catch { /* user cancelled */ }
  }

  // the job + its offers come from the query cache (a job opened from the list paints at once);
  // the rest (payment, questions, metrics, related, poster) loads behind it
  const core = useQuery({
    queryKey: keys.listing(id),
    queryFn: async () => { const [listing, bids] = await Promise.all([listingService.getById(id), bidService.listForListing(id)]); return { listing, bids } },
    // paint from cache at once, but a job page always re-checks the server (offers move fast)
    staleTime: 0,
    refetchOnMount: 'always',
  })
  useEffect(() => {
    if (!core.data) return undefined
    let active = true
    const result = core.data.listing
    setListing(result)
    setBids(core.data.bids)
    setLoading(false)
    if (result?.title) setPageTitle(result.title)
    if (result) {
      paymentService.forListing(id).then((row) => active && setPayment(row)).catch(() => {})
      questionService.list(id).then((rows) => active && setQuestions(rows)).catch(() => {})
      bidService.bidderMetrics(id).then((rows) => active && setMetrics(rows)).catch(() => {})
      listingService.listRelated({ id, category: result.category, location: result.location }).then((rows) => active && setRelated(rows)).catch(() => {})
      profileService.getPublicProfile(result.user_id).then((profile) => active && setPoster(profile)).catch(() => {})
    }
    return () => { active = false }
  }, [core.data, id])
  useEffect(() => { if (core.error) { setError(core.error.message); setLoading(false) } }, [core.error])

  const isOwner = Boolean(user && listing && user.id === listing.user_id)
  // opening someone else's job teaches the feed what this person is into (kept on this device)
  useEffect(() => {
    if (listing?.id && !isOwner) recordInterest('view', { category: listing.category, listingId: listing.id })
  }, [listing?.id, isOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  // the other side moves the job forward -> refresh payment + bids + listing status
  const refreshJob = async () => {
    const [row, fresh, listingBids] = await Promise.all([paymentService.forListing(id), listingService.getById(id), bidService.listForListing(id)])
    setPayment(row)
    if (fresh) setListing(fresh)
    setBids(listingBids)
    queryClient.setQueryData(keys.listing(id), (current) => ({ listing: fresh || current?.listing, bids: listingBids }))
    queryClient.invalidateQueries({ queryKey: ['search'] })
    queryClient.invalidateQueries({ queryKey: ['me'] })
  }
  useEffect(() => {
    if (!user || !id) return undefined
    return paymentService.subscribe(id, () => { refreshJob().catch(() => {}) })
  }, [user, id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOwner || !id) return undefined
    let active = true
    matchService.providersForListing(id, 4).then((rows) => active && setSuggested(rows))
    return () => { active = false }
  }, [isOwner, id])
  const myBid = useMemo(() => bids.find((bid) => bid.bidder_id === user?.id && bid.status !== 'withdrawn'), [bids, user])
  const acceptedBid = useMemo(() => bids.find((bid) => bid.status === 'accepted'), [bids])
  const tags = useMemo(() => (listing?.listing_tags || []).map((item) => item.tags?.name).filter(Boolean), [listing])

  const openBidSheet = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/listings/${id}` } } })
      return
    }
    setBidError('')
    setSheetOpen(true)
  }

  const submitBid = async (event) => {
    event.preventDefault()
    setBidError('')
    if (findProhibitedTerm(bidForm.message)) {
      setBidError('Poruka sadrži sadržaj koji krši Pravila korištenja.')
      return
    }
    const contactScan = scanContactInfo(bidForm.message)
    if (!contactScan.clean) {
      setBidError(contactInfoMessage(contactScan, 'ponuda'))
      return
    }
    setSending(true)
    try {
      const created = await bidService.createBid({ listingId: id, bidderId: user.id, amount: bidForm.amount, message: bidForm.message })
      setBids((current) => [{ ...created, bidder: null }, ...current])
      recordInterest('bid', { category: listing?.category })
      bidService.listForListing(id).then((rows) => { setBids(rows); queryClient.setQueryData(keys.listing(id), (cur) => ({ listing: cur?.listing || listing, bids: rows })) }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setBidForm({ amount: '', message: '' })
      setSheetOpen(false)
      setMessage('Ponuda je uspješno poslana.'); toast('Ponuda poslana. Javit ćemo ti kad klijent odgovori.', { kind: 'success' })
    } catch (requestError) {
      setBidError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  const [qaDraft, setQaDraft] = useState('')
  const [qaError, setQaError] = useState('')
  const [asking, setAsking] = useState(false)
  const askQuestion = async (body) => {
    if (!user) { navigate(`/login?next=${encodeURIComponent(`/listings/${id}?tab=pitanja`)}`); return }
    if (findProhibitedTerm(body)) throw new Error('Pitanje sadrži sadržaj koji krši Pravila korištenja.')
    const scan = scanContactInfo(body)
    if (!scan.clean) throw new Error(contactInfoMessage(scan, 'pitanje'))
    const created = await questionService.ask({ listingId: id, userId: user.id, body })
    const parts = String(user.user_metadata?.full_name || '').trim().split(/\s+/)
    const shortName = parts[0] ? `${parts[0]}${parts[1] ? ` ${parts[1].charAt(0).toUpperCase()}.` : ''}` : 'Ti'
    setQuestions((current) => [...current, { ...created, author: { display_name: shortName, avatar_url: user.user_metadata?.avatar_url || null } }])
    toast(isOwner ? 'Odgovor je objavljen.' : 'Pitanje je poslano vlasniku.', { kind: 'success' })
  }

  const reportListing = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/listings/${id}` } } })
      return
    }
    const reason = await promptDialog({ title: 'Prijavi oglas', text: 'Zašto prijavljuješ ovaj oglas? (npr. zabranjen sadržaj, prevara)', placeholder: 'Opiši ukratko…', confirmLabel: 'Prijavi' })
    if (!reason) return
    try {
      await reportService.createReport({ reporterId: user.id, targetType: 'listing', targetId: id, reason })
      setMessage('Hvala, prijava je poslana našem timu.')
    } catch (requestError) {
      setMessage(requestError.message)
    }
  }

  // already reviewed this job → the form gives way to a thank-you line
  const [myReview, setMyReview] = useState(null)
  useEffect(() => {
    if (!user || listing?.status !== 'completed') return undefined
    let alive = true
    reviewService.mineForListing(id, user.id).then((row) => alive && setMyReview(row)).catch(() => {})
    return () => { alive = false }
  }, [id, user, listing?.status])

  const submitReview = async (event) => {
    event.preventDefault()
    const contactScan = scanContactInfo(reviewForm.comment)
    if (!contactScan.clean) {
      setMessage(contactInfoMessage(contactScan, 'recenzija'))
      return
    }
    setSubmittingReview(true)
    setMessage('')
    try {
      const created = await reviewService.createReview({ reviewerId: user.id, revieweeId: isOwner ? acceptedBid.bidder_id : listing.user_id, listingId: id, rating: reviewForm.rating, comment: reviewForm.comment })
      setMyReview(created)
      setReviewForm({ rating: 5, comment: '' })
      setMessage('Hvala na recenziji!'); toast('Hvala na recenziji!', { kind: 'success' })
    } catch (requestError) {
      setMessage(requestError.message)
    } finally {
      setSubmittingReview(false)
    }
  }

  const [outcomeBusy, setOutcomeBusy] = useState(false)
  const setOutcome = async (status) => {
    let reason = null
    if (status === 'cancelled') {
      reason = await promptDialog({
        title: 'Zašto se posao otkazuje?',
        options: [
          { value: 'provider', label: 'Izvođač nije došao / odustao', hint: 'Računa se u njegovu uspješnost' },
          { value: 'client', label: 'Ja sam odustao/la' },
          { value: 'other', label: 'Nešto drugo' },
        ],
      })
      if (reason == null) return
    } else if (!(await confirmDialog({ title: 'Posao je završen?', text: 'Nakon potvrde možeš ostaviti recenziju izvođaču.', confirmLabel: 'Da, završen je' }))) {
      return
    }
    setOutcomeBusy(true)
    try {
      const updated = await listingService.setOutcome(id, status, reason)
      setListing((current) => ({ ...current, ...updated }))
      queryClient.invalidateQueries({ queryKey: keys.listing(id) })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setMessage(status === 'completed' ? 'Posao je označen kao završen. Hvala — ovo se računa u uspješnost izvođača.' : 'Posao je otkazan.')
    } catch (requestError) {
      setMessage(requestError.message)
    } finally {
      setOutcomeBusy(false)
    }
  }

  const withdrawBid = async () => {
    if (!myBid || myBid.status !== 'pending') return
    if (!(await confirmDialog({ title: 'Povući ponudu?', text: 'Klijent je više neće vidjeti. Možeš poslati novu.', confirmLabel: 'Povuci', danger: true }))) return
    try {
      const updated = await bidService.setStatus(myBid.id, 'withdrawn')
      setBids((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
      queryClient.invalidateQueries({ queryKey: keys.listing(id) })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast('Ponuda je povučena.', { kind: 'info' })
    } catch (requestError) {
      setMessage(requestError.message)
    }
  }

  const setBidStatus = async (bidId, status) => {
    if (status === 'accepted') {
      const bid = bids.find((item) => item.id === bidId)
      if (bid) setAcceptBid(bid)
      return
    }
    try {
      const updated = await bidService.setStatus(bidId, status)
      setBids((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
      queryClient.invalidateQueries({ queryKey: keys.listing(id) })
      setMessage(status === 'accepted' ? 'Ponuda je prihvaćena. Sada možete razmjenjivati poruke i kontakt.' : 'Ponuda je odbijena.')
    } catch (requestError) {
      setMessage(requestError.message)
    }
  }

  if (loading) return isPhone ? <SkeletonJobPhone /> : <div className="app-shell page-with-mobile-nav"><main className="content-container"><div className="detail-skeleton" /><div className="skeleton-card" /><div className="skeleton-card" /></main></div>
  // a failed request is not a missing job: on a weak mobile connection people need a retry, not a dead end
  if (error) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    const retry = () => { setError(''); setLoading(true); core.refetch() }
    return <div className="app-shell page-with-mobile-nav"><main className="content-container empty-state"><h1>Posao se nije učitao</h1><p>{offline ? 'Nema internet veze. Provjeri vezu i pokušaj ponovo.' : 'Veza sa serverom je prekinuta. Pokušaj ponovo.'}</p><button type="button" className="primary-button" onClick={retry}>Pokušaj ponovo</button><Link to="/search" className="secondary-button">Nazad na pretragu</Link></main></div>
  }
  if (!listing) return <div className="app-shell page-with-mobile-nav"><main className="content-container empty-state"><h1>Oglas nije pronađen</h1><p>Oglas više nije dostupan ili je privatan.</p><Link to="/search" className="primary-button">Nazad na pretragu</Link></main></div>

  const [descriptionBody, whenLine] = (listing.description || '').split('\n\nKada:')
  const when = (whenLine || '').trim() || 'Fleksibilan termin'
  const isRemote = /online/i.test(listing.location || '')

  const overlays = (
    <>
      {acceptBid && (
        <AcceptOfferSheet bid={acceptBid} providerName={acceptBid.bidder?.display_name} onClose={() => setAcceptBid(null)} onDone={async () => { await refreshJob(); setMessage('Ponuda je prihvaćena i uplata je osigurana. Izvođač je obaviješten.') }} />
      )}
      {lightbox != null && images[lightbox] && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button type="button" className="lightbox-close" aria-label="Zatvori"><X size={22} /></button>
          {images.length > 1 && <button type="button" className="lightbox-nav prev" aria-label="Prethodna" onClick={(event) => { event.stopPropagation(); setLightbox((lightbox + images.length - 1) % images.length) }}><ChevronLeft size={26} /></button>}
          <img src={images[lightbox].url} alt={listing.title} onClick={(event) => event.stopPropagation()} />
          {images.length > 1 && <button type="button" className="lightbox-nav next" aria-label="Sljedeća" onClick={(event) => { event.stopPropagation(); setLightbox((lightbox + 1) % images.length) }}><ChevronRight size={26} /></button>}
          <span className="lightbox-count">{lightbox + 1} / {images.length}</span>
        </div>
      )}
      {sheetOpen && (
        <div className="sheet-backdrop" role="presentation" onClick={() => setSheetOpen(false)}>
          <section className="offer-sheet" role="dialog" aria-modal="true" aria-labelledby="offer-title" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 id="offer-title">Pošalji ponudu</h2>
            <p className="muted-text">{listing.price != null ? <>Klijent je naveo okvirni budžet od <strong>{formatPrice(listing.price, listing.currency)}</strong>. Možeš ponuditi manje ili više uz obrazloženje.</> : 'Klijent nije naveo budžet — predloži cijenu i objasni šta je uključeno.'}</p>
            <form className="auth-form" onSubmit={submitBid}>
              <label>Tvoja ponuda (KM)<input type="number" min="0" step="0.01" inputMode="decimal" value={bidForm.amount} onChange={(event) => setBidForm({ ...bidForm, amount: event.target.value })} required /></label>
              {Number(bidForm.amount) > 0 && feePercent != null && (
                <p className="offer-net">Tebi sjeda <strong>{formatPrice(Math.round(Number(bidForm.amount) * (1 - feePercent / 100) * 100) / 100)}</strong> <span>(naknada {feePercent}%)</span></p>
              )}
              {priceStats && (
                <div className="price-hint">
                  <span>Tipično za „{listing.category}“: <strong>{priceStats.median.toLocaleString('bs-BA')} KM</strong> (raspon {priceStats.min.toLocaleString('bs-BA')}–{priceStats.max.toLocaleString('bs-BA')} KM, {priceStats.count} poslova)</span>
                  <div className="price-hint-chips">
                    {[Math.round(priceStats.median * 0.85), Math.round(priceStats.median), Math.round(priceStats.median * 1.2)].map((value) => (
                      <button key={value} type="button" className={Number(bidForm.amount) === value ? 'active' : ''} onClick={() => setBidForm({ ...bidForm, amount: String(value) })}>{value} KM</button>
                    ))}
                  </div>
                </div>
              )}
              <label>Obrazloženje<textarea minLength="3" maxLength="2000" value={bidForm.message} onChange={(event) => setBidForm({ ...bidForm, message: event.target.value })} placeholder="Napiši zašto si prava osoba za ovaj posao i šta je uključeno u cijenu." required /></label>
              <RuleOneNotice compact />
              {bidError && <div className="form-error">{bidError}</div>}
              <button type="submit" className="primary-button" disabled={sending}>{sending ? 'Šaljem...' : 'Pošalji ponudu'}</button>
              <button type="button" className="ghost-button" onClick={() => setSheetOpen(false)}>Odustani</button>
            </form>
          </section>
        </div>
      )}
    </>
  )

  if (isPhone) {
    return (
      <>
        {justPublished && (
          <SuccessSplash title="Posao je objavljen!" text="Izvođači u blizini dobijaju obavijest. Prve ponude obično stignu u roku sat vremena." onClose={closeSplash} onShare={share} />
        )}
        <JobDetail
          listing={listing} images={images} bids={bids} metrics={metrics} questions={questions} poster={poster} payment={payment} user={user}
          isOwner={isOwner} myBid={myBid} onWithdraw={withdrawBid} acceptedBid={acceptedBid} myReview={myReview} when={when} isRemote={isRemote} descriptionBody={descriptionBody}
          onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} onShare={share} onReport={reportListing} onOpenBid={openBidSheet}
          onAccept={(bidId) => setBidStatus(bidId, 'accepted')} onReject={async (bidId) => { if (await confirmDialog({ title: 'Odbiti ovu ponudu?', text: 'Izvođač dobija obavijest da ponuda nije prošla.', confirmLabel: 'Odbij', danger: true })) setBidStatus(bidId, 'rejected') }}
          onAsk={askQuestion} onOutcome={setOutcome} outcomeBusy={outcomeBusy} onOpenImage={(index) => setLightbox(index)} refreshJob={refreshJob}
          reviewForm={reviewForm} setReviewForm={setReviewForm} submitReview={submitReview} submittingReview={submittingReview} message={message}
          tab={tab} setTab={setTab}
        />
        {overlays}
      </>
    )
  }

  return (
    <div className="app-shell page-with-mobile-nav job-page">
      {justPublished && listing && (
        <SuccessSplash title="Posao je objavljen!" text="Izvođači u blizini dobijaju obavijest. Prve ponude obično stignu u roku sat vremena." onClose={closeSplash} onShare={share} />
      )}
      <main className="content-container">
        <div className="job-top">
          <button type="button" className="job-back" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Nazad</button>
          <div className="job-top-actions">
            <button type="button" className="job-icon" onClick={share} aria-label="Podijeli oglas" title="Podijeli"><Share2 size={16} /></button>
            {isOwner
              ? <Link to={`/objavi?edit=${id}`} className="job-icon job-icon-text"><Pencil size={15} /> Uredi</Link>
              : <button type="button" className="job-icon" onClick={reportListing} aria-label="Prijavi oglas" title="Prijavi oglas"><Flag size={16} /></button>}
          </div>
        </div>

        <div className="job-layout">
          <div className="job-main">
            <Gallery images={images} title={listing.title} category={listing.category} onOpen={(index) => setLightbox(index)} />

            <header className="job-head">
              <div className="job-chips">
                <span className="pill pill-soft">{listing.category || 'Ostalo'}</span>
                {listing.status === 'completed' && <span className="pill pill-ok"><CheckCircle2 size={12} /> Završen</span>}
                {listing.status === 'assigned' && <span className="pill pill-gold"><Lock size={12} /> Izvođač odabran · uplata osigurana</span>}
                {listing.status === 'cancelled' && <span className="pill pill-danger">Otkazan</span>}
                {listing.status === 'published' && acceptedBid && <span className="pill pill-gold">Izvođač odabran</span>}
                {listing.status === 'published' && !acceptedBid && <span className="pill pill-ok">Otvoren za ponude</span>}
              </div>
              <h1>{listing.title}</h1>
              <div className="job-meta">
                <span><MapPin size={15} /> {listing.location || 'Lokacija nije navedena'}</span>
                <span><CalendarDays size={15} /> {when}</span>
                <span><Users size={15} /> {bids.length} {bids.length === 1 ? 'ponuda' : 'ponuda'}</span>
                <span className="job-meta-date">Objavljeno {formatDate(listing.created_at)}</span>
              </div>
            </header>

            <section className="job-card">
              <h2>Opis</h2>
              <p className="job-description">{descriptionBody?.trim() || 'Vlasnik oglasa nije dodao detaljan opis.'}</p>
              {tags.length > 0 && <div className="tag-list job-tags">{tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
            </section>

            {payment && (isOwner || user?.id === payment.provider_id) && (
              <>
                <JobPaymentCard payment={payment} role={isOwner ? 'client' : 'provider'} />
                <WorkFlow payment={payment} role={isOwner ? 'client' : 'provider'} user={user} onChanged={refreshJob} />
              </>
            )}

            <section className="job-card">
              <h2>Detalji</h2>
              <div className="job-facts">
                <div><span className="job-fact-icon"><CalendarDays size={17} /></span><div><small>Kada</small><strong>{when}</strong></div></div>
                <div><span className="job-fact-icon"><MapPin size={17} /></span><div><small>Gdje</small><strong>{isRemote ? 'Online / na daljinu' : listing.location || '—'}</strong></div></div>
                <div><span className="job-fact-icon"><Tag size={17} /></span><div><small>Kategorija</small><strong>{listing.category || 'Ostalo'}</strong></div></div>
                <div><span className="job-fact-icon"><Wallet size={17} /></span><div><small>Budžet</small><strong>{formatPrice(listing.price, listing.currency)}</strong></div></div>
              </div>
            </section>

            <section className="job-card">
              <div className="section-heading"><h2>Ponude</h2><span className="muted-text">{bids.length}</span></div>
              {!isOwner && bids.length > 0 && (
                <p className="contact-protection-note"><ShieldCheck size={15} /> Kontakt podaci su zaštićeni dok vlasnik ne prihvati ponudu.</p>
              )}
              {bids.length === 0 ? <p className="muted-text">Još nema ponuda. Budi prvi koji će poslati ponudu.</p> : (
                <div className="offers-list">
                  {bids.map((bid) => (
                    <article className={`offer-row bid-row status-${bid.status}`} key={bid.id}>
                      {bid.bidder?.avatar_url
                        ? <img src={bid.bidder.avatar_url} alt="" className="poster-avatar poster-avatar-photo" />
                        : <div className="poster-avatar"><UserRound size={18} /></div>}
                      <div>
                        <strong>{bid.bidder?.display_name || 'Korisnik Poso.ba'}</strong>
                        <p>{bid.message}</p>
                        <span className={`bid-status-label status-${bid.status}`}>{BID_STATUS_LABEL[bid.status]}</span>
                      </div>
                      <div className="offer-actions">
                        <b>{formatPrice(bid.amount)}</b>
                        {isOwner && bid.status === 'pending' && (
                          <div className="bid-owner-actions">
                            <button type="button" className="primary-button small-button" onClick={() => setBidStatus(bid.id, 'accepted')} disabled={listing.status !== 'published'}><Lock size={15} /> Prihvati i plati</button>
                            <button type="button" className="ghost-button danger-button" onClick={async () => { if (await confirmDialog({ title: 'Odbiti ovu ponudu?', text: 'Izvođač dobija obavijest da ponuda nije prošla.', confirmLabel: 'Odbij', danger: true })) setBidStatus(bid.id, 'rejected') }}><XCircle size={16} /> Odbij</button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="job-card" id="pitanja">
              <div className="section-heading"><h2>Pitanja</h2><span className="muted-text">{questions.length}</span></div>
              {questions.length === 0 && <p className="muted-text">{isOwner ? 'Niko još nije postavio pitanje.' : 'Nešto te zanima prije ponude? Pitaj javno — odgovor vide svi.'}</p>}
              {questions.length > 0 && (
                <div className="qa-list">
                  {questions.map((item) => {
                    const fromOwner = item.user_id === listing.user_id
                    return (
                      <div key={item.id} className={`qa-row ${fromOwner ? 'is-owner' : ''}`}>
                        {item.author?.avatar_url ? <img src={item.author.avatar_url} alt="" className="poster-avatar poster-avatar-photo" /> : <div className="poster-avatar"><UserRound size={16} /></div>}
                        <div>
                          <strong>{item.author?.display_name || (fromOwner ? 'Vlasnik' : 'Korisnik')}{fromOwner && <span className="qa-owner-tag">vlasnik</span>} <small>{formatBosnianDate(item.created_at)}</small></strong>
                          <p>{item.body}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {user ? (
                <form className="qa-form" onSubmit={async (event) => { event.preventDefault(); setQaError(''); setAsking(true); try { await askQuestion(qaDraft); setQaDraft('') } catch (requestError) { setQaError(requestError.message) } finally { setAsking(false) } }}>
                  <input value={qaDraft} onChange={(event) => setQaDraft(event.target.value)} maxLength={1000} placeholder={isOwner ? 'Odgovori…' : 'Postavi pitanje…'} />
                  <button type="submit" className="primary-button" disabled={asking || qaDraft.trim().length < 3}>{isOwner ? 'Odgovori' : 'Pitaj'}</button>
                  {qaError && <span className="form-error qa-error">{qaError}</span>}
                </form>
              ) : (
                <Link to={`/login?next=${encodeURIComponent(`/listings/${listing.id}#pitanja`)}`} className="ghost-button">Prijavi se da pitaš</Link>
              )}
            </section>

            {isOwner && listing.status === 'published' && !acceptedBid && suggested.length > 0 && (
              <section className="job-card">
                <div className="rec-heading">
                  <h2>Predloženi izvođači</h2>
                  <p>Odabrani prema kategoriji, gradu i dosadašnjem radu na platformi.</p>
                </div>
                <div className="rec-grid">
                  {suggested.map((provider) => (
                    <Link className="rec-card" key={provider.user_id} to={`/korisnik/${provider.user_id}`}>
                      <div className="rec-card-top">
                        {provider.avatar_url
                          ? <img src={provider.avatar_url} alt="" className="poster-avatar poster-avatar-photo" />
                          : <div className="poster-avatar"><UserRound size={18} /></div>}
                        <span className="rec-score" title="Koliko izvođač odgovara ovom poslu">
                          <Sparkles size={13} /> {Math.round(provider.match_score)}
                        </span>
                      </div>
                      <h3>{provider.display_name || 'Korisnik Poso.ba'}</h3>
                      <div className="rec-card-meta">
                        <span><MapPin size={14} /> {provider.city || 'Bosna i Hercegovina'}</span>
                        {provider.review_count > 0 && <strong>{provider.avg_rating}★</strong>}
                        {provider.success_rate != null && <strong>{Math.round(provider.success_rate)}% uspješnost</strong>}
                      </div>
                      {provider.reasons?.length > 0 && (
                        <ul className="rec-reasons">
                          {provider.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {user && listing.status === 'completed' && myReview && (
              <section className="job-card review-done"><CheckCircle2 size={18} /> Hvala — tvoja recenzija ({'★'.repeat(Math.round(myReview.rating))}) je objavljena.</section>
            )}
            {user && listing.status === 'completed' && !myReview && (isOwner ? Boolean(acceptedBid) : acceptedBid?.bidder_id === user.id) && (
              <section className="job-card">
                <h2>Ostavi recenziju</h2>
                <form className="auth-form" onSubmit={submitReview}>
                  <div className="rating-picker">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button key={value} type="button" className={`rating-star ${reviewForm.rating >= value ? 'active' : ''}`} onClick={() => setReviewForm((current) => ({ ...current, rating: value }))} aria-label={`${value} zvjezdica`}>
                        <Star size={22} fill={reviewForm.rating >= value ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                  <label>Komentar (opciono)<textarea value={reviewForm.comment} onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} maxLength={1000} placeholder="Kakvo je bilo iskustvo?" /></label>
                  <button type="submit" className="ghost-button" disabled={submittingReview}>{submittingReview ? 'Šaljem...' : 'Pošalji recenziju'}</button>
                </form>
              </section>
            )}

            {related.length > 0 && <section className="job-card job-card-plain"><h2>Slični oglasi</h2><div className="listing-grid">{related.map((item) => <ListingCard key={item.id} listing={{ ...item, price: formatPrice(item.price, item.currency), time: formatDate(item.created_at) }} />)}</div></section>}
            {message && <div className="form-success" role="status">{message}</div>}
          </div>

          <aside className="job-side">
            <div className="job-offer-card">
              <span>Okvirni budžet</span>
              <strong>{formatPrice(listing.price, listing.currency)}</strong>
              {!isOwner && !myBid && listing.status === 'published' && <button type="button" className="primary-button full-width" onClick={openBidSheet}><Send size={18} /> Pošalji ponudu</button>}
              {!isOwner && myBid && (
                <div className={`my-bid-status status-${myBid.status}`}>
                  Tvoja ponuda: <strong>{formatPrice(myBid.amount)}</strong> — {BID_STATUS_LABEL[myBid.status]}
                  {myBid.status === 'pending' && <button type="button" className="link-button my-bid-withdraw" onClick={withdrawBid}>Povuci ponudu</button>}
                </div>
              )}
              {acceptedBid && (user?.id === acceptedBid.bidder_id || isOwner) && (
                <Link to={`/messages?listing=${listing.id}`} className="ghost-button full-width"><MessageCircle size={16} /> Otvori poruke</Link>
              )}
              {isOwner && acceptedBid && !payment && listing.status === 'published' && (
                <div className="outcome-actions">
                  <button type="button" className="primary-button full-width" onClick={() => setOutcome('completed')} disabled={outcomeBusy}><CheckCircle2 size={16} /> Posao završen</button>
                  <button type="button" className="ghost-button full-width" onClick={() => setOutcome('cancelled')} disabled={outcomeBusy}>Otkaži posao</button>
                </div>
              )}
              {listing.status === 'completed' && <div className="outcome-state done"><CheckCircle2 size={15} /> Posao završen</div>}
              {listing.status === 'cancelled' && <div className="outcome-state cancelled">Posao otkazan</div>}
              {payment && <div className={`pay-side pay-status-${payment.status}`}><Lock size={13} /> {payment.status === 'released' ? 'Isplaćeno izvođaču' : payment.status === 'refunded' ? 'Vraćeno klijentu' : `${formatPrice(payment.amount)} osigurano na Poso.ba`}</div>}
              <p className="job-safety"><ShieldCheck size={13} /> Plaćanje ide kroz Poso.ba Pay: novac se rezerviše kad prihvatiš ponudu i isplaćuje tek kad potvrdiš da je posao završen.</p>
              {!payment && <HowPaymentWorks />}
            </div>

            <Link to={`/korisnik/${listing.user_id}`} className="job-poster">
              {poster?.avatar_url
                ? <img src={poster.avatar_url} alt="" className="poster-avatar poster-avatar-photo" />
                : <div className="poster-avatar"><UserRound size={22} /></div>}
              <div>
                <small>Objavio</small>
                <strong>{poster?.display_name || 'Korisnik Poso.ba'}</strong>
                <span>{poster?.city || 'Bosna i Hercegovina'}{poster?.created_at ? ` · član od ${new Date(poster.created_at).getFullYear()}.` : ''}</span>
              </div>
            </Link>
          </aside>
        </div>
      </main>

      {!isOwner && !myBid && listing.status === 'published' && <button type="button" className="sticky-offer-button primary-button" onClick={openBidSheet}><Send size={18} /> Pošalji ponudu</button>}

      {overlays}
    </div>
  )
}

export default ListingDetailPage
