import InfoLayout from '../components/InfoLayout'

function RulesPage() {
  return (
    <InfoLayout
      eyebrow="Pravna obavještenja"
      title="Uslovi korištenja"
      lead="Pravila po kojima radi Poso.ba. Kratko, jasno i bez sitnih slova — ako nešto nije jasno, piši nam."
      cta={{ eyebrow: 'Pitanje?', text: 'Nejasan ti je neki uslov? Objasnit ćemo.', to: '/kontakt?tema=account', label: 'Kontakt' }}
    >
        <section className="info-section reveal">
          <h2>1. Opšta pravila</h2>
          <p>
            Poso.ba je platforma koja povezuje korisnike koji traže usluge sa lokalnim izvođačima
            u Bosni i Hercegovini. Registracijom prihvatate da ćete koristiti platformu odgovorno,
            u skladu sa zakonima Bosne i Hercegovine i ovim pravilima.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>2. Zabranjen sadržaj</h2>
          <p>Strogo je zabranjeno objavljivanje oglasa, poruka ili profila koji sadrže ili promovišu:</p>
          <ul className="rules-list">
            <li>vatreno oružje, municiju, eksploziv ili bilo koji drugi oblik naoružanja,</li>
            <li>droge, narkotike ili bilo koje ilegalne supstance,</li>
            <li>ukradenu robu ili krivotvorene proizvode,</li>
            <li>sadržaj koji podstiče nasilje, mržnju ili diskriminaciju,</li>
            <li>usluge koje krše važeće zakone Bosne i Hercegovine.</li>
          </ul>
          <p>
            Svi oglasi se automatski provjeravaju sistemom za moderaciju prije objave, a dodatno se
            mogu prijaviti od strane zajednice i pregledati od strane administratora. Nalozi koji krše
            ova pravila bivaju trajno suspendovani.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>3. Prijava neprimjerenog sadržaja</h2>
          <p>
            Ako naiđete na oglas ili korisnika koji krši ova pravila, molimo prijavite ga putem dugmeta
            za prijavu na oglasu ili kontaktirajte podršku putem chat-a u donjem desnom uglu.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>4. Plaćanja</h2>
          <p>
            Sistem pretplata i kredita je pripremljen za buduću integraciju sa provajderom plaćanja.
            Trenutno se naplata ne vrši. Kada plaćanje bude aktivirano, uslovi naplate biće jasno
            prikazani prije svake transakcije.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>5. Brisanje naloga</h2>
          <p>
            Svoj nalog možete obrisati u bilo kojem trenutku iz postavki profila. Brisanjem naloga
            uklanjaju se vaši lični podaci u skladu sa važećim propisima o zaštiti podataka.
          </p>
        </section>
    </InfoLayout>
  )
}

export default RulesPage
