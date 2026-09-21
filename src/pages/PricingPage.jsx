import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Info } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'
import { TierMedal } from './account/TierDashboardPage'
import { accountService } from '../services/accountService'

const FREE_FOREVER = [
  'Objava neograničenog broja poslova',
  'Primanje i slanje ponuda',
  'Javni profil sa ocjenama i portfoliom',
  'Poruke nakon prihvaćene ponude',
  'Verifikacija struke i značke',
  'Preporuke poslova i izvođača',
]

// fallback while the levels load (the same numbers live in the fee_tiers table)
const DEFAULT_TIERS = [
  { code: 'bronze', label: 'Bronza', min_30d_km: 0, fee_percent: 15 },
  { code: 'silver', label: 'Srebro', min_30d_km: 500, fee_percent: 13 },
  { code: 'gold', label: 'Zlato', min_30d_km: 1500, fee_percent: 11 },
  { code: 'platinum', label: 'Platina', min_30d_km: 3000, fee_percent: 9 },
]

function PricingPage() {
  const [tiers, setTiers] = useState(DEFAULT_TIERS)
  useEffect(() => { accountService.listFeeTiers().then((rows) => rows?.length && setTiers(rows)).catch(() => {}) }, [])

  return (
    <InfoLayout
      eyebrow="Cijene"
      title="Za klijente besplatno. Izvođač plaća samo kad je posao plaćen."
      lead="Poso.ba ne naplaćuje objavu posla, slanje ponuda ni komunikaciju. Jedina naknada je postotak koji platforma zadrži od plaćenog posla — i ona pada kako izvođač radi više."
      cta={{ eyebrow: 'Spreman?', text: 'Objavi posao ili napravi profil — bez kartice.', to: '/register', label: 'Napravi nalog' }}
    >
      <section className="info-section reveal">
        <h2>Šta je uvijek besplatno</h2>
        <ul className="check-list">
          {FREE_FOREVER.map((item) => <li key={item}><Check size={16} /> {item}</li>)}
        </ul>
      </section>

      <section className="info-section reveal">
        <h2>Naknada za izvođače — po nivou</h2>
        <p>Naknada se obračunava samo kad klijent oslobodi uplatu za završen posao. Nivo se računa iz prometa u zadnjih 30 dana i raste automatski.</p>
        <div className="tier-table">
          {tiers.map((tier, index) => (
            <div key={tier.code} className="tier-table-row">
              <TierMedal code={tier.code} size={44} />
              <div>
                <strong>{tier.label}</strong>
                <span>{Number(tier.min_30d_km) === 0 ? 'Početni nivo' : `Od ${Number(tier.min_30d_km).toLocaleString('bs-BA')} KM prometa u zadnjih 30 dana`}</span>
              </div>
              <b className={index === tiers.length - 1 ? 'best' : ''}>{tier.fee_percent}% naknada</b>
            </div>
          ))}
        </div>
        <p className="muted-text">Primjer: posao od 200 KM na nivou Bronza — klijent plaća 200 KM, izvođaču na Balans sjeda 170 KM. <Link to="/nivoi">Detalji o nivoima →</Link></p>
      </section>

      <section className="info-section reveal">
        <h2>Kako ide plaćanje</h2>
        <ol className="steps-list">
          <li><strong>Klijent prihvati ponudu</strong> — iznos se rezerviše sa njegovog Balansa i čuva na Poso.ba.</li>
          <li><strong>Posao se uradi</strong> — izvođač zatraži isplatu, klijent potvrdi.</li>
          <li><strong>Novac se oslobađa</strong> — zarada bez naknade sjeda izvođaču na Balans; historija je vidljiva obojici.</li>
        </ol>
        <div className="info-note"><Info size={16} /> Uplata karticom na Balans i isplata na bankovni račun stižu s procesorom plaćanja; do tada se uplata i isplata dogovaraju s timom.</div>
      </section>

      <section className="info-section reveal">
        <h2>Česta pitanja o cijenama</h2>
        <dl className="qa-list">
          <div><dt>Da li klijent plaća proviziju?</dt><dd>Ne. Klijent plaća tačno iznos ponude koju je prihvatio — ništa više.</dd></div>
          <div><dt>Da li izvođač plaća da bi slao ponude?</dt><dd>Ne. Slanje ponuda je besplatno i neograničeno. Naknada postoji samo na plaćenom poslu.</dd></div>
          <div><dt>Šta ako se posao otkaže?</dt><dd>Ako se otkaže prije početka, rezervisani iznos se vraća klijentu na Balans u cijelosti.</dd></div>
          <div><dt>Hoće li biti pretplata ili istaknutih oglasa?</dt><dd>Planiramo istaknute oglase i profile kao opciju. Ništa od osnovnih funkcija neće biti zaključano.</dd></div>
        </dl>
      </section>
    </InfoLayout>
  )
}

export default PricingPage
