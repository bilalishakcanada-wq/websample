import { Clock3, MapPin, Tag } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const isRealListingId = (id) => /^[0-9a-f-]{36}$/i.test(String(id))

function ListingCard({ listing, onSave, saved = false }) {
  const navigate = useNavigate()
  const isReal = isRealListingId(listing.id)
  const openDetails = (event) => {
    if (isReal) return
    event.preventDefault()
    navigate('/register')
  }

  return (
    <article className="listing-card">
      {listing.image
        ? <div className="listing-card-image"><img src={listing.image} alt="" loading="lazy" /></div>
        : <div className="listing-card-image" aria-hidden="true"><Tag size={24} /></div>}
      <div className="listing-card-content">
        <div className="listing-card-topline">
          <span className="tag">{listing.tag || listing.category}</span>
          <button type="button" className="save-button" onClick={() => onSave?.(listing.id)}>{saved ? 'Sačuvano' : 'Sačuvaj'}</button>
        </div>
        <h3><Link to={isReal ? `/listings/${listing.id}` : '/register'} onClick={openDetails}>{listing.title}</Link></h3>
        <div className="listing-card-meta"><span><MapPin size={14} />{listing.location}</span><span><Clock3 size={14} />{listing.time}</span></div>
        <div className="listing-card-footer"><strong>{listing.price}</strong><Link className="text-link" to={isReal ? `/listings/${listing.id}` : '/register'} onClick={openDetails}>Detalji</Link></div>
      </div>
    </article>
  )
}

export default ListingCard
