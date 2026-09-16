import { Lock } from 'lucide-react'
import BackHome from '../components/BackHome'

function PrivacyPage() {
  return (
    <div className="app-shell page-with-mobile-nav">
      <header className="app-page-header">
        <div>
          <BackHome />
          <span className="eyebrow small-eyebrow">Pravna obavještenja</span>
          <h1>Politika privatnosti</h1>
        </div>
        <Lock size={22} />
      </header>
      <main className="content-container">
        <section className="detail-section">
          <p className="muted-text">
            Ovaj dokument je pripremljen kao standardna polazna osnova u skladu sa Zakonom o zaštiti
            ličnih podataka Bosne i Hercegovine. Prije stvarnog lansiranja platforme preporučuje se
            pravni pregled od strane advokata u BiH, posebno u vezi sa obradom podataka i eventualnim
            prenosom podataka van BiH (npr. korištenje Supabase servera).
          </p>
        </section>

        <section className="detail-section">
          <h2>1. Koje podatke prikupljamo</h2>
          <ul className="rules-list">
            <li>Osnovni podaci naloga: ime i prezime, email, telefon, grad,</li>
            <li>Sadržaj koji sami objavite: oglasi, poruke, recenzije, profilna slika,</li>
            <li>Tehnički podaci: IP adresa i osnovni podaci o korištenju, radi sigurnosti platforme.</li>
          </ul>
        </section>

        <section className="detail-section">
          <h2>2. Kako koristimo podatke</h2>
          <p>
            Podatke koristimo isključivo za pružanje usluge: prikazivanje oglasa, omogućavanje
            komunikacije između korisnika, sigurnost platforme i moderaciju sadržaja. Ne prodajemo
            lične podatke trećim stranama.
          </p>
        </section>

        <section className="detail-section">
          <h2>3. Vaša prava</h2>
          <p>
            U skladu sa važećim propisima, imate pravo na pristup, ispravku i brisanje svojih ličnih
            podataka. Nalog i sve povezane lične podatke možete trajno obrisati u bilo kojem trenutku
            iz postavki profila.
          </p>
        </section>

        <section className="detail-section">
          <h2>4. Kolačići (cookies)</h2>
          <p>
            Koristimo osnovne kolačiće neophodne za rad platforme (npr. održavanje prijave). Ne
            koristimo kolačiće za reklamno praćenje bez vaše saglasnosti.
          </p>
        </section>

        <section className="detail-section">
          <h2>5. Kontakt</h2>
          <p>
            Za pitanja o privatnosti i ličnim podacima, kontaktirajte nas putem chat podrške u donjem
            desnom uglu stranice.
          </p>
        </section>
      </main>
    </div>
  )
}

export default PrivacyPage
