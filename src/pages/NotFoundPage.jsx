import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="page-shell">
      <div className="page-card error-card">
        <h1>404</h1>
        <p>Stranica nije pronađena.</p>
        <Link to="/" className="primary-button">Nazad na početnu</Link>
      </div>
    </div>
  )
}

export default NotFoundPage
