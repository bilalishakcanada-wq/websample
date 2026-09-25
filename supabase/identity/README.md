# Verifikacija identiteta (JMBG + dokument)

Primijenjeno na produkciju 25.09.2026. Migracije: `jmbg_validation`,
`identity_verification_module_v2`, `identity_verification_rpcs`,
`normalize_person_name`, `identity_decide_cast_fix`, `identity_gate_on_jobs_and_bids`.

## Šta algoritam može, a šta ne

`jmbg_check(text)` provjerava **kontrolnu cifru, datum rođenja i šifru regije**
(BiH je 10–19) i iz broja izvodi datum rođenja, pol i regiju.

**Ne može potvrditi da osoba postoji** — u BiH ne postoji javni registar koji bi
privatna firma smjela pitati. Broj koji prođe algoritam je *moguć*, ne *stvaran*.
Da broj pripada baš toj osobi potvrđuje moderator poređenjem sa slikom dokumenta.

Testirano 11 slučajeva: četiri ispravna broja (Sarajevo, Mostar, Tuzla, Zenica) i
sedam neispravnih — pogrešna kontrolna cifra, strana regija, 32. dan, 13. mjesec,
datum u budućnosti, prekratak unos, slova. Svih 11 tačno.

## Kako se čuva JMBG

| | |
|---|---|
| sam broj | **šifrovan** (`pgp_sym_encrypt`, ključ u Supabase Vaultu) |
| čitanje običnim upitom | nemoguće — `revoke select (jmbg_enc)` |
| duplikati | preko **otiska** (sha256 + ključ), bez čitanja broja |
| izvedeno (datum, pol, regija) | otvoreno — treba za provjeru punoljetstva |
| otkrivanje moderatoru | samo kroz `identity_reveal()`, koja **uvijek** upiše ko je gledao |

Isti JMBG ne može biti odobren na dva naloga (jedinstveni indeks nad otiskom).

## Tok

```
korisnik popuni ime + JMBG + slika dokumenta
        │
        ▼  submit_identity()  ← odbija neispravan broj, maloljetne, bez slike
   stanje: submitted
        │
        ▼  identity_claim_next()  ← moderator preuzima (lease 15 min)
   stanje: in_review
        │
        ▼  identity_reveal()  ← otkriva broj + slike, ostavlja trag
        │
        ▼  identity_decide(odobri / odbij + razlog)
   approved ────▶ profil: identity_state='approved'
   rejected ────▶ korisnik dobije razlog i može poslati ponovo
```

Signali koje moderator dobija uz predmet (ne odbijaju, samo skreću pažnju):
ime se razlikuje od profila, isti broj već pokušan na drugom nalogu, neuobičajena
starost.

## Kapija

`identity_ok(user)` je tačno kad je identitet odobren **ili** je nalog stariji od
prelaznog roka **ili** je korisnik član tima.

Prekidači su u tabeli `verification_policy` (mijenja se samo migracijom):

| prekidač | zadano | značenje |
|---|---|---|
| `require_for_jobs` | ✅ | bez verifikacije se ne može objaviti posao |
| `require_for_bids` | ✅ | bez verifikacije se ne može poslati ponuda |
| `require_for_chat` | ❌ | dopisivanje ostaje otvoreno |
| `grandfather_before` | trenutak migracije | **postojeći nalozi su izuzeti** |

Provedeno dvostruko: RLS politika (`listings`, `bids`) i trigger koji daje jasnu
poruku `VERIFIKACIJA_POTREBNA` umjesto tihog RLS odbijanja.

Provjereno: novi nalog **ne može** ni objaviti posao ni poslati ponudu; postojeći
nalog radi normalno; poslije odobrenja novi nalog prolazi. 18/18 E2E prolazi.

## Zašto postojeći nalozi nisu zaključani

Bez `grandfather_before` platforma bi se preko noći zaključala svima — uključujući
vlasnika. Kad odlučite da svi moraju proći verifikaciju, pomjerite taj datum
naprijed (migracijom) i najavite korisnicima rok.

## Sučelje (gotovo)

| Dio | Gdje |
|---|---|
| Forma za korisnika | `/account/verifikacija` — [VerificationPage.jsx](../../src/pages/account/VerificationPage.jsx) |
| Ekran za tim | tab **Identitet** u `/admin` i `/mod` — [IdentityTab.jsx](../../src/pages/admin/IdentityTab.jsx) |
| Servis | [identityService.js](../../src/services/identityService.js) |
| Slike | privatni bucket `identity`, potpisani link traje 60 s |

Korisnik: JMBG se formatira dok se kuca, broji cifre, dugme ostaje zaključano dok
ne unese ime i prezime, 13 cifara i sliku prednje strane. Poslije slanja forma se
zaključa i pokaže stanje (na čekanju / potvrđeno / odbijeno sa razlogom).

Tim: red po redoslijedu prijave, signali uz svaki predmet, a **broj i slike se ne
prikazuju dok moderator izričito ne klikne „Otvori podatke"** — svako otvaranje
ostaje zapisano u `staff_actions`.

**Slike ne može pročitati ni sam korisnik.** Jednom poslanu ličnu kartu vidi samo
tim — ako neko preuzme tuđi nalog, ne može izvući dokument.

### Provjereno kroz sučelje
`e2e/identity.spec.js` (3 testa): dugme zaključano dok podaci nisu potpuni,
pogrešna kontrolna cifra vraća jasnu poruku, ispravan unos ide na provjeru i
forma se zaključa. Ručno provjeren i put moderatora: predmet se pojavi u redu sa
signalom „ime se razlikuje od profila", otvaranje otkrije broj i sliku, potvrda
postavi profil na `approved`, korisnik dobije obavijest, a u `staff_actions`
ostanu `identity_reveal` i `identity_approve`. **21/21 E2E prolazi.**

