import BrandMark from './BrandMark'
import { Link } from 'react-router-dom'

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-shell">
      <Link to="/" className="auth-logo">
        <BrandMark size={42} className="brand-mark" />
        <span className="brand-name">Poso.ba</span>
      </Link>

      <div className="auth-card">
        <h1>{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </div>

      <p className="auth-legal">
        Nastavkom prihvataš <Link to="/pravila">Pravila i uslove</Link> i <Link to="/privatnost">Politiku privatnosti</Link>.
      </p>
      {footer}
    </div>
  )
}

export default AuthLayout
