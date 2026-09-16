import { Award, Clock, MessageSquare, ShieldCheck, Target, Wrench } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'

const PRINCIPLES = [
  { icon: Target, title: 'Nudi samo ono što znaš', text: 'Ponudu šalji za poslove u svojoj struci. Bolje jedna dobra ponuda nego pet nasumičnih — klijenti to vide, a algoritam nagrađuje prihvaćene ponude.' },
  { icon: MessageSquare, title: 'Piši jasno i konkretno', text: 'U ponudi navedi šta tačno radiš, šta je uključeno u cijenu i kad možeš. Ponude sa obrazloženjem se prihvataju višestruko češće od golih cijena.' },
  { icon: Clock, title: 'Odgovaraj brzo, pojavljuj se na vrijeme', text: 'Klijent koji čeka dan na odgovor bira drugog. Odgovor u roku sat vremena donosi značku "Brz odgovor".' },
  { icon: Wrench, title: 'Uradi kako si rekao', text: 'Cijena i obim iz ponude su dogovor. Ako se nešto promijeni na terenu — reci odmah, prije nego što nastaviš.' },
  { icon: ShieldCheck, title: 'Verifikuj se', text: 'Diploma, uvjerenje ili licenca daju ti oznaku "Verifikovan majstor" za tvoju struku. Bez toga ostaješ na nivou "Nije verifikovan" bez obzira na ocjene.' },
  { icon: Award, title: 'Gradi reputaciju, ne prečice', text: 'Svaki završen posao i poštena recenzija podižu nivo povjerenja: Verifikovan → Pouzdan → Top majstor. Lažne recenzije ga ruše na nulu.' },
]

function ProviderPrinciplesPage() {
  return (
    <InfoLayout
      eyebrow="Principi izvođača"
      title="Šta klijent može očekivati od svakog majstora"
      lead="Ovih šest principa prihvata svaki izvođač na Poso.ba. Nisu pravila kažnjavanja — to je standard po kojem te klijenti biraju i po kojem te platforma rangira."
      cta={{ eyebrow: 'Spreman za posao?', text: 'Napravi profil izvođača i pošalji prvu ponudu danas.', to: '/zaradi', label: 'Postani izvođač' }}
    >
      <section className="info-grid reveal-stagger reveal">
        {PRINCIPLES.map(({ icon: Icon, title, text }) => (
          <div className="info-card" key={title}><Icon size={20} /><strong>{title}</strong><p>{text}</p></div>
        ))}
      </section>

      <section className="info-section reveal">
        <h2>Kako platforma prepoznaje dobrog izvođača</h2>
        <p className="muted-text">Nema skrivenih pravila. Rang u rezultatima i preporukama računa se iz ovih signala, i svaki od njih vidiš na svom profilu:</p>
        <ul className="check-list">
          <li><strong>Verifikacija struke</strong> — najveći pojedinačni faktor.</li>
          <li><strong>Prosjek ocjena</strong> — sa "ublažavanjem" za mali broj recenzija, pa jedna petica ne preskače nekog sa pedeset.</li>
          <li><strong>Udio prihvaćenih ponuda</strong> — pokazuje da nudiš realno i tamo gdje znaš.</li>
          <li><strong>Portfolio i aktivnost</strong> — slike radova i redovno javljanje.</li>
          <li><strong>Grad</strong> — klijenti prvo vide majstore iz svog grada.</li>
        </ul>
      </section>
    </InfoLayout>
  )
}

export default ProviderPrinciplesPage
