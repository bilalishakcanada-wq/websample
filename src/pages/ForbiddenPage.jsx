import { Link } from 'react-router-dom'

function ForbiddenPage() {
  return (
    <div className="page-shell">
      <div className="page-card error-card">
        <h1>403</h1>
        <p>Nemate dozvolu za pristup ovoj stranici.</p>
        <Link to="/account" className="primary-button">Idi na moj nalog</Link>
        <Link to="/" className="ghost-button">Nazad na početnu</Link>
      </div>
    </div>
  )
}

export default ForbiddenPage
