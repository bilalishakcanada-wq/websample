import { Ban, Lock, MessageSquareOff } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * Stoji umjesto polja za pisanje kad dopisivanje nije dozvoljeno.
 * Poruka objašnjava ZAŠTO i nudi sljedeći korak, inače korisnik misli da je kvar.
 */
function ChatStateNotice({ state, listingId, onUnblock }) {
  if (state === 'blocked') {
    return (
      <div className="ch-state-notice" role="status">
        <Ban size={18} />
        <div>
          <strong>Blokirao/la si ovog korisnika</strong>
          <p>Ne možete jedno drugom slati poruke, ponude ni pitanja. Prepiska ostaje sačuvana.</p>
          {onUnblock && <button type="button" className="ghost-button" onClick={onUnblock}>Odblokiraj</button>}
        </div>
      </div>
    )
  }
  if (state === 'locked') {
    return (
      <div className="ch-state-notice" role="status">
        <Lock size={18} />
        <div>
          <strong>Dopisivanje još nije otvoreno</strong>
          <p>Chat se otvara kada klijent prihvati ponudu i osigura uplatu. Do tada pitanja postavi javno na oglasu.</p>
          {listingId && <Link to={`/listings/${listingId}`} className="ghost-button">Otvori posao</Link>}
        </div>
      </div>
    )
  }
  if (state === 'readonly') {
    return (
      <div className="ch-state-notice" role="status">
        <MessageSquareOff size={18} />
        <div>
          <strong>Posao je završen, prepiska je zaključana</strong>
          <p>Poruke ostaju sačuvane i vidljive. Ako imaš primjedbu, otvori spor na stranici posla.</p>
          {listingId && <Link to={`/listings/${listingId}`} className="ghost-button">Otvori posao</Link>}
        </div>
      </div>
    )
  }
  return null
}

export default ChatStateNotice
