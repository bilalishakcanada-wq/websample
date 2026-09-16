import { Link } from 'react-router-dom'
import { Briefcase, CheckCircle2, ClipboardList, Hammer, MessageCircle, Search, ShieldCheck, Star, Wallet } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'
import { mockServiceCategories } from '../data/mockData'

const CLIENT_STEPS = [
  { icon: ClipboardList, title: 'Opiši šta ti treba', text: 'Naslov, kratak opis, grad i okvirni budžet. Drži jednostavno i jasno — to privlači najbolje izvođače. Objava je besplatna i traje manje od dvije minute.' },
  { icon: Wallet, title: 'Postavi budžet', text: 'Ne brini, budžet možeš mijenjati i dogovarati kroz ponude. Ako ne znaš koliko košta, pogledaj vodiče za cijene iz stvarnih oglasa.' },
  { icon: MessageCircle, title: 'Primi ponude, izaberi najboljeg', text: 'Pogledaj profile, ocjene, nivo povjerenja i portfolio. Prihvati ponudu — tek tada se otvaraju kontakti i poruke.' },
  { icon: Star, title: 'Ocijeni i zahvali', text: 'Kad je posao gotov, ostavi recenziju. Tako sljedeći klijent zna kome može vjerovati, a dobar majstor raste.' },
]

const PROVIDER_STEPS = [
  { icon: Hammer, title: 'Napravi profil izvođača', text: 'Izaberi struke, dodaj slike radova i pošalji dokaz o struci za oznaku "Verifikovan majstor".' },
  { icon: Search, title: 'Pronađi posao', text: 'Pretražuj po gradu i kategoriji na listi ili mapi, ili pusti da ti "Preporučeno za tebe" izdvoji najbolje.' },
  { icon: ClipboardList, title: 'Pošalji ponudu', text: 'Cijena plus obrazloženje zašto si pravi izbor. Ponude sa obrazloženjem prolaze višestruko češće.' },
  { icon: ShieldCheck, title: 'Gradi reputaciju', text: 'Svaki završen posao i ocjena dižu tvoj nivo povjerenja i mjesto u rezultatima.' },
]

function HowItWorksPage() {
  return (
    <InfoLayout
      eyebrow="Kako radi"
      title="Objavi posao. Primi ponude. Riješeno."
      lead="Najjednostavniji način da ljudi i firme u BiH prepuste posao nekom ko ga zna — i da majstori nađu klijente bez posrednika."
      cta={{ eyebrow: 'Počni odmah', text: 'Objavi prvi posao besplatno ili napravi profil izvođača.', to: '/objavi', label: 'Objavi posao' }}
      wide
    >
      <section className="info-section reveal">
        <div className="info-section-head"><Briefcase size={22} /><div><h2>Trebam uslugu</h2><p>Za klijente koji objavljuju posao.</p></div></div>
        <ol className="steps-timeline">
          {CLIENT_STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title}><span className="step-index">{index + 1}</span><div><Icon size={20} /><strong>{title}</strong><p>{text}</p></div></li>
          ))}
        </ol>
        <Link to="/objavi" className="primary-button">Objavi posao besplatno</Link>
      </section>

      <section className="info-section reveal">
        <div className="info-section-head"><Hammer size={22} /><div><h2>Pružam usluge</h2><p>Za majstore i izvođače koji traže posao.</p></div></div>
        <ol className="steps-timeline">
          {PROVIDER_STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title}><span className="step-index">{index + 1}</span><div><Icon size={20} /><strong>{title}</strong><p>{text}</p></div></li>
          ))}
        </ol>
        <Link to="/zaradi" className="primary-button">Postani izvođač</Link>
      </section>

      <section className="reveal">
        <div className="section-heading"><div><span className="eyebrow small-eyebrow">Volimo obaveze</span><h2>Od sitnih popravki do velikih radova</h2></div><Link to="/search">Sve kategorije →</Link></div>
        <div className="category-strip">
          {mockServiceCategories.map(({ id, name, image }) => (
            <Link key={id} to={`/search?category=${encodeURIComponent(name)}`} className="category-tile">
              <img src={image} alt="" loading="lazy" /><span>{name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="info-section reveal">
        <div className="info-section-head"><ShieldCheck size={22} /><div><h2>Pokriveni ste</h2><p>Bilo da objavljuješ ili radiš posao — platforma stoji iza tebe.</p></div></div>
        <div className="info-grid">
          <div className="info-card"><Star size={20} /><strong>Ocjene i recenzije</strong><p>Recenziju može ostaviti samo klijent kome je posao odrađen. Vidiš portfolio, značke, nivo povjerenja i udio prihvaćenih ponuda.</p></div>
          <div className="info-card"><MessageCircle size={20} /><strong>Komunikacija</strong><p>Od objave do završetka, sve ide kroz Poso.ba. Prihvati ponudu i privatno se dogovori o detaljima.</p></div>
          <div className="info-card"><ShieldCheck size={20} /><strong>Zaštićeni kontakti</strong><p>Broj i email se ne mogu razmijeniti dok ponuda nije prihvaćena — nema neželjenih poziva ni prodaje podataka.</p></div>
          <div className="info-card"><CheckCircle2 size={20} /><strong>Verifikovana struka</strong><p>Majstor šalje dokaz o struci; na profilu jasno piše da li je provjeren i za šta.</p></div>
        </div>
      </section>

      <section className="info-section reveal earn-teaser">
        <div>
          <span className="eyebrow small-eyebrow">Za izvođače</span>
          <h2>Ti biraš poslove, termine i cijenu</h2>
          <p className="muted-text">Vidio si posao koji ti odgovara? Pošalji ponudu. Ne odgovara ti termin? Preskoči. Poso.ba se prilagođava tvom rasporedu, ne obrnuto.</p>
        </div>
        <div className="looking-card-actions">
          <Link to="/zaradi" className="primary-button">Zaradi sa Poso.ba</Link>
          <Link to="/principi-izvodjaca" className="ghost-button">Principi izvođača</Link>
        </div>
      </section>
    </InfoLayout>
  )
}

export default HowItWorksPage
