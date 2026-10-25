import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Award, Bell, BellRing, Camera, ChevronRight, CreditCard, FileText, HelpCircle, IdCard, Images, LayoutDashboard, Lock, LogOut, MessageSquare, Phone, MousePointerClick, Settings, ShieldCheck, UserRound, Users, Wallet, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAccount } from '../pages/account/AccountLayout'
import { useMode } from './mode'
import { haptic } from '../utils/native'
import { accountService } from '../services/accountService'
import './app.css'
import '../pages/account/SettingsPage.css'
import NotifBellLink from '../components/NotifBellLink'
import { CropArt } from '../components/BosniaArt'
import PhoneVerify from '../components/PhoneVerify'
import { formatBosnianPhone } from '../utils/phone'

/** Phone account screen: who you are, which face of the app you use, and plain rows to everything else. */
function AccountMenu({ onPickAvatar, uploadingAvatar, notice = null }) {
  const navigate = useNavigate()
  const { logout, isStaff } = useAuth()
  const { profile, reload } = useAccount()
  const [phoneOpen, setPhoneOpen] = useState(false)
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
        ['/account/postavke', 'Postavke', 'Lokacija, obavijesti, telefon i lozinka', Settings],
        ['/account/placanje', 'Opcije plaćanja', null, CreditCard],
        ['/account/informacije', 'Informacije o nalogu', null, UserRound],
        ['telefon', 'Broj telefona', profile.phone_verified_at ? formatBosnianPhone(profile.phone) : 'Potvrdi SMS kodom', Phone, () => { haptic('light'); setPhoneOpen(true) }],
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
        <div className="acc-hero-top">
          <h1>Nalog</h1>
          <NotifBellLink className="ap-account-bell" />
        </div>
        <div className="acc-hero-body">
          <div className="acc-id">
            <button type="button" className="ap-account-avatar" onClick={onPickAvatar} disabled={uploadingAvatar} aria-label="Promijeni profilnu sliku">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span className="acc-initial">{(profile.full_name || 'Z').trim().charAt(0).toUpperCase()}</span>}
              <span className="acc-cam"><Camera size={13} /></span>
            </button>
            <strong>{profile.full_name || 'Tvoj nalog'}</strong>
            <small>{[profile.city, role].filter(Boolean).join(' · ')}</small>
            <div className="acc-actions">
              <Link to="/account/profil" className="acc-edit">Uredi profil</Link>
              <Link to={`/korisnik/${profile.user_id}`} className="acc-public">Javni profil</Link>
            </div>
          </div>
          <CropArt crop="most" className="acc-art" />
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

      {/* the same look as Postavke: grouped white cards, a coloured icon tile per row */}
      {groups.map((group) => (
        <section key={group.title} className="acc-group">
          <h2 className="st-group-title">{group.title}</h2>
          <div className="st-group">
            {group.rows.map(([to, label, sub, Icon, open]) => {
              const inner = <>
                <span className={`st-tile st-tile-${TONE[to] || 'blue'}`} aria-hidden="true"><Icon size={18} strokeWidth={2.2} /></span>
                <span className="st-text"><strong>{label}</strong>{sub && <span>{sub}</span>}</span>
                {to === 'telefon' && profile.phone_verified_at ? <span className="st-pill st-pill-ok">Potvrđen</span> : <ChevronRight size={18} className="st-chevron" />}
              </>
              return open
                ? <button key={to} type="button" className="st-row" onClick={open} data-testid="account-phone-row">{inner}</button>
                : <Link key={to} to={to} className="st-row">{inner}</Link>
            })}
          </div>
        </section>
      ))}

      <div className="st-group acc-logout">
        <button type="button" className="st-row" onClick={async () => { await logout(); navigate('/') }}>
          <span className="st-tile st-tile-red" aria-hidden="true"><LogOut size={18} strokeWidth={2.2} /></span>
          <span className="st-text"><strong className="st-danger">Odjavi se</strong></span>
        </button>
      </div>
      <p className="ap-version">Zadatak · beta</p>
      {phoneOpen && <PhoneVerify initialPhone={profile.phone || ''} onClose={() => setPhoneOpen(false)} onVerified={reload} />}
    </div>
  )
}

// icon tile colours, like the Postavke page
const TONE = {
  '/account/profil': 'blue', '/account/znacke': 'orange', '/account/vjestine': 'teal', '/account/portfolio': 'purple', '/account/ploca': 'green',
  '/account/postavke': 'gray', '/account/placanje': 'green', '/account/informacije': 'blue', telefon: 'green', '/account/postavke-obavijesti': 'red',
  '/account/alarmi': 'orange', '/account/jednostavan-nacin': 'purple',
  '/pomoc': 'blue', '/kontakt': 'teal', '/pravila-zajednice': 'purple', '/pravila': 'gray', '/privatnost': 'gray', '/admin': 'red',
}

const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`

export default AccountMenu
