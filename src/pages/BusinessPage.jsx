import { Link } from 'react-router-dom'
import { Building2, ClipboardList, Clock, ShieldCheck, Users } from 'lucide-react'
import BackHome from '../components/BackHome'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'

function BusinessPage() {
  useRevealOnScroll()
  return (
    <div className="app-shell page-with-mobile-nav info-page">
      <header className="app-page-header"><div><BackHome /><span className="eyebrow small-eyebrow">Poso.ba za firme</span><h1>Radna snaga na zahtjev, bez zapošljavanja</h1></div></header>
      <main className="content-container">
        <p className="info-lead">Kancelarija, lokal, magacin ili više lokacija — objavi šta treba i dobij ponude provjerenih izvođača iz grada u kom radiš. Isti nalog, isti proces, samo više poslova.</p>

        <section className="info-grid reveal">
          <div className="info-card"><Clock size={20} /><strong>Brzo popunjavanje</strong><p>Selidba kancelarije, montaža, čišćenje nakon renoviranja — ponude stižu isti dan.</p></div>
          <div className="info-card"><Users size={20} /><strong>Više gradova, jedan nalog</strong><p>Objavi poslove za Sarajevo, Tuzlu i Mostar odjednom; svaki vidi lokalne majstore.</p></div>
          <div className="info-card"><ShieldCheck size={20} /><strong>Verifikovani izvođači</strong><p>Filtriraj po nivou povjerenja i struci — vidiš ko je provjeren prije nego prihvatiš ponudu.</p></div>
          <div className="info-card"><ClipboardList size={20} /><strong>Sve na jednom mjestu</strong><p>Nadzorna ploča drži svaki oglas, ponudu i poruku — bez tabela i emailova.</p></div>
        </section>

        <section className="info-section reveal">
          <div className="info-section-head"><Building2 size={22} /><div><h2>Kako početi</h2><p>Nema posebnog "biznis" naloga — isti nalog, isti alati.</p></div></div>
          <ol className="steps-timeline">
            <li><span className="step-index">1</span><div><strong>Registruj se kao "Tražim majstora"</strong><p>Ime firme upiši kao ime i prezime — tako ga vide izvođači.</p></div></li>
            <li><span className="step-index">2</span><div><strong>Objavi prvi posao</strong><p>Što precizniji opis i budžet, to bolje ponude.</p></div></li>
            <li><span className="step-index">3</span><div><strong>Za veći obim — javi nam se</strong><p>Za redovne potrebe (više lokacija, ponavljajući poslovi) dogovaramo direktnu podršku.</p></div></li>
          </ol>
          <div className="looking-card-actions">
            <Link to="/register" className="primary-button">Napravi nalog</Link>
            <Link to="/pomoc?tema=business#kontakt" className="ghost-button">Kontaktiraj nas</Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default BusinessPage
