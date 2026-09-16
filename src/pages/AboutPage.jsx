import { Link } from 'react-router-dom'
import { MapPin, ShieldCheck, Sparkles, Users } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'

function AboutPage() {
  return (
    <InfoLayout
      eyebrow="Naša priča"
      title="Domaća platforma za usluge, napravljena za BiH"
      lead="Poso.ba postoji da bi svako ko traži majstora, IT pomoć, čišćenje ili selidbu našao provjerenu osobu u svom gradu — i da bi svako ko nudi svoje umijeće imao pošten put do klijenata, bez posrednika."
      cta={{ eyebrow: 'Pridruži se', text: 'Objavi posao ili napravi profil izvođača — traje minutu.', to: '/register', label: 'Napravi nalog' }}
    >
      <section className="info-section reveal">
        <h2>Zašto smo ovo napravili</h2>
        <p>
          Kad ti u BiH treba majstor, tražiš preporuku po grupama i poznanicima, zoveš tri broja i nadaš se da će neko doći.
          Kad si majstor, čekaš da te neko preporuči. Htjeli smo mjesto gdje se ta dva svijeta sretnu na jednom ekranu —
          sa stvarnim ocjenama, verifikovanom strukom i cijenom koju vidiš prije nego pozoveš.
        </p>
      </section>

      <section className="info-grid reveal-stagger reveal">
        <div className="info-card"><MapPin size={20} /><strong>Lokalno i domaće</strong><p>Bosanski jezik, domaći gradovi, cijene u KM. Napravljeno ovdje, za ovdje.</p></div>
        <div className="info-card"><ShieldCheck size={20} /><strong>Povjerenje se mjeri</strong><p>Verifikacija struke, Bayesov prosjek ocjena i pet nivoa povjerenja — ne sudimo po jednoj recenziji.</p></div>
        <div className="info-card"><Users size={20} /><strong>Zajednica sa pravilima</strong><p>Zaštićeni kontakti do prihvaćene ponude, moderacija oglasa i tim koji čita svaku prijavu.</p></div>
        <div className="info-card"><Sparkles size={20} /><strong>Bez skrivenih troškova</strong><p>Objava, ponude i poruke su besplatni. Nema provizije na dogovorenu cijenu.</p></div>
      </section>

      <section className="info-section reveal">
        <h2>Kako to izgleda u brojkama</h2>
        <p className="muted-text">Sve što vidiš na platformi računa se iz stvarnih podataka, ne iz procjena:</p>
        <ul className="check-list">
          <li><Link to="/vodici">Vodiči za cijene</Link> nastaju iz objavljenih oglasa — što ih je više, to je slika tačnija.</li>
          <li><Link to="/principi-izvodjaca">Nivo povjerenja</Link> svakog majstora izvodi se iz verifikacije, ocjena, prihvaćenih ponuda i aktivnosti.</li>
          <li>Preporuke poslova i izvođača uzimaju u obzir grad, struku i istoriju — i objašnjavaju zašto su baš to predložile.</li>
        </ul>
      </section>

      <section className="info-section reveal">
        <h2>Kuda idemo</h2>
        <p>
          Sljedeće što stiže: plaćanje unutar platforme (novac stoji sigurno dok posao nije gotov), planovi za veću vidljivost,
          i podrška za firme koje redovno trebaju izvođače u više gradova. Sve najavljujemo emailom prije nego što krene.
        </p>
      </section>
    </InfoLayout>
  )
}

export default AboutPage
