import { Link } from 'react-router-dom'
import InfoLayout from '../components/InfoLayout'

function PrivacyPage() {
  return (
    <InfoLayout
      eyebrow="Pravna obavještenja"
      title="Politika privatnosti"
      lead="Koje podatke čuvamo, zašto, ko ih još vidi, koliko dugo ih držimo i kako ih brišeš."
      cta={{ eyebrow: 'Tvoji podaci', text: 'Nalog i sve lične podatke brišeš sam, u postavkama profila.', to: '/account/profil', label: 'Postavke profila' }}
    >
        <section className="info-section reveal">
          <p className="muted-text">Zadnja izmjena: 7. oktobar 2026.</p>
          <p>
            Platformu Zadatak vodi Zadatak tim (u nastavku: „mi“). Odgovorni smo za podatke koje nam daješ dok koristiš
            Zadatak na sajtu i u aplikaciji za Android i iPhone. Za sve u vezi s tvojim podacima piši nam preko
            stranice <Link to="/kontakt">Kontakt</Link> ili u chatu podrške.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>1. Koje podatke prikupljamo</h2>
          <ul className="rules-list">
            <li><strong>Nalog:</strong> ime i prezime, email, telefon (ako ga upišeš), grad, vrsta naloga i struke. Lozinku čuvamo samo kao bcrypt heš, nikad u čitljivom obliku. Ako se prijaviš preko Googlea, Applea ili Facebooka, od njih dobijamo ime, email i sliku profila.</li>
            <li><strong>Profil:</strong> profilna slika, opis, iskustvo, portfolio (slike i video), značke, licence i potvrde koje pošalješ.</li>
            <li><strong>Provjera identiteta:</strong> slike lične karte ili pasoša koje pošalješ. Čuvaju se u zatvorenom spremištu i vidi ih samo tim koji radi provjeru.</li>
            <li><strong>Poslovi i komunikacija:</strong> oglasi (opis, slike, mjesto i adresa posla, budžet, rok), ponude, pitanja, poruke i slike u porukama, recenzije, prijave i sporovi.</li>
            <li><strong>Lokacija:</strong> mjesto posla koje upišeš. Kad izvođač uključi „Krećem“, njegova lokacija uživo dok ne stigne (vidi je samo klijent tog posla). Mjesto i vrijeme utisnuti na foto-dokaz urađenog posla. Lokaciju ne pratimo u pozadini.</li>
            <li><strong>Plaćanja:</strong> stanje Balansa, uplate, rezervisani iznosi, naknade i isplate. Za isplatu: ime vlasnika računa, banka i IBAN. Podatke s kartice prima direktno procesor plaćanja; mi ih ne vidimo.</li>
            <li><strong>Tehnički i sigurnosni podaci:</strong> IP adresa, vrsta uređaja i preglednika, vrijeme prijave, zapisi o radnjama važnim za sigurnost (pokušaji prijave, prijave sadržaja, upozorenja) i podaci za obavijesti na tvom uređaju.</li>
            <li><strong>Na tvom uređaju:</strong> preglednik i aplikacija čuvaju prijavu i dio podataka da se Zadatak brže otvori. Ne koristimo reklamne kolačiće niti praćenje za oglašavanje.</li>
          </ul>
        </section>

        <section className="info-section reveal">
          <h2>2. Zašto ih koristimo</h2>
          <ul className="rules-list">
            <li><strong>Da usluga radi:</strong> nalog, objava i pretraga poslova, ponude, poruke, osigurano plaćanje kroz platformu i isplate.</li>
            <li><strong>Sigurnost i zaštita od prevara:</strong> provjera identiteta, otkrivanje lažnih profila i sumnjivih poruka, moderacija slika i teksta, rješavanje sporova, ograničenje pokušaja prijave.</li>
            <li><strong>Zakonske obaveze:</strong> evidencija plaćanja i odgovori na zakonite zahtjeve nadležnih organa.</li>
            <li><strong>Obavijesti:</strong> email i obavijesti na uređaju o tvojim poslovima, ponudama i porukama. Koje primaš biraš u postavkama obavijesti. Reklamne poruke ne šaljemo bez tvog pristanka.</li>
          </ul>
          <p>Podatke ne prodajemo i ne koristimo ih za reklame.</p>
        </section>

        <section className="info-section reveal">
          <h2>3. Ko još vidi tvoje podatke</h2>
          <ul className="rules-list">
            <li><strong>Drugi korisnici</strong> vide tvoj javni profil (ime, grad, opis, struke, značke, ocjene, portfolio) i tvoje oglase. Vlasnik posla vidi tvoju ponudu. Telefon i ostali kontakti dijele se tek nakon prihvaćene ponude, i to samo s osobom s kojom radiš posao.</li>
            <li><strong>Zadatak tim</strong> (administratori i moderatori) vidi samo ono što treba za podršku, provjeru identiteta, moderaciju i sporove. Radnje tima se bilježe.</li>
            <li><strong>Servisi koji rade za nas</strong>, samo za svrhe iz ove politike:
              <ul>
                <li>Supabase: baza podataka, prijava i spremište fajlova (serveri u Frankfurtu, EU).</li>
                <li>GitHub: smještaj sajta (vidi IP adresu posjetilaca).</li>
                <li>Anthropic: automatska provjera slika, procjena rizika profila i odgovori asistenta u podršci (SAD). Podatke ne koristi za treniranje svojih modela.</li>
                <li>Google, Apple i Facebook: prijava preko njihovog računa, ako je koristiš. Google i Apple dostavljaju i obavijesti na telefon.</li>
                <li>OpenFreeMap: podloge za mapu (vidi IP adresu).</li>
                <li>Procesor plaćanja karticama, kad se plaćanje karticom uključi.</li>
                <li>Telegram i Resend: obavijesti timu o novim prijavama i zahtjevima.</li>
                <li>Cloudflare: zaštita prijave od botova, ako je uključena.</li>
              </ul>
            </li>
            <li><strong>Nadležni organi:</strong> samo kad to zakon izričito traži.</li>
          </ul>
          <p>
            Podaci se čuvaju u EU. AI provjera, smještaj sajta i prijava preko Googlea ili Applea rade i sa servera u SAD-u.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>4. Koliko dugo ih čuvamo</h2>
          <ul className="rules-list">
            <li>Dok imaš nalog, čuvamo podatke koji trebaju da usluga radi i da možemo riješiti spor ili prijavu.</li>
            <li>Slike lične karte čuvamo dok imaš nalog, zbog sporova i sprječavanja zloupotrebe. Možeš tražiti da ih obrišemo ranije; tada gubiš oznaku provjerenog identiteta.</li>
            <li>Kad obrišeš nalog, odmah brišemo profil, oglase, ponude, poruke, recenzije, plaćanja vezana za tvoje poslove i sve fajlove koje si poslao, uključujući lične karte. Kopije u rezervnim kopijama baze nestaju same u roku od 30 dana.</li>
            <li>Poruke poslane kroz kontakt formular čuvamo dok ih ne riješimo.</li>
          </ul>
        </section>

        <section className="info-section reveal">
          <h2>5. Tvoja prava</h2>
          <p>
            U skladu sa Zakonom o zaštiti ličnih podataka BiH imaš pravo na pristup, ispravku, brisanje, ograničenje obrade,
            prigovor i kopiju svojih podataka. Ime, grad, telefon i profil mijenjaš sam u postavkama. Za kopiju podataka ili
            bilo koje drugo pravo piši nam preko stranice <Link to="/kontakt">Kontakt</Link>; odgovaramo u roku od 30 dana.
            Ako misliš da kršimo pravila, možeš se žaliti Agenciji za zaštitu ličnih podataka u Bosni i Hercegovini.
          </p>
        </section>

        <section className="info-section reveal" id="brisanje-naloga">
          <h2>6. Brisanje naloga</h2>
          <ul className="rules-list">
            <li>Prijavi se na sajtu ili u aplikaciji, otvori <Link to="/account/profil">Moj nalog → Profil</Link> i na dnu klikni „Obriši nalog“.</li>
            <li>Ako imaš posao s osiguranom uplatom u toku, prvo ga završi ili otkaži, da niko ne ostane bez novca.</li>
            <li>Ako se ne možeš prijaviti, piši nam preko stranice <Link to="/kontakt">Kontakt</Link> s emailom naloga i obrisat ćemo ga u roku od 30 dana.</li>
          </ul>
          <p>Šta se briše i šta ostaje u rezervnim kopijama piše u tački 4.</p>
        </section>

        <section className="info-section reveal">
          <h2>7. Sigurnost</h2>
          <p>
            Sve ide preko šifrovane veze (HTTPS). Pravila u bazi određuju ko smije vidjeti koji podatak, privatni fajlovi se
            otvaraju samo kratkotrajnim linkom, a isplata u aplikaciji traži potvrdu otiskom prsta ili licem.
          </p>
        </section>

        <section className="info-section reveal">
          <h2>8. Uzrast</h2>
          <p>Zadatak je namijenjen osobama od 18 godina i starijim. Ne prikupljamo svjesno podatke mlađih osoba.</p>
        </section>

        <section className="info-section reveal">
          <h2>9. Izmjene</h2>
          <p>O većim izmjenama ove politike javljamo emailom ili obaviještenjem u aplikaciji prije nego što počnu važiti.</p>
        </section>
    </InfoLayout>
  )
}

export default PrivacyPage
