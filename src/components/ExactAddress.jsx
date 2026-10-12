import { Link } from 'react-router-dom'
import { Home, Navigation } from 'lucide-react'
import { useListingAddress } from '../hooks/queries'
import './ExactLocationPicker.css'

const directionsUrl = (point) => `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`

/**
 * The job's exact address under "Gdje", for the two people allowed to see it: the client and the provider
 * whose offer was accepted (the database returns nothing to anyone else). The client can add one if missing.
 */
function ExactAddress({ listing, isOwner, acceptedForMe, className = '' }) {
  const allowed = Boolean(listing && !/online/i.test(listing.location || '') && (isOwner || acceptedForMe))
  const exact = useListingAddress(listing?.id, allowed)
  if (!allowed) return null
  if (!exact) {
    if (!isOwner || !['published', 'draft'].includes(listing.status)) return null
    return (
      <Link to={`/objavi?edit=${listing.id}&step=where`} className={`xa xa-add ${className}`}>
        <Home size={15} /> Dodaj tačnu adresu (vidi je samo izvođač kojeg prihvatiš)
      </Link>
    )
  }
  return (
    <div className={`xa ${className}`}>
      <Home size={15} />
      <span>
        <strong>{exact.address || 'Tačka na mapi'}</strong>
        <small>{isOwner ? 'Vidiš ti i izvođač čiju ponudu prihvatiš' : 'Tačna adresa, vidiš je jer je tvoja ponuda prihvaćena'}</small>
      </span>
      <a href={directionsUrl(exact)} target="_blank" rel="noreferrer" className="xa-go"><Navigation size={14} /> Upute</a>
    </div>
  )
}

export default ExactAddress
