import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '../components/Toaster'
import SuccessSplash from '../components/SuccessSplash'
import { useBackToClose } from '../hooks/useBackToClose'
import { useGoBack } from '../hooks/useGoBack'
import { usePresence } from '../hooks/usePresence'
import { useCategoryPrice } from '../hooks/useCategoryPrice'
import { ArrowLeft, Bookmark, CalendarDays, Car, Copy, History, CheckCircle2, ChevronLeft, ChevronRight, Flag, Images, Lock, MapPin, MessageCircle, Pencil, ShieldCheck, Send, Share2, Sparkles, Star, Tag, UserRound, X, XCircle } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ListingCard from '../components/ListingCard'
import { bidService } from '../services/bidService'
import { listingService } from '../services/listingService'
import { reportService } from '../services/reportService'
import { profileService } from '../services/profileService'
import { reviewService } from '../services/reviewService'
import { matchService } from '../services/matchService'
import { useAuth } from '../context/AuthContext'
import { formatBosnianDate, timeAgo } from '../utils/dateFormat'
import { contactInfoMessage, findProhibitedTerm, findStreetAddress, scanContactInfo, streetAddressMessage } from '../utils/moderation'
import RuleOneNotice from '../components/RuleOneNotice'
import { AcceptOfferSheet, HowPaymentWorks } from '../components/JobPayment'
import NextStep from '../components/NextStep'
import JobProgress from '../components/JobProgress'
import { clientStep, workStateOf, workerStep } from '../utils/jobStep'
import WorkFlow from '../components/WorkFlow'
import LiveTracking from '../components/LiveTracking'
import ExactAddress from '../components/ExactAddress'
import { paymentService } from '../services/paymentService'
import { setPageTitle } from '../utils/pageTitle'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { keys, useMyPoint } from '../hooks/queries'
import { questionService } from '../services/questionService'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { shareLink } from '../utils/native'
import { useFullscreen } from '../app/useFullscreen'
import JobDetail from '../app/JobDetail'
import { confirmDialog, promptDialog } from '../utils/dialog'
import { SkeletonJobPhone } from '../components/Skeleton'
import ActionError from '../components/ActionError'
import OfferReplies from '../components/OfferReplies'
import { useOfferGate, useJobConditionCheck, offerCta } from '../hooks/useOfferGate'
import { useSimpleMode } from '../hooks/useSimpleMode'
import SimpleOfferSheet from '../components/SimpleOfferSheet'
import { ConditionsCard } from '../components/JobConditions'
import { badgeFixLink, requirementLabel } from '../utils/jobConditions'
import { recordInterest } from '../utils/interests'
import { scheduleLabel } from '../utils/schedule'
import { useSaved } from '../hooks/useSaved'
import { RequirementsList } from '../components/TaskExtras'
import { QuoteRequestCard } from '../components/QuoteRequest'
import { useMyCity } from '../hooks/useMyCity'
import { distanceLabel, distanceToJob, travelLabel } from '../utils/reach'
import { listingRoute } from '../utils/dropoff'
import { PromoBadge, PromoteCard } from '../components/Promotion'
import { useRequiredPermissions } from '../components/RequiredPermissions'
import { activePromotion } from '../services/promotionService'
import TrustLine from '../components/TrustLine'

const formatDate = formatBosnianDate
const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

