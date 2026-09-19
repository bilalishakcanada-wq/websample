import { Ban, Handshake, ScanEye, ShieldBan, ShieldCheck, Star, UserCheck, MessageCircle } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'
import { withBase } from '../utils/paths'

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
      <section className="rule-one-card reveal" id="pravilo-1">
        <div className="rule-one-head">
          <span className="rule-one-number"><ShieldBan size={18} /> Pravilo #1</span>
          <h2>Bez kontakata i društvenih mreža na platformi</h2>
        </div>
        <p>
          Na Poso.ba se <strong>nikad</strong> ne dijeli broj telefona, email, link, Instagram, Facebook, Viber, WhatsApp, TikTok ni bilo koji drugi
          način kontakta van platforme — ni u oglasu, ni u ponudi, ni u opisu profila, ni u recenziji, <strong>ni na slici</strong>
          (profilna slika sa brojem, vizitka, natpis na kombiju). Jedini izuzetak: kad klijent prihvati ponudu, u porukama se kontakt može razmijeniti.
        </p>
        <div className="rule-one-how">
          <div>
            <ScanEye size={18} />
            <strong>Kako se provjerava</strong>
            <span>Svaki tekst se automatski skenira pri objavi (brojevi u svim oblicima, i "nula šest jedan…", i "o6l 387…"), a svaku sliku pregleda AI moderator. Provjera se ponavlja i naknadno, svaki dan.</span>
          </div>
          <div>
            <Ban size={18} />
            <strong>Šta se dešava</strong>
            <span>Kontakt se odmah uklanja iz teksta, slika se briše i bilježi se kršenje. 3 kršenja u 30 dana = suspenzija 7 dana, 5 = 30 dana, 7 = trajno.</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <strong>Zašto</strong>
            <span>Tako niko ne dobija neželjene pozive, ocjene ostaju vezane za stvarne poslove, a nikome se ne može ukrasti klijent ni identitet.</span>
          </div>
        </div>
      </section>

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
        <p className="muted-text">Na svaku odluku možeš odgovoriti kroz <a href={withBase('/kontakt?tema=account')}>kontakt formu</a> — pregledamo je druga osoba iz tima.</p>
      </section>
    </InfoLayout>
  )
}

export default CommunityGuidelinesPage
