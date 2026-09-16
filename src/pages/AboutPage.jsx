import { HeartHandshake, MapPin, ShieldCheck, Sparkles, Users } from 'lucide-react'
import BackHome from '../components/BackHome'

function AboutPage() {
  return (
    <div className="app-shell page-with-mobile-nav">
      <header className="app-page-header">
        <div>
          <BackHome />
          <span className="eyebrow small-eyebrow">Naša priča</span>
          <h1>O nama</h1>
        </div>
        <HeartHandshake size={22} />
      </header>
      <main className="content-container">
        <section className="detail-section">
          <h2>Ko smo mi</h2>
          <p>
            Poso.ba je domaća platforma napravljena da olakša svakodnevni život ljudima u Bosni i
            Hercegovini — bilo da vam treba majstor, IT podrška, čišćenje, selidba ili bilo koja
            druga usluga, ili ste vi ta osoba koja nudi svoje znanje i vrijeme. Vjerujemo da lokalni
            talenat zaslužuje jednostavan, siguran i pošten način da dođe do posla.
          </p>
        </section>

        <section className="detail-section">
          <h2>Zašto Poso.ba</h2>
          <div className="about-grid">
            <div className="about-item">
              <MapPin size={22} />
              <h3>Lokalno i domaće</h3>
              <p>Napravljeno za Bosnu i Hercegovinu, na bosanskom jeziku, sa domaćim gradovima i valutom (KM).</p>
            </div>
            <div className="about-item">
              <ShieldCheck size={22} />
              <h3>Sigurnost prije svega</h3>
              <p>Automatska moderacija sadržaja, prijava neprimjerenih oglasa i tim koji pregleda svaku prijavu.</p>
            </div>
            <div className="about-item">
              <Users size={22} />
              <h3>Zajednica sa recenzijama</h3>
              <p>Svaki korisnik ima javni profil sa ocjenama, tako da znate s kim poslujete.</p>
            </div>
            <div className="about-item">
              <Sparkles size={22} />
              <h3>Jednostavno korištenje</h3>
              <p>Objavite posao ili pronađite uslugu za par minuta — bez komplikacija.</p>
            </div>
          </div>
        </section>

        <section className="detail-section">
          <h2>Naša misija</h2>
          <p>
            Želimo da svaka opština u Bosni i Hercegovini ima pristup provjerenim, pouzdanim
            izvođačima usluga — i da svako ko nudi svoje umijeće ima pošten i transparentan način
            da dođe do klijenata, bez posrednika i skrivenih troškova.
          </p>
        </section>

        <section className="detail-section">
          <h2>Kontakt</h2>
          <p>
            Imate pitanje, prijedlog ili problem? Javite nam se putem chat podrške (donji desni
            ugao stranice) — naš tim odgovara u najkraćem mogućem roku.
          </p>
        </section>
      </main>
    </div>
  )
}

export default AboutPage
