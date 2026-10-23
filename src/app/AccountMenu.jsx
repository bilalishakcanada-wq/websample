import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Award, Bell, BellRing, Camera, ChevronRight, CreditCard, FileText, HelpCircle, IdCard, Images, LayoutDashboard, Lock, LogOut, MessageSquare, MousePointerClick, ShieldCheck, UserRound, Users, Wallet, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAccount } from '../pages/account/AccountLayout'
import { useMode } from './mode'
import { haptic } from '../utils/native'
import { accountService } from '../services/accountService'
import './app.css'
import NotifBellLink from '../components/NotifBellLink'

/** Phone account screen: who you are, which face of the app you use, and plain rows to everything else. */
function AccountMenu({ onPickAvatar, uploadingAvatar, notice = null }) {
  const navigate = useNavigate()
  const { logout, isStaff } = useAuth()
  const { profile } = useAccount()
  const [mode, setMode] = useMode()
  const isProvider = profile.account_type === 'provider' || profile.account_type === 'both'

  const tasker = isProvider && mode === 'tasker'
  const [balance, setBalance] = useState(null)
  useEffect(() => {
    let active = true
    accountService.myWallet().then((wallet) => { if (active) setBalance(Number(wallet?.balance || 0)) }).catch(() => {})
    return () => { active = false }
  }, [])
  const role = isProvider ? (profile.account_type === 'both' ? 'Klijent i izvođač' : 'Izvođač') : 'Klijent'

  const groups = [
    {
      title: 'Tvoj profil',
      rows: [
        ['/account/profil', 'Profil', 'Slika, ime, lokacija i opis', IdCard],
        ['/account/znacke', 'Značke', 'Verifikacije i dostignuća', Award],
        // the worker's own pages only in "Zaradi": a client never has to scroll past them
        ...(tasker ? [
          ['/account/vjestine', 'Vještine', null, Wrench],
          ['/account/portfolio', 'Portfolio radova', null, Images],
          ['/account/ploca', 'Moja ploča', 'Nivo, naknada i zarada', LayoutDashboard],
        ] : []),
      ],
    },
    {
      title: 'Postavke',
      rows: [
        ['/account/placanje', 'Opcije plaćanja', null, CreditCard],
        ['/account/informacije', 'Informacije o nalogu', null, UserRound],
        ['/account/postavke-obavijesti', 'Obavijesti', null, Bell],
        ...(tasker ? [['/account/alarmi', 'Alarmi za poslove', 'Budi prvi koji sazna za nove poslove', BellRing]] : []),
        ['/account/jednostavan-nacin', 'Jednostavan način', 'Velika dugmad i prijava na posao u 2 dodira', MousePointerClick],
      ],
    },
    {
      title: 'Pomoć',
      rows: [
        ['/pomoc', 'Česta pitanja', null, HelpCircle],
        ['/kontakt', 'Kontaktiraj nas', null, MessageSquare],
        ['/pravila-zajednice', 'Pravila zajednice', null, Users],
        ['/pravila', 'Pravila i uslovi', null, FileText],
        ['/privatnost', 'Privatnost', null, Lock],
        ...(isStaff ? [['/admin', 'Admin panel', null, ShieldCheck]] : []),
      ],
    },
  ]

  return (
    <div className="ap ap-page ap-account">
      <section className="acc-hero">
        <AccountSkyline />
        <div className="acc-hero-top">
          <h1>Nalog</h1>
          <NotifBellLink className="ap-account-bell" />
        </div>
        <div className="acc-id">
          <button type="button" className="ap-account-avatar" onClick={onPickAvatar} disabled={uploadingAvatar} aria-label="Promijeni profilnu sliku">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span className="acc-initial">{(profile.full_name || 'Z').trim().charAt(0).toUpperCase()}</span>}
            <span className="acc-cam"><Camera size={13} /></span>
          </button>
          <div className="acc-id-text">
            <strong>{profile.full_name || 'Tvoj nalog'}</strong>
            <small>{[profile.city, role].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
        <div className="acc-actions">
          <Link to="/account/profil" className="acc-edit">Uredi profil</Link>
          <Link to={`/korisnik/${profile.user_id}`} className="acc-public">Javni profil</Link>
        </div>
      </section>

      <Link to="/account/novcanik" className="acc-wallet" onClick={() => haptic('light')}>
        <span className="acc-wallet-icon"><Wallet size={20} /></span>
        <span className="acc-wallet-text">
          <small>Balans</small>
          <strong>{balance === null ? '…' : money(balance)}</strong>
        </span>
        <span className="acc-wallet-go">Otvori <ChevronRight size={16} /></span>
      </Link>
      {notice}

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
              <Link key={to} to={to} className="ap-menu-row"><span className="acc-tile"><Icon size={18} /></span><span>{label}{sub && <small>{sub}</small>}</span><ChevronRight size={18} /></Link>
            ))}
          </div>
        </section>
      ))}

      <button type="button" className="ap-menu-row ap-menu-logout" onClick={async () => { await logout(); navigate('/') }}><LogOut size={18} /><span>Odjavi se</span></button>
      <p className="ap-version">Zadatak · beta</p>
    </div>
  )
}

const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`

/** Thin line drawing of Sarajevo behind the header: Vijećnica, a minaret and the Latinska ćuprija arches. */
function AccountSkyline() {
  return (
    <svg className="acc-skyline" viewBox="0 0 400 120" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 112H400" />
        <path d="M150 112V78H230V112M150 78L160 68H220L230 78M170 68V58H210V68M178 58C178 44 202 44 202 58M190 46V38" />
        <path d="M160 112V90M172 112V90M184 112V90M196 112V90M208 112V90M220 112V90M156 86H224" />
        <path d="M270 112V40M266 40H274M267 40L270 26L273 40M266 60H274M267 60V54H273V60" />
        <path d="M296 112C306 92 330 92 340 112M340 112C350 92 374 92 384 112M290 100H392" />
        <path d="M40 112V92L60 80L80 92V112M48 112V100H56V112M100 112V84L118 74L136 84V112" />
      </g>
    </svg>
  )
}

export default AccountMenu
