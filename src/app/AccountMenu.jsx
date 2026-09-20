import { Link, useNavigate } from 'react-router-dom'
import { Award, Bell, Camera, ChevronRight, CreditCard, History, IdCard, Images, LifeBuoy, LogOut, Settings, ShieldCheck, Trophy, UserRound, Wallet, Wrench } from 'lucide-react'
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
      title: 'Nalog',
      rows: [
        ['/account/profil', 'Informacije o nalogu', IdCard],
        ['/account/znacke', 'Značke', Award],
        ...(isProvider ? [['/account/vjestine', 'Vještine', Wrench], ['/account/portfolio', 'Portfolio', Images], ['/account/ploca', 'Ploča izvođača', Trophy]] : []),
      ],
    },
    {
      title: 'Plaćanje',
      rows: [
        ['/account/novcanik', 'Balans', Wallet],
        ['/account/placanja', 'Historija plaćanja', History],
        ['/account/nacini-placanja', 'Načini plaćanja', CreditCard],
      ],
    },
    {
      title: 'Ostalo',
      rows: [
        ['/account/obavijesti', 'Obavijesti', Bell],
        ['/account/postavke', 'Postavke', Settings],
        ['/pomoc', 'Pomoć i podrška', LifeBuoy],
        ['/pravila-zajednice', 'Pravila zajednice', ShieldCheck],
        ...(isStaff ? [['/admin', 'Admin panel', ShieldCheck]] : []),
      ],
    },
  ]

  return (
    <div className="ap ap-page ap-account">
      <header className="ap-account-head">
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
          <span className="ap-label">{group.title}</span>
          <div className="ap-menu">
            {group.rows.map(([to, label, Icon]) => (
              <Link key={to} to={to} className="ap-menu-row"><Icon size={18} /><span>{label}</span><ChevronRight size={18} /></Link>
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
