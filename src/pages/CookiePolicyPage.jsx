import { Link } from 'react-router-dom'
import InfoLayout from '../components/InfoLayout'
import { openConsentSettings } from '../utils/consent'

function CookiePolicyPage() {
  return (
    <InfoLayout
      eyebrow="Pravna obavještenja"
      title="Politika kolačića"
      lead="Šta Zadatak čuva u tvom pregledniku i aplikaciji, zašto, i kako to mijenjaš."
      cta={{ eyebrow: 'Tvoji podaci', text: 'Sve o tome koje podatke čuvamo na serveru piše u Politici privatnosti.', to: '/privatnost', label: 'Politika privatnosti' }}
    >
        <section className="info-section reveal">
          <p className="muted-text">Zadnja izmjena: 30. oktobar 2026.</p>
          <p>
            Zadatak ne koristi reklamne kolačiće, ne prati te po drugim sajtovima i ne prodaje podatke. Umjesto klasičnih
            kolačića sajt i aplikacija koriste memoriju preglednika (local storage i session storage). Za nju važe ista
            pravila kao za kolačiće, pa je ovdje sve opisano zajedno.
          </p>
          <button type="button" className="secondary-button" onClick={openConsentSettings}>Promijeni svoj izbor</button>
        </section>

        <section className="info-section reveal">
          <h2>1. Neophodno (uvijek uključeno)</h2>
          <p>Bez ovoga Zadatak ne radi kako treba, pa za to ne tražimo pristanak.</p>
          <ul className="rules-list">
            <li><strong>Prijava:</strong> da ostaneš prijavljen/a dok se ne odjaviš.</li>
            <li><strong>Nacrti i sačuvani oglasi:</strong> započet oglas i oglasi koje sačuvaš, da ništa ne izgubiš ako zatvoriš stranicu.</li>
            <li><strong>Postavke:</strong> jednostavan način, da li tražiš ili radiš poslove, odluke o obavijestima i dozvolama, i tvoj izbor u ovom baneru.</li>
            <li><strong>Brže otvaranje:</strong> kopija zadnje učitanih podataka i dijelova sajta, da se Zadatak brže otvori i radi uz slab internet.</li>
            <li><strong>Sigurnost:</strong> ograničenje broja pokušaja prijave na ovom uređaju. Na prijavi i registraciji Cloudflare Turnstile (ako je uključen) provjerava da nisi bot.</li>
          </ul>
        </section>

        <section className="info-section reveal">
          <h2>2. Izvještaji o greškama (samo uz pristanak)</h2>
          <p>
            Ako izabereš „Prihvati sve“ ili ovo uključiš u postavkama, kad se na sajtu ili u aplikaciji nešto pokvari,
            servis Sentry dobije opis greške, stranicu na kojoj se desila i vrstu uređaja i preglednika. Ne šaljemo ime,
            email ni sadržaj poruka. Ako izabereš „Samo neophodno“, Sentry se ne učitava.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>3. Servisi drugih firmi</h2>
          <ul className="rules-list">
            <li><strong>Mapa (OpenFreeMap):</strong> dok gledaš mapu, preglednik od njih učitava podloge, pa vide tvoju IP adresu.</li>
            <li><strong>Prijava preko Googlea, Applea ili Facebooka:</strong> ako je koristiš, ti servisi postavljaju svoje kolačiće na svojim stranicama, po svojim pravilima.</li>
          </ul>
        </section>

        <section className="info-section reveal">
          <h2>4. Kako mijenjaš ili brišeš</h2>
          <ul className="rules-list">
            <li>Izbor mijenjaš u bilo kojem trenutku dugmetom „Promijeni svoj izbor“ na ovoj stranici.</li>
            <li>Sve što je sačuvano u pregledniku brišeš u postavkama preglednika (brisanje podataka sajta). Tada se odjavljuješ i gubiš nacrte.</li>
            <li>Kako se brišu podaci na našem serveru piše u <Link to="/privatnost#brisanje-naloga">Politici privatnosti</Link>.</li>
          </ul>
        </section>
    </InfoLayout>
  )
}

export default CookiePolicyPage
