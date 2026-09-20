import BrandMark from './BrandMark'
import { Link } from 'react-router-dom'
import { DoneMascot } from '../app/Mascots'

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-shell">
      <Link to="/" className="auth-logo">
        <BrandMark size={42} className="brand-mark" />
        <span className="brand-name">Poso.ba</span>
      </Link>
      <div className="auth-art" aria-hidden="true"><DoneMascot /></div>

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