## Napredni sloj (25.09.2026.)

### 1. Provjera kvaliteta slike — u pregledniku, prije slanja
[`src/utils/imageQuality.js`](../../src/utils/imageQuality.js), bez ijedne biblioteke:

| Mjera | Kako | Prag |
|---|---|---|
| Oštrina | varijansa Laplacijana | < 55 odbija, < 110 upozorava |
| Osvjetljenje | prosjek sivih vrijednosti | < 45 pretamno, > 225 presvijetlo |
| Odsjaj | udio piksela > 250 | > 6 % odbija |
| Veličina | izvorne dimenzije | < 640×400 odbija |

Korisnik dobije odgovor **odmah** („Slika je mutna. Očisti objektiv…") umjesto da
čeka 24 sata pa bude odbijen. Moderator dobija samo čitljive slike. Slika se uz to
smanji na 1600 px prije slanja — manje podataka putuje i manje se čuva.

Baza odbija predaju sa `ostrina < 55` i kad bi neko zaobišao sučelje.

### 2. Otisak slike dokumenta (dHash u oba pravca)
Hvata **istu ličnu kartu poslanu s dva naloga**. Jedinstveni indeks nad otiskom
za odobrene predmete znači da ista slika ne može biti verifikovana dvaput.

Dvije stvari naučene testiranjem:
* klasični dHash poredi samo vodoravno, pa slika sa vodoravnim redovima teksta
  ispadne bez ijednog bita — zato se računa 32 bita vodoravno + 32 uspravno;
* jednolična slika daje otisak od samih nula, što bi lažno izgledalo kao duplikat
  svake druge blijede slike — takav otisak se odbacuje (`null`) umjesto da se
  upiše.

Provjereno: ista slika → razlika 0 bita; različite slike → 16 bita.

### 3. Bodovanje rizika — red ide po opasnosti, ne po vremenu
`identity_risk(case)` sabira signale i vraća `brzo` / `pregled` / `oprez`:

| Signal | Bodovi |
|---|---|
| Ista slika dokumenta s drugog naloga | 45 |
| Isti JMBG pokušan drugdje | 40 |
| S istog uređaja > 2 različita identiteta | 25 |
| Ime se razlikuje od profila | 15 |
| Više od 3 pokušaja u 24 h | 12 |
| Nalog otvoren prije < 1 h | 10 |
| Slika na granici oštrine | 10 |
| Nedostaje zadnja strana lične karte | 8 |
| Odsjaj na dokumentu | 8 |

Bodovi **ne odlučuju umjesto čovjeka** — određuju redoslijed u redu i koliko se
upozorenja prikaže. Odobrenje uvijek potpisuje moderator, koji uz predmet vidi i
razloge i mjere kvaliteta.

Oznaka uređaja je gruba (platforma, jezik, rezolucija, vremenska zona), ne izlazi
iz Poso.ba i služi samo da se vidi kad isti uređaj šalje više identiteta.

### Testovi
`e2e/identity-quality.spec.js`: mutna slika odbijena uz objašnjenje, tamna dobija
svoju poruku, oštra prolazi i otključava slanje. **24/24 E2E prolazi.**

## Dovršeno (25.09.2026., drugi prolaz)

**Brojač u panelu.** Tab „Identitet" tražio je `identity_pending` koji nije
postojao u `staff_overview()`, pa se značka nikad nije prikazivala — moderator
nije imao znak da ga red čeka. Dodani `identity_pending` i `identity_risky`
(predmeti sa 40+ bodova).

**Blokiran korisnik sada zna šta da uradi.** `createListing` i `bidService` su
sve greške gutali u generičko „Zahtjev nije moguće obraditi" — korisnik odbijen
zbog verifikacije nije imao pojma zašto ni kuda dalje. Dodan
[`prepoznajGresku()`](../../src/utils/validation.js) koji poznate poruke iz baze
pretvara u razumljiv tekst **sa linkom**, i
[`ActionError`](../../src/components/ActionError.jsx) koji ga prikaže:

> ⚠ Prije ovoga treba potvrditi identitet — provjera traje obično do 24 sata.
> **Potvrdi identitet →**

**Rok čuvanja dokumenata.** Slika lične karte je najosjetljiviji podatak i nema
razloga da stoji zauvijek:

| Ishod | Slike se brišu |
|---|---|
| odobren | nakon 90 dana |
| odbijen / istekao | nakon 30 dana |

Odluka i dokaz o njoj (ko, kada, koji broj) **ostaju**; briše se samo slika.
Šifrovani JMBG ostaje dok traje nalog — bez njega se ne može spriječiti da se
isti broj verifikuje na drugom nalogu. Posao `identity-purge-docs` radi svaki dan
u 03:30 i stavlja putanje u `identity_purge_queue`, odakle ih briše Storage.

Provjereno: rok se postavlja pri odluci (90 dana), čišćenje obriše putanje,
odluka i otisak JMBG-a ostaju, a 2 datoteke odu u red za brisanje.

**Stara verzija `submit_identity` obrisana.** Uz novu (10 argumenata) ostala je i
stara sa 7 argumenata — poziv na nju je bio legitiman put **oko** provjere
kvaliteta slike i otiska dokumenta. Sada postoji samo jedna.

**Testovi su otporni na zatečeno stanje.** Oba identity spec-a čekaju da se
stranica iscrta pa provjere je li forma zaključana; ranije su se tiho preskakali
i izgledali kao da prolaze.
