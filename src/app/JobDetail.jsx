import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, CalendarDays, ChevronRight, Clock, Coins, Flag, MapPin, MessageCircle, MoreHorizontal, Pencil, Share2, Star, UserRound } from 'lucide-react'
import { JobPaymentCard } from '../components/JobPayment'
import { formatBosnianDate } from '../utils/dateFormat'
import { haptic } from '../utils/native'
import './app.css'

const money = (value, currency = 'BAM') => (value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`)
const BID_LABEL = { pending: 'Nova ponuda', accepted: 'Prihvaćena', rejected: 'Odbijena', withdrawn: 'Povučena' }

const Avatar = ({ url, size = 48 }) => (url
  ? <img src={url} alt="" className="jd-avatar" style={{ width: size, height: size }} />
  : <span className="jd-avatar jd-avatar-empty" style={{ width: size, height: size }}><UserRound size={size * 0.5} /></span>)

/** Phone job page, laid out like the reference app: status band → white sheet with the facts → Offers | Questions. */
function JobDetail(props) {
  const {
    listing, images, bids, metrics, questions, poster, payment, user, isOwner, myBid, acceptedBid, when, isRemote, descriptionBody,
    onBack, onShare, onReport, onOpenBid, onAccept, onReject, onAsk, onOutcome, outcomeBusy, onOpenImage, refreshJob,
    reviewForm, setReviewForm, submitReview, submittingReview, message, tab, setTab,
  } = props
  const [menu, setMenu] = useState(false)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')

  const open = listing.status === 'published' && !acceptedBid
  const progress = listing.status === 'completed' ? 100 : listing.status === 'cancelled' ? 100 : acceptedBid ? 66 : bids.length > 0 ? 33 : 12

  const band = isOwner
    ? listing.status === 'completed' ? ['Posao je završen', 'Hvala — ostavi recenziju izvođaču.']
      : listing.status === 'cancelled' ? ['Posao je otkazan', 'Možeš ga objaviti ponovo kad želiš.']
        : acceptedBid ? ['Izvođač odabran', payment ? 'Uplata je osigurana na Poso.ba.' : 'Dogovorite detalje u porukama.']
          : bids.length > 0 ? ['Dobio/la si ponude', 'Pogledaj ih i izaberi izvođača.'] : ['Čekaš ponude', 'Izvođači u blizini su obaviješteni.']
    : myBid ? [`Tvoja ponuda: ${money(myBid.amount)}`, BID_LABEL[myBid.status] === 'Nova ponuda' ? 'Čeka odgovor klijenta.' : BID_LABEL[myBid.status]]
      : open ? ['Pošalji ponudu sada', bids.length > 0 ? `${bids.length} ${bids.length === 1 ? 'izvođač je već poslao' : 'izvođača je već poslalo'} ponudu.` : 'Budi prvi — klijent čeka.']
        : [listing.status === 'completed' ? 'Posao je završen' : listing.status === 'cancelled' ? 'Posao je otkazan' : 'Izvođač je odabran', 'Ovaj posao više ne prima ponude.']

  const ask = async (event) => {
    event.preventDefault()
    setAskError('')
    setAsking(true)
    try { await onAsk(question); setQuestion(''); haptic('light') } catch (error) { setAskError(error.message) } finally { setAsking(false) }
  }

  return (
    <div className="ap jd">
      <header className="jd-top">
        <button type="button" className="ap-back" onClick={onBack} aria-label="Nazad"><ArrowLeft size={22} /></button>
        <button type="button" className="ap-back" onClick={() => setMenu((value) => !value)} aria-label="Više" aria-expanded={menu}><MoreHorizontal size={22} /></button>
        {menu && (
          <div className="jd-menu" role="menu" onClick={() => setMenu(false)}>
            <button type="button" role="menuitem" onClick={onShare}><Share2 size={16} /> Podijeli</button>
            {isOwner
              ? <Link to={`/objavi?edit=${listing.id}`} role="menuitem"><Pencil size={16} /> Uredi posao</Link>
              : <button type="button" role="menuitem" onClick={onReport}><Flag size={16} /> Prijavi</button>}
          </div>
        )}
      </header>

      <section className={`jd-band ${isOwner ? 'is-owner' : ''}`}>
        {isOwner && <div className="jd-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>}
        <h2>{band[0]}</h2>
        <p>{band[1]}</p>
        {!isOwner && open && !myBid && <button type="button" className="ap-btn ap-btn-primary" onClick={onOpenBid}>Pošalji ponudu</button>}
        {isOwner && acceptedBid && !payment && listing.status === 'published' && (
          <button type="button" className="ap-btn ap-btn-primary" onClick={() => onOutcome('completed')} disabled={outcomeBusy}>Posao je završen</button>
        )}
      </section>

      <section className="jd-sheet">
        <h1 className="jd-title">{listing.title}</h1>

        {!isOwner && (
          <Link to={`/korisnik/${listing.user_id}`} className="jd-poster">
            <Avatar url={poster?.avatar_url} size={44} />
            <div>
              <strong>{poster?.display_name || 'Korisnik Poso.ba'}</strong>
              <span>{poster?.created_at && Date.now() - new Date(poster.created_at) < 30 * 864e5 ? 'Novi član!' : `Član od ${poster?.created_at ? new Date(poster.created_at).getFullYear() : '—'}.`}</span>
            </div>
            <ChevronRight size={18} />
          </Link>
        )}

        <ul className="jd-facts">
          <li>
            <MapPin size={20} />
            <span>{isRemote ? 'Online / na daljinu' : listing.location || 'Lokacija nije navedena'}</span>
            {!isRemote && listing.location && <Link to={`/search?q=${encodeURIComponent(listing.location)}&view=map`} className="jd-link">Na mapi</Link>}
          </li>
          <li>
            <CalendarDays size={20} />
            <span>{when}</span>
            {isOwner && open && <Link to={`/objavi?edit=${listing.id}`} className="jd-link">Uredi</Link>}
          </li>
          <li>
            <Coins size={20} />
            <span><strong>{money(listing.price, listing.currency)}</strong><small>Budžet</small></span>
            {isOwner && open && <Link to={`/objavi?edit=${listing.id}`} className="jd-link">Uredi</Link>}
          </li>
        </ul>

        <p className="jd-desc">{descriptionBody?.trim() || 'Vlasnik nije dodao detaljan opis.'}</p>

        {images.length > 0 && (
          <div className="jd-photos">
            {images.map((image, index) => (
              <button key={image.id || index} type="button" onClick={() => onOpenImage(index)} aria-label={`Slika ${index + 1}`}><img src={image.url} alt="" loading="lazy" /></button>
            ))}
          </div>
        )}

        {payment && (isOwner || user?.id === payment.provider_id) && (
          <div className="jd-payment"><JobPaymentCard payment={payment} role={isOwner ? 'client' : 'provider'} onChanged={refreshJob} /></div>
        )}

        {acceptedBid && (user?.id === acceptedBid.bidder_id || isOwner) && (
          <Link to="/messages" className="ap-btn ap-btn-light jd-messages"><MessageCircle size={18} /> Otvori poruke</Link>
        )}

        <div className="jd-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'ponude'} className={tab === 'ponude' ? 'active' : ''} onClick={() => setTab('ponude')}>Ponude <b>{bids.length}</b></button>
          <button type="button" role="tab" aria-selected={tab === 'pitanja'} className={tab === 'pitanja' ? 'active' : ''} onClick={() => setTab('pitanja')}>Pitanja <b>{questions.length}</b></button>
        </div>

        {tab === 'ponude' && (
          <div className="jd-offers">
            {bids.length === 0 && (
              <p className="jd-empty">{isOwner ? 'Još nema ponuda. Izvođači obično odgovore u roku sat vremena.' : 'Još nema ponuda — možeš biti prvi.'}</p>
            )}
            {bids.map((bid) => {
              const m = metrics[bid.bidder_id]
              const mine = bid.bidder_id === user?.id
              return (
                <article key={bid.id} className={`jd-offer status-${bid.status}`}>
                  <div className="jd-offer-head">
                    <Link to={`/korisnik/${bid.bidder_id}`}><Avatar url={bid.bidder?.avatar_url} size={56} /></Link>
                    <div className="jd-offer-who">
                      <strong>{mine ? 'Ti' : bid.bidder?.display_name || 'Izvođač'} {m?.is_verified && <BadgeCheck size={16} className="jd-verified" />}</strong>
                      {m && Number(m.review_count) > 0
                        ? <span className="jd-rating"><b>{Number(m.avg_rating).toFixed(1)}</b> <Star size={14} fill="currentColor" /> ({m.review_count})</span>
                        : <span className="jd-rating muted">Bez recenzija</span>}
                      {m?.success_rate != null && <span><b>{Math.round(m.success_rate)}%</b> uspješnost</span>}
                    </div>
                    <em className="jd-offer-price">{money(bid.amount)}</em>
                  </div>
                  {bid.message && <p className="jd-offer-msg">{bid.message}</p>}
                  <span className={`jd-offer-state s-${bid.status}`}>{BID_LABEL[bid.status] || bid.status} <Clock size={13} /> {formatBosnianDate(bid.created_at)}</span>
                  {isOwner && bid.status === 'pending' && open && (
                    <div className="jd-offer-actions">
                      <button type="button" className="ap-btn ap-btn-primary" onClick={() => onAccept(bid.id)}>Prihvati</button>
                      <button type="button" className="jd-reject" onClick={() => onReject(bid.id)}>Odbij</button>
                    </div>
                  )}
                </article>
              )
            })}
            {!isOwner && bids.length > 0 && !acceptedBid && <p className="jd-note">Kontakt podaci su zaštićeni dok klijent ne prihvati ponudu.</p>}
          </div>
        )}

        {tab === 'pitanja' && (
          <div className="jd-questions">
            {questions.length === 0 && <p className="jd-empty">{isOwner ? 'Niko još nije postavio pitanje.' : 'Nešto te zanima prije ponude? Pitaj javno — odgovor vide svi.'}</p>}
            {questions.map((item) => {
              const fromOwner = item.user_id === listing.user_id
              return (
                <div key={item.id} className={`jd-q ${fromOwner ? 'is-owner' : ''}`}>
                  <Avatar url={item.author?.avatar_url} size={36} />
                  <div>
                    <strong>{fromOwner ? `${item.author?.display_name || 'Vlasnik'} · vlasnik` : item.author?.display_name || 'Korisnik'} <small>{formatBosnianDate(item.created_at)}</small></strong>
                    <p>{item.body}</p>
                  </div>
                </div>
              )
            })}
            {user ? (
              <form className="jd-ask" onSubmit={ask}>
                <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} placeholder={isOwner ? 'Odgovori…' : 'Postavi pitanje…'} />
                <button type="submit" className="ap-btn ap-btn-primary ap-btn-inline" disabled={asking || question.trim().length < 3}>{isOwner ? 'Odgovori' : 'Pitaj'}</button>
                {askError && <span className="jd-error">{askError}</span>}
              </form>
            ) : (
              <Link to={`/login?next=${encodeURIComponent(`/listings/${listing.id}?tab=pitanja`)}`} className="ap-btn ap-btn-light">Prijavi se da pitaš</Link>
            )}
          </div>
        )}

        {user && listing.status === 'completed' && (isOwner ? Boolean(acceptedBid) : acceptedBid?.bidder_id === user.id) && (
          <form className="jd-review" onSubmit={submitReview}>
            <h3>Ostavi recenziju</h3>
            <div className="rating-picker">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" className={`rating-star ${reviewForm.rating >= value ? 'active' : ''}`} onClick={() => setReviewForm((current) => ({ ...current, rating: value }))} aria-label={`${value} zvjezdica`}>
                  <Star size={26} fill={reviewForm.rating >= value ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
            <textarea className="ap-textarea" value={reviewForm.comment} onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} maxLength={1000} placeholder="Kakvo je bilo iskustvo?" />
            <button type="submit" className="ap-btn ap-btn-primary" disabled={submittingReview}>{submittingReview ? 'Šaljem…' : 'Pošalji recenziju'}</button>
          </form>
        )}

        {isOwner && acceptedBid && !payment && listing.status === 'published' && (
          <button type="button" className="jd-cancel" onClick={() => onOutcome('cancelled')} disabled={outcomeBusy}>Otkaži posao</button>
        )}
        {message && <div className="form-success" role="status">{message}</div>}
      </section>

      {!isOwner && open && !myBid && (
        <div className="jd-sticky"><button type="button" className="ap-btn ap-btn-primary" onClick={onOpenBid}>Pošalji ponudu</button></div>
      )}
    </div>
  )
}

export default JobDetail
