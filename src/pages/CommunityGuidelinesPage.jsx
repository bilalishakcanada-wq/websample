import { Ban, Handshake, ShieldCheck, Star, UserCheck, MessageCircle } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'

const RULES = [
  { icon: Handshake, title: 'Poštovanje je osnova', text: 'Obraćaj se drugima kako bi želio da se obraćaju tebi. Uvrede, prijetnje i uznemiravanje znače trajno uklanjanje naloga.' },
  { icon: UserCheck, title: 'Budi ono što tvrdiš da jesi', text: 'Pravo ime, prave slike radova, prava struka. Lažni profili i tuđe fotografije se uklanjaju, a verifikacija se poništava.' },
  { icon: MessageCircle, title: 'Dogovori se unutar platforme', text: 'Kontakt se razmjenjuje tek nakon prihvaćene ponude — to štiti obje strane od neželjenih poziva i nesporazuma.' },
  { icon: Star, title: 'Ocjenjuj pošteno', text: 'Recenzija opisuje stvarno iskustvo. Lažne, kupljene ili osvetničke recenzije se brišu, a nalog opominje.' },
  { icon: Ban, title: 'Bez zabranjenog sadržaja', text: 'Oružje, droga, falsifikati, piraterija, seksualne usluge i diskriminacija nemaju mjesto ovdje. Oglasi se automatski i ručno provjeravaju.' },
  { icon: ShieldCheck, title: 'Prijavi, ne prepiri se', text: 'Vidiš problem? Klikni zastavicu na oglasu ili profilu. Tim pregleda svaku prijavu; ozbiljne u roku nekoliko sati.' },
]

function CommunityGuidelinesPage() {
  return (
    <InfoLayout
      eyebrow="Pravila zajednice"
      title="Kako se ponašamo na Poso.ba"
      lead="Ovo su pravila koja svaki korisnik prihvata pri registraciji. Nisu tu da ograniče — tu su da svako ko uđe zna šta može očekivati od drugih."
      cta={{ eyebrow: 'Primijetio si kršenje?', text: 'Prijavi oglas ili korisnika — gledamo svaku prijavu.', to: '/kontakt?tema=report', label: 'Prijavi zloupotrebu' }}
    >
      <section className="info-grid reveal-stagger reveal">
        {RULES.map(({ icon: Icon, title, text }) => (
          <div className="info-card" key={title}><Icon size={20} /><strong>{title}</strong><p>{text}</p></div>
        ))}
      </section>

      <section className="info-section reveal">
        <h2>Šta se dešava pri kršenju</h2>
        <ol className="steps-timeline">
          <li><span className="step-index">1</span><div><strong>Opomena</strong><p>Za manje prekršaje (npr. netačna kategorija, nepotpun opis) — poruka sa objašnjenjem i rok da se ispravi.</p></div></li>
          <li><span className="step-index">2</span><div><strong>Privremeno ograničenje</strong><p>Za ponovljene prekršaje — nalog ne može objavljivati ni slati ponude 7 do 30 dana.</p></div></li>
          <li><span className="step-index">3</span><div><strong>Trajno uklanjanje</strong><p>Za prevaru, uznemiravanje, lažni identitet ili zabranjen sadržaj — odmah, bez opomene.</p></div></li>
        </ol>
        <p className="muted-text">Na svaku odluku možeš odgovoriti kroz <a href="/kontakt?tema=account">kontakt formu</a> — pregledamo je druga osoba iz tima.</p>
      </section>
    </InfoLayout>
  )
}

export default CommunityGuidelinesPage
