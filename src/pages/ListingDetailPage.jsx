import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Flag, MapPin, MessageCircle, ShieldCheck, Send, Sparkles, Star, Tag, UserRound, Users, XCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ListingCard from '../components/ListingCard'
import { bidService } from '../services/bidService'
import { listingService } from '../services/listingService'
import { reportService } from '../services/reportService'
import { profileService } from '../services/profileService'
import { reviewService } from '../services/reviewService'
import { matchService } from '../services/matchService'
import { useAuth } from '../context/AuthContext'
import { formatBosnianDate } from '../utils/dateFormat'
import { findProhibitedTerm } from '../utils/moderation'

const formatDate = formatBosnianDate
const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

const BID_STATUS_LABEL = {
  pending: 'Na čekanju',
  accepted: 'Prihvaćena',
  rejected: 'Odbijena',
  withdrawn: 'Povučena',
}

function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
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

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listingService.getById(id), bidService.listForListing(id)])
      .then(async ([result, listingBids]) => {
        if (!active) return
        setListing(result)
        setBids(listingBids)
        if (result) {
          setRelated(await listingService.listRelated({ id, category: result.category, location: result.location }))
          profileService.getPublicProfile(result.user_id).then((profile) => active && setPoster(profile)).catch(() => {})
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [id])

  const isOwner = Boolean(user && listing && user.id === listing.user_id)

  useEffect(() => {
    if (!isOwner || !id) return undefined
    let active = true
    matchService.providersForListing(id, 4).then((rows) => active && setSuggested(rows))
    return () => { active = false }
  }, [isOwner, id])
  const myBid = useMemo(() => bids.find((bid) => bid.bidder_id === user?.id), [bids, user])
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
    setSending(true)
    try {
      const created = await bidService.createBid({ listingId: id, bidderId: user.id, amount: bidForm.amount, message: bidForm.message })
      setBids((current) => [{ ...created, bidder: null }, ...current])
      setBidForm({ amount: '', message: '' })
      setSheetOpen(false)
      setMessage('Ponuda je uspješno poslana.')
    } catch (requestError) {
      setBidError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  const reportListing = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/listings/${id}` } } })
      return
    }
    const reason = window.prompt('Opišite zašto prijavljujete ovaj oglas (npr. zabranjen sadržaj, prevara):')
    if (!reason) return
    try {
      await reportService.createReport({ reporterId: user.id, targetType: 'listing', targetId: id, reason })
      setMessage('Hvala, prijava je poslana našem timu.')
    } catch (requestError) {
      setMessage(requestError.message)
    }
  }

  const submitReview = async (event) => {
    event.preventDefault()
    setSubmittingReview(true)
    setMessage('')
    try {
      await reviewService.createReview({ reviewerId: user.id, revieweeId: listing.user_id, listingId: id, rating: reviewForm.rating, comment: reviewForm.comment })
      setReviewForm({ rating: 5, comment: '' })
      setMessage('Hvala na recenziji!')
    } catch (requestError) {
      setMessage(requestError.message)
    } finally {
      setSubmittingReview(false)
    }
  }

  const setBidStatus = async (bidId, status) => {
    try {
      const updated = await bidService.setStatus(bidId, status)
      setBids((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : status === 'accepted' && item.id !== updated.id && item.status === 'pending' ? item : item)))
      setMessage(status === 'accepted' ? 'Ponuda je prihvaćena. Sada možete razmjenjivati poruke i kontakt.' : 'Ponuda je odbijena.')
    } catch (requestError) {
      setMessage(requestError.message)
    }
  }

  if (loading) return <div className="app-shell page-with-mobile-nav"><main className="content-container"><div className="detail-skeleton" /><div className="skeleton-card" /><div className="skeleton-card" /></main></div>
  if (error || !listing) return <div className="app-shell page-with-mobile-nav"><main className="content-container empty-state"><h1>Oglas nije pronađen</h1><p>{error || 'Oglas više nije dostupan ili je privatan.'}</p><Link to="/search" className="primary-button">Nazad na pretragu</Link></main></div>

  return (
    <div className="app-shell page-with-mobile-nav">
      <header className="detail-header"><button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Nazad"><ArrowLeft size={20} /></button><span>Detalji zadatka</span><div className="detail-header-actions"><button type="button" className="icon-button" onClick={reportListing} aria-label="Prijavi oglas" title="Prijavi oglas"><Flag size={16} /></button><Link to="/search">Pretraga</Link></div></header>
      <main className="content-container detail-page">
        <div className="detail-layout">
          <div>
            <div className="detail-image"><Tag size={42} /></div>
            <div className="detail-heading">
              <span className="tag">{listing.category || 'Ostalo'}</span>
              <h1>{listing.title}</h1>
              <div className="detail-meta"><span><MapPin size={16} />{listing.location || 'Lokacija nije navedena'}</span><span><CalendarDays size={16} />Objavljeno {formatDate(listing.created_at)}</span></div>
            </div>
          </div>
          <aside className="detail-offer-card">
            <span>Okvirni budžet</span>
            <strong>{formatPrice(listing.price, listing.currency)}</strong>
            {!isOwner && !myBid && <button type="button" className="primary-button full-width" onClick={openBidSheet}><Send size={18} /> Pošalji ponudu</button>}
            {!isOwner && myBid && (
              <div className={`my-bid-status status-${myBid.status}`}>
                Vaša ponuda: <strong>{formatPrice(myBid.amount)}</strong> — {BID_STATUS_LABEL[myBid.status]}
              </div>
            )}
            {acceptedBid && (user?.id === acceptedBid.bidder_id || isOwner) && (
              <Link to="/messages" className="ghost-button full-width"><MessageCircle size={16} /> Otvori poruke</Link>
            )}
          </aside>
        </div>

        <section className="detail-section"><h2>Opis zadatka</h2><p className="detail-description">{listing.description || 'Vlasnik oglasa nije dodao detaljan opis.'}</p><div className="detail-stats"><span><Clock3 size={16} />Potrebno do: Po dogovoru</span><span><Users size={16} />{bids.length} {bids.length === 1 ? 'ponuda' : 'ponuda'}</span></div></section>
        <section className="detail-section"><h2>Detalji zadatka</h2><div className="detail-facts"><span><Tag size={18} /><b>Tip usluge</b> Uživo ili online, prema dogovoru</span><span><CalendarDays size={18} /><b>Kada je potrebno</b> Fleksibilan termin</span><span><MapPin size={18} /><b>Lokacija</b> {listing.location || 'Grad nije naveden'}</span></div></section>

        <section className="detail-section">
          <h2>O korisniku</h2>
          <Link to={`/korisnik/${listing.user_id}`} className="poster-row poster-row-link">
            {poster?.avatar_url
              ? <img src={poster.avatar_url} alt={poster.full_name} className="poster-avatar poster-avatar-photo" />
              : <div className="poster-avatar"><UserRound size={22} /></div>}
            <div>
              <strong>{poster?.full_name || 'Korisnik Poso.ba'}</strong>
              {poster?.display_uid && <span className="uid-chip">{poster.display_uid}</span>}
              <p>{poster?.city || 'Objavljuje zadatke na platformi'}</p>
            </div>
          </Link>
        </section>

        {tags.length > 0 && <section className="detail-section"><h2>Tagovi</h2><div className="tag-list">{tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></section>}

        {user && !isOwner && (
          <section className="detail-section">
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

        <section className="detail-section">
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
                    <strong>{bid.bidder?.full_name || 'Korisnik Poso.ba'}</strong>
                    {bid.bidder?.display_uid && <span className="uid-chip">{bid.bidder.display_uid}</span>}
                    <p>{bid.message}</p>
                    <span className={`bid-status-label status-${bid.status}`}>{BID_STATUS_LABEL[bid.status]}</span>
                  </div>
                  <div className="offer-actions">
                    <b>{formatPrice(bid.amount)}</b>
                    {isOwner && bid.status === 'pending' && (
                      <div className="bid-owner-actions">
                        <button type="button" className="ghost-button" onClick={() => setBidStatus(bid.id, 'accepted')}><CheckCircle2 size={16} /> Prihvati</button>
                        <button type="button" className="ghost-button danger-button" onClick={() => setBidStatus(bid.id, 'rejected')}><XCircle size={16} /> Odbij</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {isOwner && suggested.length > 0 && (
          <section className="detail-section">
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
                  <h3>{provider.full_name || 'Korisnik Poso.ba'}</h3>
                  <div className="rec-card-meta">
                    <span><MapPin size={14} /> {provider.city || 'Bosna i Hercegovina'}</span>
                    {provider.review_count > 0 && <strong>{provider.avg_rating}★</strong>}
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

        <section className="detail-section"><h2>Pitanja i odgovori</h2><p className="muted-text">Postavljanje pitanja biće dostupno nakon prijave.</p></section>
        {related.length > 0 && <section className="detail-section"><h2>Slični oglasi</h2><div className="listing-grid">{related.map((item) => <ListingCard key={item.id} listing={{ ...item, price: formatPrice(item.price, item.currency), time: formatDate(item.created_at) }} />)}</div></section>}
        {message && <div className="form-success" role="status">{message}</div>}
      </main>
      {!isOwner && !myBid && <button type="button" className="sticky-offer-button primary-button" onClick={openBidSheet}><Send size={18} /> Pošalji ponudu</button>}
      {sheetOpen && (
        <div className="sheet-backdrop" role="presentation" onClick={() => setSheetOpen(false)}>
          <section className="offer-sheet" role="dialog" aria-modal="true" aria-labelledby="offer-title" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 id="offer-title">Pošalji ponudu</h2>
            <p className="muted-text">Vlasnik je naveo okvirni budžet od <strong>{formatPrice(listing.price, listing.currency)}</strong>. Možete ponuditi manje ili više uz obrazloženje.</p>
            <form className="auth-form" onSubmit={submitBid}>
              <label>Vaša ponuda (KM)<input type="number" min="0" step="0.01" value={bidForm.amount} onChange={(event) => setBidForm({ ...bidForm, amount: event.target.value })} required /></label>
              <label>Obrazloženje<textarea minLength="3" maxLength="2000" value={bidForm.message} onChange={(event) => setBidForm({ ...bidForm, message: event.target.value })} placeholder="Napišite zašto ste prava osoba za ovaj posao i šta je uključeno u cijenu." required /></label>
              {bidError && <div className="form-error">{bidError}</div>}
              <button type="submit" className="primary-button" disabled={sending}>{sending ? 'Šaljem...' : 'Pošalji ponudu'}</button>
              <button type="button" className="ghost-button" onClick={() => setSheetOpen(false)}>Odustani</button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default ListingDetailPage
