import { Check, Info } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'
import { mockPlans } from '../data/mockData'

const FREE_FOREVER = [
  'Objava neograničenog broja poslova',
  'Primanje i slanje ponuda',
  'Javni profil sa ocjenama i portfoliom',
  'Poruke nakon prihvaćene ponude',
  'Verifikacija struke i značke',
  'Preporuke poslova i izvođača',
]

function PricingPage() {
  return (
    <InfoLayout
      eyebrow="Planovi i cijene"
      title="Osnovno je besplatno. Zauvijek."
      lead="Poso.ba ne naplaćuje objavu posla, slanje ponuda ni komunikaciju. Planovi ispod dodaju vidljivost onima koji je žele više — i uskoro će biti dostupni za aktivaciju."
      cta={{ eyebrow: 'Spreman?', text: 'Objavi posao ili napravi profil — bez kartice.', to: '/register', label: 'Napravi nalog' }}
    >
      <section className="info-section reveal">
        <h2>Šta je uvijek besplatno</h2>
        <ul className="check-list">
          {FREE_FOREVER.map((item) => <li key={item}><Check size={16} /> {item}</li>)}
        </ul>
      </section>

      <div className="info-note"><Info size={16} /> Plaćanje unutar platforme još nije aktivno. Planove ispod možeš pogledati, a aktivaciju najavljujemo svim korisnicima emailom.</div>

      <section className="plans-grid reveal-stagger reveal">
        {mockPlans.map((plan) => (
          <div key={plan.id} className={`plan-card ${plan.featured ? 'featured' : ''}`}>
            {plan.featured && <span className="plan-badge">Najpopularnije</span>}
            <div className="plan-header">
              <h3>{plan.name}</h3>
              <div className="plan-price"><span>{plan.price}</span>{plan.suffix && <small>{plan.suffix}</small>}</div>
            </div>
            <p>{plan.description}</p>
            <ul>{plan.perks.map((perk) => <li key={perk}><Check size={15} /> {perk}</li>)}</ul>
            <span className="plan-soon">{plan.price === '0' ? 'Aktivan za sve' : 'Uskoro dostupno'}</span>
          </div>
        ))}
      </section>

      <section className="info-section reveal">
        <h2>Česta pitanja o cijenama</h2>
        <dl className="qa-list">
          <div><dt>Da li klijent plaća proviziju?</dt><dd>Ne. Cijenu dogovaraš direktno sa izvođačem kroz ponudu; Poso.ba ne uzima dio.</dd></div>
          <div><dt>Da li izvođač plaća da bi slao ponude?</dt><dd>Ne. Slanje ponuda je besplatno i neograničeno.</dd></div>
          <div><dt>Šta onda planovi donose?</dt><dd>Više vidljivosti: istaknute oglase i profile, više sačuvanih poslova, prioritet u podršci. Ništa od osnovnih funkcija nije zaključano.</dd></div>
          <div><dt>Kako će se plaćati kad plaćanje krene?</dt><dd>Karticom ili kreditima, uz jasnu cijenu prije potvrde i mogućnost otkazivanja u bilo kom trenutku.</dd></div>
        </dl>
      </section>
    </InfoLayout>
  )
}

export default PricingPage
