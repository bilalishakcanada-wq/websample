import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

/**
 * Greška koja nudi izlaz. Kad baza odbije radnju iz razloga koji korisnik može
 * riješiti (npr. nije potvrdio identitet), poruka nosi i link na mjesto gdje se
 * to rješava — inače korisnik samo vidi da „ne radi" i ode.
 */
function ActionError({ error }) {
  if (!error) return null
  const poruka = typeof error === 'string' ? error : error.message
  const akcija = typeof error === 'string' ? null : error.akcija
  return (
    <div className="form-error action-error" role="alert">
      <AlertTriangle size={16} />
      <div>
        <span>{poruka}</span>
        {akcija && <Link to={akcija.href} className="action-error-link">{akcija.tekst} →</Link>}
      </div>
    </div>
  )
}

export default ActionError
