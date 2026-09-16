import { useEffect, useState } from 'react'
import InfoLayout from '../components/InfoLayout'
import { accountService } from '../services/accountService'
import { TierMedal } from './account/TierDashboardPage'

const formatKM = (value) => `${String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} KM`

function TiersInfoPage() {
  const [tiers, setTiers] = useState([])
  useEffect(() => { accountService.listFeeTiers().then(setTiers) }, [])

  return (
    <InfoLayout
      eyebrow="Nivoi izvođača"
      title="Kako funkcionišu nivoi?"
      lead="Nivoi su način da nagradimo vrijedne i pouzdane izvođače: što si aktivniji, to je naknada platforme niža."
      cta={{ eyebrow: 'Kreni', text: 'Prvi završen posao te vodi ka Srebru.', to: '/search', label: 'Pregledaj poslove' }}
    >
      <section className="info-section reveal">
        <h2>Četiri nivoa</h2>
        <p>Bronza, Srebro, Zlato i Platina. Što je nivo viši, naknada koju platforma zadržava od svakog završenog posla je niža.</p>
      </section>
      <section className="info-section reveal">
        <h2>Kako prelazim na viši nivo?</h2>
        <p>Računa se tvoja zarada u zadnjih 30 dana — zbir dogovorenih cijena poslova koje je klijent označio kao završene. Svaki novi završen posao ulazi u zbir i važi narednih 30 dana.</p>
      </section>
      <section className="info-section reveal">
        <h2>Mogu li pasti na niži nivo?</h2>
        <p>Da. Nivo prati zadnjih 30 dana, pa pad aktivnosti spušta nivo. Otkazivanja za koja si ti odgovoran/na smanjuju uspješnost i mogu te zadržati na nižem nivou — pouzdanost shvatamo ozbiljno.</p>
      </section>
      <section className="info-section reveal">
        <h2>Naknade i uslovi po nivou</h2>
        <div className="tier-table">
          {tiers.map((tier, index) => (
            <div className="tier-table-row" key={tier.code}>
              <TierMedal code={tier.code} size={56} />
              <div>
                <strong>{tier.label}</strong>
                <span>{index === 0 ? `Manje od ${formatKM(tiers[1]?.min_30d_km || 0)} zarade u zadnjih 30 dana` : `Zaradi ${formatKM(tier.min_30d_km)}+ u zadnjih 30 dana`}</span>
              </div>
              <b className={index === tiers.length - 1 ? 'best' : ''}>{tier.fee_percent}% naknada</b>
            </div>
          ))}
        </div>
        <p className="muted-text">Naknada se obračunava tek kad plaćanje ide kroz Poso.ba Pay. Do tada je informativna i vidiš je u Historiji plaćanja.</p>
      </section>
    </InfoLayout>
  )
}

export default TiersInfoPage
