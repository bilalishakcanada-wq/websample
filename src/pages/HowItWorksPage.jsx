import { Link } from 'react-router-dom'
import { Briefcase, CheckCircle2, ClipboardList, Hammer, MessageCircle, Search, ShieldCheck, Star, Wallet } from 'lucide-react'
import BackHome from '../components/BackHome'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'

const CLIENT_STEPS = [
  { icon: ClipboardList, title: 'Opiši šta ti treba', text: 'Naslov, kratak opis, grad i okvirni budžet. Objava traje manje od dvije minute i besplatna je.' },
  { icon: MessageCircle, title: 'Primi ponude', text: 'Izvođači iz tvog grada šalju cijenu i obrazloženje. Vidiš njihove ocjene, značke i portfolio.' },
  { icon: CheckCircle2, title: 'Izaberi i dogovori', text: 'Prihvati ponudu koja ti odgovara. Tek tada se otvara razmjena kontakata i poruka.' },
  { icon: Star, title: 'Ocijeni posao', text: 'Nakon završetka ostavi recenziju — tako sljedeći klijent zna kome može vjerovati.' },
]

const PROVIDER_STEPS = [
  { icon: Hammer, title: 'Napravi profil', text: 'Izaberi svoje struke, dodaj slike radova i pošalji dokaz o struci za oznaku verifikovanog majstora.' },
  { icon: Search, title: 'Pronađi posao', text: 'Pretražuj po gradu i kategoriji, ili pusti da ti "Preporučeno za tebe" izdvoji najbolje poslove.' },
  { icon: Wallet, title: 'Pošalji ponudu', text: 'Napiši cijenu i zašto si pravi izbor. Klijent bira, ti pregovaraš koliko želiš.' },
  { icon: ShieldCheck, title: 'Gradi reputaciju', text: 'Svaki završen posao i dobra ocjena podižu tvoj nivo povjerenja i mjesto u rezultatima.' },
]

function HowItWorksPage() {
  useRevealOnScroll()
  return (
    <div className="app-shell page-with-mobile-nav info-page">
      <header className="app-page-header"><div><BackHome /><span className="eyebrow small-eyebrow">Kako radi</span><h1>Od ideje do završenog posla</h1></div></header>
      <main className="content-container">
        <p className="info-lead">Poso.ba povezuje ljude kojima treba usluga sa provjerenim izvođačima u njihovom gradu. Evo kako izgleda s obje strane.</p>

        <section className="info-section reveal">
          <div className="info-section-head">
            <Briefcase size={22} />
            <div><h2>Trebam uslugu</h2><p>Za klijente koji objavljuju posao.</p></div>
          </div>
          <ol className="steps-timeline">
            {CLIENT_STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title}><span className="step-index">{index + 1}</span><div><Icon size={20} /><strong>{title}</strong><p>{text}</p></div></li>
            ))}
          </ol>
          <Link to="/objavi" className="primary-button">Objavi posao besplatno</Link>
        </section>

        <section className="info-section reveal">
          <div className="info-section-head">
            <Hammer size={22} />
            <div><h2>Pružam usluge</h2><p>Za majstore i izvođače koji traže posao.</p></div>
          </div>
          <ol className="steps-timeline">
            {PROVIDER_STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title}><span className="step-index">{index + 1}</span><div><Icon size={20} /><strong>{title}</strong><p>{text}</p></div></li>
            ))}
          </ol>
          <Link to="/zaradi" className="primary-button">Postani izvođač</Link>
        </section>

        <section className="info-section reveal">
          <h2>Šta te štiti</h2>
          <div className="info-grid">
            <div className="info-card"><ShieldCheck size={20} /><strong>Zaštićeni kontakti</strong><p>Broj telefona i email se ne mogu razmijeniti dok ponuda nije prihvaćena — bez neželjenih poziva.</p></div>
            <div className="info-card"><Star size={20} /><strong>Ocjene iz stvarnih poslova</strong><p>Recenziju može ostaviti samo klijent kome je posao odrađen.</p></div>
            <div className="info-card"><CheckCircle2 size={20} /><strong>Verifikovani majstori</strong><p>Izvođači šalju dokaz o struci, a na profilu jasno piše da li je provjeren.</p></div>
          </div>
        </section>

        <section className="cta-strip reveal">
          <div><span className="eyebrow small-eyebrow">Još pitanja?</span><h2>Pogledaj centar za pomoć ili nam piši.</h2></div>
          <Link to="/pomoc" className="primary-button">Centar za pomoć</Link>
        </section>
      </main>
    </div>
  )
}

export default HowItWorksPage
