import { Link } from 'react-router-dom'
import { ChevronRight, IdCard, KeyRound, Phone, Trash2 } from 'lucide-react'

/** "Informacije o nalogu": the four things people look for, as plain rows. */
function AccountInfoPage() {
  const rows = [
    ['/account/profil', 'Ažuriraj lične podatke', IdCard],
    ['/account/postavke#lozinka', 'Promijeni lozinku', KeyRound],
    ['/account/profil#telefon', 'Broj telefona', Phone],
    ['/account/postavke#brisanje', 'Obriši nalog', Trash2],
  ]
  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Informacije o nalogu</h1></div>
      <div className="ap-menu">
        {rows.map(([to, label, Icon]) => (
          <Link key={to} to={to} className="ap-menu-row"><Icon size={18} /><span>{label}</span><ChevronRight size={18} /></Link>
        ))}
      </div>
    </div>
  )
}

export default AccountInfoPage
