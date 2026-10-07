import { Link } from 'react-router-dom'
import InfoLayout from '../components/InfoLayout'

function RulesPage() {
  return (
    <InfoLayout
      eyebrow="Pravna obavještenja"
      title="Uslovi korištenja"
      lead="Pravila po kojima radi Zadatak. Kratko, jasno i bez sitnih slova — ako nešto nije jasno, piši nam."
      cta={{ eyebrow: 'Pitanje?', text: 'Nejasan ti je neki uslov? Objasnit ćemo.', to: '/kontakt?tema=account', label: 'Kontakt' }}
    >
        <section className="info-section reveal">
          <p className="muted-text">Zadnja izmjena: 7. oktobar 2026.</p>
          <h2>1. Šta je Zadatak</h2>
          <p>
            Zadatak je platforma koja povezuje ljude kojima treba neki posao (klijente) sa izvođačima u Bosni i Hercegovini.
            Dogovor o samom poslu sklapaju klijent i izvođač; Zadatak nije strana u tom dogovoru, ali čuva uplatu dok posao
            nije gotov i pomaže kad nešto krene po zlu. Registracijom prihvataš ove uslove i <Link to="/privatnost">Politiku privatnosti</Link>.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>2. Nalog</h2>
          <ul className="rules-list">
            <li>Zadatak smiju koristiti osobe od 18 godina i starije, svaka sa jednim nalogom na svoje ime i sa tačnim podacima.</li>
            <li>Za tvoj nalog i sve što se s njim uradi odgovaraš ti. Lozinku ne dijeli ni s kim; ako sumnjaš da ju je neko saznao, odmah je promijeni i javi nam.</li>
            <li>Za objavu posla, slanje ponuda i isplatu možemo tražiti provjeru identiteta (lična karta ili pasoš).</li>
          </ul>
        </section>

        <section className="info-section reveal">
          <h2>3. Zabranjen sadržaj i ponašanje</h2>
          <p>Zabranjeno je objavljivati oglase, poruke ili profile koji sadrže ili promovišu:</p>
          <ul className="rules-list">
            <li>vatreno oružje, municiju, eksploziv ili bilo koji drugi oblik naoružanja,</li>
            <li>droge, narkotike ili bilo koje ilegalne supstance,</li>
            <li>ukradenu robu ili krivotvorene proizvode,</li>
            <li>sadržaj koji podstiče nasilje, mržnju ili diskriminaciju, uznemiravanje ili prijetnje,</li>
            <li>usluge koje krše važeće zakone Bosne i Hercegovine,</li>
            <li>lažne profile, lažne recenzije i pokušaje prevare.</li>
          </ul>
          <p>
            Dogovor i plaćanje idu kroz Zadatak. Dijeljenje telefona, emaila ili društvenih mreža prije prihvaćene ponude i
            pokušaj plaćanja mimo platforme nisu dozvoljeni. Slike i tekst automatski provjeravamo, korisnici mogu prijaviti
            sporan sadržaj, a tim pregleda svaku prijavu. Kršenje pravila donosi upozorenje; nakon tri upozorenja nalog se
            privremeno suspenduje, a za teža kršenja trajno zatvara. Više u <Link to="/pravila-zajednice">Pravilima zajednice</Link>.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>4. Prijava neprimjerenog sadržaja</h2>
          <p>
            Ako naiđeš na oglas, profil ili razgovor koji krši ova pravila, prijavi ga dugmetom „Prijavi“ na oglasu, profilu
            ili u razgovoru, ili piši podršci u chatu dolje desno. Svaku prijavu pregleda Zadatak tim.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>5. Plaćanje i naknade</h2>
          <ul className="rules-list">
            <li>Objava posla, slanje ponuda i poruke su besplatni.</li>
            <li>Kad klijent prihvati ponudu, cijena se rezerviše s njegovog Balansa i čuva na platformi dok posao nije gotov. Kad klijent potvrdi da je posao urađen, novac ide izvođaču, umanjen za naknadu platforme.</li>
            <li>Naknadu plaća izvođač, samo za plaćen i završen posao, prema nivou u zadnjih 30 dana: Bronza 15 %, Srebro 13 %, Zlato 11 %, Platina 9 %. Obje strane vide iznos prije prihvatanja, a procenat se zaključava u trenutku prihvatanja. Detalji su na stranici <Link to="/cijene">Planovi i cijene</Link>.</li>
            <li>Izdvajanje oglasa je dobrovoljno i plaća se s Balansa prije početka: „Hitno“ 5 KM za 3 dana, „VIP“ 15 KM za 7 dana.</li>
            <li>Balans se puni uplatom na račun Zadatka (i karticom, kad se to uključi). Isplatiti se može samo zarada od poslova, nakon provjere identiteta, i to samo na račun koji glasi na tvoje ime.</li>
          </ul>
        </section>

        <section className="info-section reveal">
          <h2>6. Otkazivanje i sporovi</h2>
          <ul className="rules-list">
            <li>U prvom satu nakon prihvatanja ponude posao se može prekinuti bez naknade.</li>
            <li>Kasnije strana koja je odgovorna za prekid plaća naknadu od 10 % cijene, najviše 50 KM. Izvođaču se takav prekid računa kao neuspješan posao.</li>
            <li>Ako se ne slažete oko posla ili plaćanja, „Prijavi problem“ zamrzava uplatu dok Zadatak tim ne odluči na osnovu poruka, slika i dokaza rada. Odluka tima o raspodjeli zamrznute uplate je konačna na platformi; to ne ograničava tvoja zakonska prava.</li>
          </ul>
        </section>

        <section className="info-section reveal">
          <h2>7. Odgovornost</h2>
          <p>
            Izvođač odgovara za kvalitet i sigurnost svog rada, za dozvole koje posao traži i za svoje poreze. Klijent odgovara za tačan opis
            posla i za siguran pristup mjestu rada. Zadatak provjerava identitet i prati prevare, ali ne garantuje za rad pojedinog izvođača.
            Naša odgovornost prema tebi ograničena je na iznos naknada koje si platio Zadatku u zadnjih 12 mjeseci, osim tamo gdje zakon
            to ne dozvoljava.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>8. Tvoj sadržaj</h2>
          <p>
            Sadržaj koji objaviš (oglasi, slike, opis profila, recenzije) ostaje tvoj. Objavom nam daješ dozvolu da ga prikazujemo na
            Zadatku dok je objavljen. Recenzije moraju biti iskrene i o stvarnom poslu.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>9. Brisanje naloga</h2>
          <p>
            Nalog možeš obrisati u bilo kojem trenutku u <Link to="/account/profil">Moj nalog → Profil</Link>. Šta se tada briše piše u{' '}
            <Link to="/privatnost#brisanje-naloga">Politici privatnosti</Link>. Nalog koji krši ova pravila možemo suspendovati ili zatvoriti;
            novac koji ti pripada tada isplaćujemo nakon provjere identiteta.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>10. Izmjene i pravo</h2>
          <p>
            O većim izmjenama ovih uslova javljamo emailom ili obaviještenjem u aplikaciji prije nego što počnu važiti. Na ove uslove
            primjenjuje se pravo Bosne i Hercegovine.
          </p>
        </section>
    </InfoLayout>
  )
}

export default RulesPage