/** Cover photo + thumbnail strip; a soft category placeholder when the job has no photos. */
function Gallery({ images, title, onOpen }) {
  const [active, setActive] = useState(0)
  // no photos: the title leads the page (a grey "no photos" box only pushed the job below the fold)
  if (images.length === 0) return null
  const current = images[Math.min(active, images.length - 1)]
  return (
    <div className="job-gallery">
      <button type="button" className="job-gallery-main" onClick={() => onOpen(active)} aria-label="Uvećaj sliku">
        <img src={current.url} fetchPriority="high" alt={title} />
        <span className="job-gallery-count"><Images size={13} /> {active + 1}/{images.length}</span>
      </button>
      {images.length > 1 && (
        <div className="job-gallery-thumbs">
          {images.map((image, index) => (
            <button key={image.id || image.url} type="button" className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Slika ${index + 1}`}>
              <img loading="lazy" decoding="async" src={image.url} alt="" />
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
  const goBack = useGoBack()
  const [searchParams, setSearchParams] = useSearchParams()
  const justPublished = ['1', 'quote'].includes(searchParams.get('published'))
  const splash = searchParams.get('published') === 'quote'
    ? { title: 'Zahtjev je poslan!', text: 'Posao vidi samo izvođač kojem si ga poslao/la. Javićemo ti čim pošalje ponudu.' }
    : { title: 'Posao je objavljen!', text: 'Izvođači u blizini dobijaju obavijest.' }
  const closeSplash = useCallback(() => setSearchParams((params) => { params.delete('published'); return params }, { replace: true }), [setSearchParams])
  const { user } = useAuth()
  const [listing, setListing] = useState(null)
  const conditionCheck = useJobConditionCheck(user?.id, listing?.conditions?.requires || [])
  const offerGate = useOfferGate(user?.id, id, conditionCheck.missing)
  const offerPermissions = useRequiredPermissions('offer')
  // jednostavan način (majstori 40+ ili po izboru): prijava jednim dodirom, bez kucanja
  const simpleMode = useSimpleMode(user?.id).enabled
  const offerLabel = simpleMode && offerGate === 'ok' ? 'Želim ovaj posao' : offerCta(offerGate, conditionCheck.missing)
  const [related, setRelated] = useState([])
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [bidForm, setBidForm] = useState({ amount: '', message: '' })
  const [editingBid, setEditingBid] = useState(false)
  const [sending, setSending] = useState(false)
  const [bidError, setBidError] = useState('')
  const [message, setMessage] = useState('')
  const [poster, setPoster] = useState(null)
  const [suggested, setSuggested] = useState([])
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  // undefined while it loads, null when the job has none: the job page keeps room for the card meanwhile
  const [payment, setPayment] = useState(undefined)
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
  const offerSheet = usePresence(sheetOpen, 220)
  useBackToClose(Boolean(acceptBid), () => setAcceptBid(null))
  useBackToClose(lightbox !== null, () => setLightbox(null))

  const share = async () => {
    const url = window.location.href
    try {
      const shared = await shareLink({ title: listing?.title, text: `${listing?.title} · Zadatak`, url })
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
      paymentService.forListing(id).then((row) => active && setPayment(row ?? null)).catch(() => active && setPayment(null))
      questionService.list(id).then((rows) => active && setQuestions(rows)).catch(() => {})
      bidService.bidderMetrics(id).then((rows) => active && setMetrics(rows)).catch(() => {})
      listingService.listRelated({ id, category: result.category, location: result.location }).then((rows) => active && setRelated(rows)).catch(() => {})
      profileService.getPublicProfile(result.user_id).then((profile) => active && setPoster(profile)).catch(() => {})
    }
    return () => { active = false }
  }, [core.data, id])
  // a failed background refresh keeps the job on screen; the error page is only for a job that never loaded
  useEffect(() => { if (core.error && !core.data) { setError(core.error.message); setLoading(false) } }, [core.error, core.data])

  const isOwner = Boolean(user && listing && user.id === listing.user_id)
  const saved = useSaved()
  const myCity = useMyCity()
  const myPoint = useMyPoint(user?.id)
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
  // rejected while the job is still open: the provider can come back with a new price (marketplace/01)
  const canRebid = Boolean(user && listing && user.id !== listing.user_id && myBid?.status === 'rejected' && listing.status === 'published' && !acceptedBid && listing.status !== 'expired')
  // offers that arrive live (useRealtimeSync) flash once; the ones on screen at first paint don't
  const [firstBidIds, setFirstBidIds] = useState(null)
  if (firstBidIds === null && core.data) setFirstBidIds(new Set(core.data.bids.map((bid) => bid.id)))
  const freshBidIds = useMemo(() => new Set(bids.filter((bid) => firstBidIds && !firstBidIds.has(bid.id)).map((bid) => bid.id)), [bids, firstBidIds])
  const tags = useMemo(() => (listing?.listing_tags || []).map((item) => item.tags?.name).filter(Boolean), [listing])

  const openBidSheet = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/listings/${id}` } } })
      return
    }
    // Ponude šalju samo izvođači s potvrđenim identitetom: nepotvrđen ide ravno
    // na verifikaciju (i nazad na ovaj posao), umjesto da piše ponudu uzalud.
    if (offerGate === 'needed' || offerGate === 'rejected') {
      navigate(`/account/verifikacija?next=${encodeURIComponent(`/listings/${id}`)}`)
      return
    }
    // offered once: notifications, so the provider hears back when the client answers (never blocks)
    const gate = offerGate
    await offerPermissions.ensure()
    // klijent traži značku koju izvođač nema: vodi ga pravo na mjesto gdje je dobija
    if (gate === 'missing_badges') {
      const first = conditionCheck.missing[0]
      toast(`Za ovaj posao treba značka: ${conditionCheck.missing.map(requirementLabel).join(', ')}.`, { kind: 'info' })
      navigate(badgeFixLink(first, `/listings/${id}`))
      return
    }
    if (gate === 'pending') {
      toast('Identitet se još provjerava, obično do 24 sata. Javićemo ti čim možeš slati ponude.', { kind: 'info' })
      return
    }
    setBidError('')
    setEditingBid(false)
    if (canRebid) setBidForm({ amount: '', message: myBid.message || '' })
    setSheetOpen(true)
  }

  // "Želim ovaj posao" s kartice posla (jednostavan način): sheet se otvori sam, čim je posao učitan
  const quickApply = searchParams.get('prijava') === '1'
  useEffect(() => {
    if (!quickApply || !listing) return
    setSearchParams((params) => { params.delete('prijava'); return params }, { replace: true })
    if (!isOwner && listing.status === 'published' && (!myBid || canRebid)) openBidSheet()
  }, [quickApply, listing]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Izmijeni ponudu": isti sheet, popunjen trenutnom ponudom, dok klijent nije odlučio.
  const openEditBid = () => {
    if (!myBid || myBid.status !== 'pending') return
    setBidForm({ amount: String(myBid.amount ?? ''), message: myBid.message || '' })
    setBidError('')
    setEditingBid(true)
    setSheetOpen(true)
  }

  const submitBid = (event) => {
    event.preventDefault()
    sendBid(bidForm)
  }

  const sendBid = async (form) => {
    setBidError('')
    if (findProhibitedTerm(form.message)) {
      setBidError('Poruka sadrži sadržaj koji krši Pravila korištenja.')
      return
    }
    const contactScan = scanContactInfo(form.message)
    if (!contactScan.clean) {
      setBidError(contactInfoMessage(contactScan, 'ponuda'))
      return
    }
    setSending(true)
    try {
      if (editingBid) {
        const updated = await bidService.updateBid(myBid.id, form)
        setBids((current) => current.map((bid) => (bid.id === updated.id ? { ...bid, ...updated } : bid)))
        queryClient.invalidateQueries({ queryKey: keys.listing(id) })
        setBidForm({ amount: '', message: '' })
        setEditingBid(false)
        setSheetOpen(false)
        toast('Ponuda je izmijenjena. Klijent vidi novu verziju.', { kind: 'success' })
        return
      }
      const created = await bidService.createBid({ listingId: id, bidderId: user.id, amount: form.amount, message: form.message })
      setBids((current) => [{ ...created, bidder: null }, ...current])
      recordInterest('bid', { category: listing?.category })
      bidService.listForListing(id).then((rows) => { setBids(rows); queryClient.setQueryData(keys.listing(id), (cur) => ({ listing: cur?.listing || listing, bids: rows })) }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setBidForm({ amount: '', message: '' })
      setSheetOpen(false)
      setMessage('Ponuda je uspješno poslana.'); toast(canRebid ? 'Nova cijena je poslana klijentu.' : 'Ponuda poslana. Javit ćemo ti kad klijent odgovori.', { kind: 'success' })
    } catch (requestError) {
      // Cijeli Error, ne samo tekst: odbijanje zbog verifikacije nosi i link (akcija).
      setBidError(requestError)
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
    const street = findStreetAddress(body)
    if (street) throw new Error(streetAddressMessage(street, 'pitanja ni odgovore'))
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
      setMessage(status === 'completed' ? 'Posao je označen kao završen. Hvala, ovo se računa u uspješnost izvođača.' : 'Posao je otkazan.')
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

  // ko je tražio prekid: od toga zavisi da li se čeka drugu stranu ili se od mene traži odgovor
  const [cancelBy, setCancelBy] = useState(null)
  const contractState = workStateOf(payment)
  useEffect(() => {
    if (contractState !== 'cancel_requested' || !payment?.id) { setCancelBy(null); return undefined }
    let alive = true
    paymentService.pendingCancellation(payment.id).then((row) => alive && setCancelBy(row?.requested_by || null)).catch(() => {})
    return () => { alive = false }
  }, [contractState, payment?.id])

  const iAmWorker = Boolean(user && ((payment && payment.provider_id === user.id) || (acceptedBid && acceptedBid.bidder_id === user.id)))
  const step = !listing ? null
    : isOwner ? clientStep({
      listing, payment, expired: listing.status === 'expired', reviewed: Boolean(myReview), cancelByMe: cancelBy ? cancelBy === user?.id : null,
      pending: listing.status === 'published' && !acceptedBid ? bids.filter((bid) => bid.status === 'pending').length : 0,
      hasWorker: Boolean(acceptedBid) && !payment && listing.status === 'published',
    })
      : iAmWorker ? workerStep({ listing, payment, cancelByMe: cancelBy ? cancelBy === user?.id : null })
        : null
  const scrollTo = (selector) => window.requestAnimationFrame(() => document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  const runStep = (action) => {
    if (action === 'offers') { setTab('ponude'); scrollTo(isPhone ? '.jd-tabs' : '#ponude') }
    else if (action === 'approve' || action === 'submit') { window.dispatchEvent(new CustomEvent('zadatak:korak', { detail: action })); if (action === 'submit') scrollTo('#tok-posla') }
    else if (action === 'workflow') scrollTo('#tok-posla')
    else if (action === 'review') scrollTo('#recenzija')
    else if (action === 'messages') navigate(`/messages?listing=${id}`)
    else if (action === 'repost') navigate(`/objavi?copy=${id}`)
    else if (action === 'reschedule') navigate(`/objavi?edit=${id}&step=time`)
    else if (action === 'outcome') setOutcome('completed')
  }
  // posao koji je dodijeljen, plaćen ili gotov se više ne uređuje (baza ga ionako ne pušta)
  const editable = Boolean(listing) && ['published', 'expired'].includes(listing.status) && !acceptedBid && !payment

  if (loading) return isPhone ? <SkeletonJobPhone /> : <div className="app-shell page-with-mobile-nav"><main className="content-container"><div className="detail-skeleton" /><div className="skeleton-card" /><div className="skeleton-card" /></main></div>
  // a failed request is not a missing job: on a weak mobile connection people need a retry, not a dead end
  if (error) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    // an unchanged result keeps the same data reference, so the load effect won't clear the skeleton: do it here
    const retry = async () => { setError(''); setLoading(true); await core.refetch(); setLoading(false) }
    return <div className="app-shell page-with-mobile-nav"><main className="content-container empty-state"><h1>Posao se nije učitao</h1><p>{offline ? 'Nema internet veze. Provjeri vezu i pokušaj ponovo.' : 'Veza sa serverom je prekinuta. Pokušaj ponovo.'}</p><button type="button" className="primary-button" onClick={retry}>Pokušaj ponovo</button><Link to="/search" className="secondary-button">Nazad na pretragu</Link></main></div>
  }
  if (!listing) return <div className="app-shell page-with-mobile-nav"><main className="content-container empty-state"><h1>Oglas nije pronađen</h1><p>Oglas više nije dostupan ili je privatan.</p><Link to="/search" className="primary-button">Nazad na pretragu</Link></main></div>

  const [descriptionBody] = (listing.description || '').split('\n\nKada:')
  const when = scheduleLabel(listing)
  const expired = listing.status === 'expired'
  const requirements = listing.requirements || []
  const isRemote = /online/i.test(listing.location || '')
  // "Zatraži ponudu": only the client and the invited provider ever get this far
  const isPrivate = Boolean(listing.invited_provider)

  const overlays = (
    <>
      {offerPermissions.sheet}
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
      {offerSheet.mounted && (
        <div className={`sheet-backdrop ${offerSheet.closing ? 'is-closing' : ''}`} inert={offerSheet.closing || undefined} role="presentation" onClick={() => setSheetOpen(false)}>
          <section className="offer-sheet" role="dialog" aria-modal="true" aria-labelledby="offer-title" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            {simpleMode && !editingBid ? (
              <SimpleOfferSheet
                listing={listing} priceStats={priceStats} feePercent={feePercent} when={when} sending={sending} error={bidError}
                rejectedAmount={canRebid ? myBid.amount : null} onSubmit={sendBid} onClose={() => setSheetOpen(false)}
              />
            ) : (<>
            <h2 id="offer-title">{editingBid ? 'Izmijeni ponudu' : canRebid ? 'Pošalji novu cijenu' : 'Pošalji ponudu'}</h2>
            {canRebid && !editingBid && <p className="rebid-note" data-testid="rebid-sheet-note"><strong>Klijent je odbio {formatPrice(myBid.amount)}.</strong><span>Predloži drugu cijenu ili objasni šta je uključeno.</span></p>}
            <p className="muted-text">{listing.price != null ? <>Klijent je naveo okvirni budžet od <strong>{formatPrice(listing.price, listing.currency)}</strong>. Možeš ponuditi manje ili više uz obrazloženje.</> : 'Klijent nije naveo budžet, predloži cijenu i objasni šta je uključeno.'}</p>
            <form className="auth-form" onSubmit={submitBid}>
              <label>Tvoja ponuda (KM)<input data-testid="offer-amount" type="number" min="0" step="0.01" inputMode="decimal" value={bidForm.amount} onChange={(event) => setBidForm({ ...bidForm, amount: event.target.value })} required /></label>
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
              <label>Obrazloženje<textarea data-testid="offer-message" minLength="3" maxLength="2000" value={bidForm.message} onChange={(event) => setBidForm({ ...bidForm, message: event.target.value })} placeholder="Napiši zašto si prava osoba za ovaj posao i šta je uključeno u cijenu." required /></label>
              <RuleOneNotice compact />
              <ActionError error={bidError} />
              <button data-testid="offer-submit" type="submit" className="primary-button" disabled={sending}>{sending ? 'Šaljem...' : editingBid ? 'Sačuvaj izmjene' : 'Pošalji ponudu'}</button>
              <button type="button" className="ghost-button" onClick={() => setSheetOpen(false)}>Odustani</button>
            </form>
            </>)}
          </section>
        </div>
      )}
    </>
  )

  if (isPhone) {
    return (
      <>
        {justPublished && (
          <SuccessSplash title={splash.title} text={splash.text} onClose={closeSplash} onShare={isPrivate ? undefined : share} />
        )}
        <JobDetail
          listing={listing} images={images} bids={bids} metrics={metrics} questions={questions} poster={poster} payment={payment} user={user}
          isOwner={isOwner} expired={expired} isPrivate={isPrivate} requirements={requirements} myCity={myCity} myPoint={myPoint} saved={saved.isSaved(listing.id)} onSave={() => saved.toggle(listing.id)} myBid={myBid} canRebid={canRebid} freshBidIds={freshBidIds} onWithdraw={withdrawBid} acceptedBid={acceptedBid} myReview={myReview} when={when} isRemote={isRemote} descriptionBody={descriptionBody}
          onBack={goBack} onShare={share} onReport={reportListing} onOpenBid={openBidSheet} onEditBid={openEditBid} offerLabel={offerLabel} offerGate={offerGate} conditionCheck={conditionCheck} simple={simpleMode}
          onAccept={(bidId) => setBidStatus(bidId, 'accepted')} onReject={async (bidId) => { if (await confirmDialog({ title: 'Odbiti ovu ponudu?', text: 'Izvođač dobija obavijest da ponuda nije prošla.', confirmLabel: 'Odbij', danger: true })) setBidStatus(bidId, 'rejected') }}
          onAsk={askQuestion} onOutcome={setOutcome} outcomeBusy={outcomeBusy} onOpenImage={(index) => setLightbox(index)} refreshJob={refreshJob}
          reviewForm={reviewForm} setReviewForm={setReviewForm} submitReview={submitReview} submittingReview={submittingReview} message={message}
          tab={tab} setTab={setTab} step={step} onStep={runStep} editable={editable}
        />
        {overlays}
      </>
    )
  }

  return (
    <div className="app-shell page-with-mobile-nav job-page">
      {justPublished && listing && (
        <SuccessSplash title={splash.title} text={splash.text} onClose={closeSplash} onShare={isPrivate ? undefined : share} />
      )}
      <main className="content-container">
        <div className="job-top">
          <button type="button" className="job-back" onClick={goBack}><ArrowLeft size={16} /> Nazad</button>
          <div className="job-top-actions">
            {!isPrivate && <button type="button" className="job-icon" onClick={share} aria-label="Podijeli oglas" title="Podijeli"><Share2 size={16} /></button>}
            {!isOwner && !iAmWorker && (
              <button type="button" className={`job-icon job-icon-text ${saved.isSaved(listing.id) ? 'is-saved' : ''}`} onClick={() => saved.toggle(listing.id)} aria-pressed={saved.isSaved(listing.id)}>
                <Bookmark size={15} fill={saved.isSaved(listing.id) ? 'currentColor' : 'none'} /> {saved.isSaved(listing.id) ? 'Sačuvano' : 'Sačuvaj'}
              </button>
            )}
            {isOwner && ['completed', 'cancelled', 'expired'].includes(listing.status) && <Link to={`/objavi?copy=${id}`} className="job-icon job-icon-text"><Copy size={15} /> Objavi sličan</Link>}
            {isOwner
              ? editable && <Link to={`/objavi?edit=${id}`} className="job-icon job-icon-text"><Pencil size={15} /> Uredi</Link>
              : <button type="button" className="job-icon" onClick={reportListing} aria-label="Prijavi oglas" title="Prijavi oglas"><Flag size={16} /></button>}
          </div>
        </div>

        <div className="job-layout">
          <div className="job-main">
            <Gallery images={images} title={listing.title} onOpen={(index) => setLightbox(index)} />

            <header className="job-head">
              <JobProgress listing={listing} payment={payment} bids={bids} acceptedBid={acceptedBid} expired={expired} />
              <div className="job-chips">
                {listing.status === 'published' && <PromoBadge tier={activePromotion(listing)} />}
                <span className="pill pill-soft">{listing.category || 'Ostalo'}</span>
                {listing.status === 'published' && !acceptedBid && isPrivate && <span className="pill pill-soft"><Lock size={12} /> Privatni zahtjev</span>}
              </div>
              <h1>{listing.title}</h1>
              {/* who, where, when: one row each, like Airtasker's POSTED BY / LOCATION / TO BE DONE ON */}
              <dl className="job-who-where">
                <Link to={`/korisnik/${listing.user_id}`} className="job-who-row">
                  {poster?.avatar_url
                    ? <img loading="lazy" decoding="async" src={poster.avatar_url} alt="" className="job-who-avatar" />
                    : <span className="job-who-avatar"><UserRound size={18} /></span>}
                  <div><dt>Objavio/la</dt><dd>{poster?.display_name || 'Korisnik Zadatka'} <small>{timeAgo(listing.created_at)}</small></dd></div>
                </Link>
                <div className="job-who-row">
                  <span className="job-who-icon"><MapPin size={18} /></span>
                  <div><dt>{listing.dropoff_location ? 'Odakle → Dokle' : 'Lokacija'}</dt><dd>{isRemote ? 'Online / na daljinu' : listingRoute(listing) || listing.location || 'Lokacija nije navedena'}{!isOwner && distanceLabel(distanceToJob(listing, myCity, myPoint)) && <small>{distanceLabel(distanceToJob(listing, myCity, myPoint))}</small>}</dd></div>
                </div>
                <div className="job-who-row">
                  <span className="job-who-icon"><CalendarDays size={18} /></span>
                  <div><dt>Kada</dt><dd>{when}</dd></div>
                </div>
              </dl>
            </header>

            <section className="job-card">
              <h2>Detalji</h2>
              <p className="job-description">{descriptionBody?.trim() || 'Vlasnik oglasa nije dodao detaljan opis.'}</p>
              {tags.length > 0 && <div className="tag-list job-tags">{tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
              <div className="job-facts-line">
                <span><Tag size={15} /> {listing.category || 'Ostalo'}</span>
                {travelLabel(listing) && <span><Car size={15} /> Put: {travelLabel(listing)}</span>}
              </div>
              <ExactAddress listing={listing} isOwner={isOwner} acceptedForMe={Boolean(user && acceptedBid?.bidder_id === user.id)} />
            </section>

            {expired && (
              <section className="job-card job-expired">
                <h2><History size={18} /> Rok za ovaj posao je prošao</h2>
                {isOwner
                  ? <>
                    <p className="muted-text">Posao više ne prima ponude i ne vidi se u pretrazi. Izaberi novi datum i objavi ga ponovo, postojeće ponude ostaju.</p>
                    <Link to={`/objavi?edit=${id}&step=time`} className="primary-button"><CalendarDays size={16} /> Izaberi novi datum</Link>
                  </>
                  : <p className="muted-text">Ovaj posao više ne prima ponude. Pogledaj slične poslove ispod.</p>}
              </section>
            )}

            <QuoteRequestCard listing={listing} userId={user?.id} isOwner={isOwner} myBid={myBid} onChanged={refreshJob} />

            <ConditionsCard
              conditions={listing.conditions} travelAllowance={listing.travel_allowance} held={user ? conditionCheck.held : null}
              identityOk={!['needed', 'pending', 'rejected'].includes(offerGate)} isOwner={isOwner} next={`/listings/${id}`}
            />

            {requirements.length > 0 && (
              <section className="job-card">
                <h2>Obavezni uslovi</h2>
                <p className="muted-text">Klijent traži da izvođač ispunjava ove uslove.</p>
                <RequirementsList items={requirements} />
              </section>
            )}

            {payment && (isOwner || user?.id === payment.provider_id) && (
              <>
                <LiveTracking payment={payment} listing={listing} role={isOwner ? 'client' : 'provider'} />
                <WorkFlow payment={payment} role={isOwner ? 'client' : 'provider'} user={user} onChanged={refreshJob} title={listing.title} />
              </>
            )}


            <section className="job-card" id="ponude">
              <div className="section-heading"><h2>Ponude</h2><span className="muted-text">{bids.length}</span></div>
              {!isOwner && bids.length > 0 && !acceptedBid && (
                <p className="contact-protection-note"><ShieldCheck size={15} /> Kontakt podaci su zaštićeni dok vlasnik ne prihvati ponudu.</p>
              )}
              {bids.length === 0 ? <p className="muted-text">Još nema ponuda. Budi prvi koji će poslati ponudu.</p> : (
                <div className="offers-list">
                  {bids.map((bid) => (
                    <article className={`offer-row bid-row status-${bid.status} ${freshBidIds.has(bid.id) ? 'is-just-arrived' : ''}`} key={bid.id}>
                      {bid.bidder?.avatar_url
                        ? <img loading="lazy" decoding="async" src={bid.bidder.avatar_url} alt="" className="poster-avatar poster-avatar-photo" />
                        : <div className="poster-avatar"><UserRound size={18} /></div>}
                      <div>
                        <strong>{bid.bidder?.display_name || 'Korisnik Zadatka'}</strong>
                        <TrustLine m={metrics[bid.bidder_id]} />
                        <p>{bid.message}</p>
                        <span className={`bid-status-label status-${bid.status}`}>{BID_STATUS_LABEL[bid.status]}</span>
                        {(isOwner || bid.bidder_id === user?.id) && <OfferReplies bid={bid} userId={user?.id} canWrite={bid.status === 'pending'} />}
                      </div>
                      <div className="offer-actions">
                        <b>{formatPrice(bid.amount)}</b>
                        {isOwner && bid.status === 'pending' && (
                          <div className="bid-owner-actions">
                            <button data-testid="offer-accept" type="button" className="primary-button small-button" onClick={() => setBidStatus(bid.id, 'accepted')} disabled={listing.status !== 'published'}><Lock size={15} /> Prihvati i plati</button>
                            <button type="button" className="ghost-button danger-button" onClick={async () => { if (await confirmDialog({ title: 'Odbiti ovu ponudu?', text: 'Izvođač dobija obavijest da ponuda nije prošla.', confirmLabel: 'Odbij', danger: true })) setBidStatus(bid.id, 'rejected') }}><XCircle size={16} /> Odbij</button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* na mom dodijeljenom ili gotovom poslu bez pitanja nema šta pitati ni odgovarati */}
            {(questions.length > 0 || (listing.status === 'published' && !acceptedBid)) && <section className="job-card" id="pitanja">
              <div className="section-heading"><h2>Pitanja</h2><span className="muted-text">{questions.length}</span></div>
              {questions.length === 0 && <p className="muted-text">{isOwner ? 'Niko još nije postavio pitanje.' : (isPrivate ? 'Nešto te zanima prije ponude? Pitanje i odgovor vidite samo ti i klijent.' : 'Nešto te zanima prije ponude? Pitaj javno, odgovor vide svi.')}</p>}
              {questions.length > 0 && (
                <div className="qa-list">
                  {questions.map((item) => {
                    const fromOwner = item.user_id === listing.user_id
                    return (
                      <div key={item.id} className={`qa-row ${fromOwner ? 'is-owner' : ''}`}>
                        {item.author?.avatar_url ? <img loading="lazy" decoding="async" src={item.author.avatar_url} alt="" className="poster-avatar poster-avatar-photo" /> : <div className="poster-avatar"><UserRound size={16} /></div>}
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
                  <input value={qaDraft} onChange={(event) => setQaDraft(event.target.value)} maxLength={1000} placeholder={isOwner ? 'Odgovori…' : 'Postavi pitanje…'} aria-label={isOwner ? 'Odgovor na pitanje' : 'Tvoje pitanje'} />
                  <button type="submit" className="primary-button" disabled={asking || qaDraft.trim().length < 3}>{isOwner ? 'Odgovori' : 'Pitaj'}</button>
                  {qaError && <span className="form-error qa-error">{qaError}</span>}
                </form>
              ) : (
                <Link to={`/login?next=${encodeURIComponent(`/listings/${listing.id}#pitanja`)}`} className="ghost-button">Prijavi se da pitaš</Link>
              )}
            </section>}

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
                          ? <img loading="lazy" decoding="async" src={provider.avatar_url} alt="" className="poster-avatar poster-avatar-photo" />
                          : <div className="poster-avatar"><UserRound size={18} /></div>}
                        <span className="rec-score" title="Koliko izvođač odgovara ovom poslu">
                          <Sparkles size={13} /> {Math.round(provider.match_score)}
                        </span>
                      </div>
                      <h3>{provider.display_name || 'Korisnik Zadatka'}</h3>
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
              <section className="job-card review-done"><CheckCircle2 size={18} /> Hvala, tvoja recenzija ({'★'.repeat(Math.round(myReview.rating))}) je objavljena.</section>
            )}
            {user && listing.status === 'completed' && !myReview && (isOwner ? Boolean(acceptedBid) : acceptedBid?.bidder_id === user.id) && (
              <section className="job-card" id="recenzija">
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

            {related.length > 0 && !isOwner && !iAmWorker && <section className="job-card job-card-plain"><h2>Slični oglasi</h2><div className="listing-grid">{related.map((item) => <ListingCard key={item.id} listing={{ ...item, price: formatPrice(item.price, item.currency), time: formatDate(item.created_at) }} />)}</div></section>}
            {message && <div className="form-success" role="status">{message}</div>}
          </div>

          <aside className="job-side">
            <div className="job-offer-card">
              <span>{payment ? 'Dogovorena cijena' : 'Budžet za posao'}</span>
              <strong>{formatPrice(payment ? payment.amount : listing.price, listing.currency)}</strong>
              {step && <NextStep step={step} onAction={runStep} busy={outcomeBusy} />}
              {isOwner && acceptedBid && (
                <Link to={`/korisnik/${acceptedBid.bidder_id}`} className="side-worker" data-testid="chosen-worker">
                  {acceptedBid.bidder?.avatar_url
                    ? <img loading="lazy" decoding="async" src={acceptedBid.bidder.avatar_url} alt="" className="side-worker-avatar" />
                    : <span className="side-worker-avatar"><UserRound size={18} /></span>}
                  <span><small>Tvoj izvođač</small><strong>{acceptedBid.bidder?.display_name || 'Izvođač'}</strong></span>
                  <ChevronRight size={16} />
                </Link>
              )}
              {!isOwner && !myBid && listing.status === 'published' && <button type="button" className={simpleMode ? 'simple-apply-btn' : 'primary-button full-width'} onClick={openBidSheet}><Send size={simpleMode ? 24 : 18} /> {offerLabel}</button>}
              {canRebid && (
                <div className="rebid-note" data-testid="rebid-note">
                  <strong>Klijent je odbio ponudu. Pošalji novu cijenu.</strong>
                  <span>Posao je još otvoren; klijent vidi samo tvoju najnoviju cijenu.</span>
                </div>
              )}
              {canRebid && <button type="button" className="primary-button full-width" data-testid="rebid-open" onClick={openBidSheet}><Send size={18} /> Pošalji novu cijenu</button>}
              {!isOwner && myBid && !step && (
                <div className={`my-bid-status status-${myBid.status}`}>
                  {payment?.bid_id === myBid.id && Number(payment.amount) !== Number(myBid.amount)
                    ? <>Dogovorena cijena: <strong>{formatPrice(payment.amount)}</strong> (ponuda {formatPrice(myBid.amount)} + odobreno povećanje)</>
                    : <>Tvoja ponuda: <strong>{formatPrice(myBid.amount)}</strong></>}, {BID_STATUS_LABEL[myBid.status]}
                </div>
              )}
              {!isOwner && myBid?.status === 'pending' && (
                <div className="my-bid-actions">
                  <button type="button" className="primary-button full-width" onClick={openEditBid}><Pencil size={16} /> Izmijeni ponudu</button>
                  <button type="button" className="ghost-button full-width" onClick={withdrawBid}>Povuci ponudu</button>
                </div>
              )}
              {acceptedBid && (user?.id === acceptedBid.bidder_id || isOwner) && step?.action !== 'messages' && step?.secondary !== 'messages' && (
                <Link to={`/messages?listing=${listing.id}`} className="ghost-button full-width"><MessageCircle size={16} /> Otvori poruke</Link>
              )}
              {isOwner && acceptedBid && !payment && listing.status === 'published' && (
                <button type="button" className="ghost-button full-width" onClick={() => setOutcome('cancelled')} disabled={outcomeBusy}>Otkaži posao</button>
              )}
              {!payment && !step && <p className="job-safety"><ShieldCheck size={13} /> Plaćanje ide kroz Zadatak Pay: novac se rezerviše kad klijent prihvati ponudu i isplaćuje tek kad odobri urađen posao.</p>}
              {!payment && (!isOwner || listing.status === 'published') && <HowPaymentWorks />}
            </div>

            {isOwner && <PromoteCard listing={listing} userId={user?.id} onDone={refreshJob} />}

          </aside>
        </div>
      </main>

      {!isOwner && (!myBid || canRebid) && listing.status === 'published' && <button type="button" className="sticky-offer-button primary-button" onClick={openBidSheet}><Send size={18} /> {canRebid ? 'Pošalji novu cijenu' : offerLabel}</button>}

      {overlays}
    </div>
  )
}

export default ListingDetailPage
