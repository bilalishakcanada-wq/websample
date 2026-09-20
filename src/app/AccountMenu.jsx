import { Link, useNavigate } from 'react-router-dom'
import { Bell, BellRing, Camera, ChevronRight, CreditCard, FileText, HelpCircle, IdCard, Images, LayoutDashboard, Lock, LogOut, MessageSquare, ShieldCheck, UserRound, Users, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAccount } from '../pages/account/AccountLayout'
import { useMode } from './mode'
import { haptic } from '../utils/native'
import './app.css'

/** Phone account screen: who you are, which face of the app you use, and plain rows to everything else. */
function AccountMenu({ onPickAvatar, uploadingAvatar }) {
  const navigate = useNavigate()
  const { logout, isStaff } = useAuth()
  const { profile } = useAccount()
  const [mode, setMode] = useMode()
  const isProvider = profile.account_type === 'provider' || profile.account_type === 'both'

  const groups = [
    {
      title: 'Postavke naloga',
      rows: [
        ['/account/placanje', 'Opcije plaćanja', null, CreditCard],
        ['/account/informacije', 'Informacije o nalogu', null, IdCard],
      ],
    },
    {
      title: 'Obavijesti',
      rows: [
        ['/account/postavke-obavijesti', 'Postavke obavijesti', null, Bell],
        ...(isProvider ? [['/account/alarmi', 'Alarmi za poslove', 'Budi prvi koji sazna za nove poslove', BellRing]] : []),
      ],
    },
    ...(isProvider ? [{
      title: 'Za izvođače',
      rows: [
        ['/account/ploca', 'Moja ploča', 'Nivo, naknada i zarada', LayoutDashboard],
        ['/account/vjestine', 'Vještine', null, Wrench],
        ['/account/portfolio', 'Portfolio radova', null, Images],
      ],
    }] : []),
    {
      title: 'Pomoć i podrška',
      rows: [
        ['/pomoc', 'Česta pitanja', null, HelpCircle],
        ['/pravila-zajednice', 'Pravila zajednice', null, Users],
        ['/kontakt', 'Kontaktiraj nas', null, MessageSquare],
        ...(isStaff ? [['/admin', 'Admin panel', null, ShieldCheck]] : []),
      ],
    },
    {
      title: 'Sigurnost',
      rows: [
        ['/pravila', 'Pravila i uslovi', null, FileText],
        ['/privatnost', 'Privatnost', null, Lock],
      ],
    },
  ]

  return (
    <div className="ap ap-page ap-account">
      <header className="ap-account-head">
        <Link to="/account/obavijesti" className="ap-account-bell" aria-label="Obavijesti"><Bell size={20} /></Link>
        <button type="button" className="ap-account-avatar" onClick={onPickAvatar} disabled={uploadingAvatar} aria-label="Promijeni profilnu sliku">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={36} />}
          <span><Camera size={13} /></span>
        </button>
        <div>
          <h1>{profile.full_name || 'Tvoj nalog'}</h1>
          {profile.city && <small>{profile.city}</small>}
          <div className="ap-account-links">
            <Link to={`/korisnik/${profile.user_id}`}>Vidi javni profil</Link>
            <Link to="/account/profil">✎ Uredi</Link>
          </div>
        </div>
      </header>

      <div className="ap-mode" role="radiogroup" aria-label="Način korištenja">
        <button type="button" role="radio" aria-checked={mode === 'poster'} className={mode === 'poster' ? 'active' : ''} onClick={() => { setMode('poster'); haptic('light') }}>Uradi posao</button>
        <button type="button" role="radio" aria-checked={mode === 'tasker'} className={mode === 'tasker' ? 'active' : ''} onClick={() => { setMode('tasker'); haptic('light') }}>Zaradi</button>
      </div>
      <p className="ap-mode-hint">{mode === 'tasker' ? 'Vidiš poslove u blizini i svoje ponude.' : 'Objavljuješ poslove i biraš izvođače.'}</p>

      {groups.map((group) => (
        <section key={group.title} className="ap-section">
          <span className="ap-label ap-eyebrow">{group.title}</span>
          <div className="ap-menu ap-menu-plain">
            {group.rows.map(([to, label, sub, Icon]) => (
              <Link key={to} to={to} className="ap-menu-row"><Icon size={18} /><span>{label}{sub && <small>{sub}</small>}</span><ChevronRight size={18} /></Link>
            ))}
          </div>
        </section>
      ))}

      <button type="button" className="ap-menu-row ap-menu-logout" onClick={async () => { await logout(); navigate('/') }}><LogOut size={18} /><span>Odjavi se</span></button>
      <p className="ap-version">Poso.ba · beta</p>
    </div>
  )
}

export default AccountMenu
