# Poso.ba — arhitektura proširenja (RBAC, KYC, depoziti, Trust & Safety)

Dokument opisuje kako se pet novih modula uklapaju u postojeću platformu i kako
KYC i AI-detekcija komuniciraju sa jezgrom sistema.

## 0. Odluka o stacku

Postojeći stack ostaje: **React (Vite) + Supabase (PostgreSQL 17, RLS, Realtime,
Storage, Edge Functions)**. Razlog je praktičan, ne sentimentalan:

* jezgro (oglasi, ponude, escrow, poruke, ocjene) radi i pokriveno je E2E testovima;
* sve što ovi moduli traže — uloge, redovi za pregled, transakcijska pravila,
  audit — prirodno živi u Postgresu, gdje pravilo vrijedi i kad ga neko pokuša
  zaobići direktnim API pozivom;
* prepisivanje u NestJS košta mjesece i ne donosi nijednu od traženih osobina.

**Node/NestJS servis se uvodi samo tamo gdje Supabase objektivno nije dovoljan** —
za poslove koji traju duže od jednog HTTP zahtjeva ili drže tajne trećih strana:
orkestracija KYC provajdera, obrada webhookova, red za AI-detekciju slika,
generisanje faktura. Taj servis je stateless i ne drži kopiju podataka.

```
┌──────────────┐   Supabase JS (anon key, RLS)   ┌────────────────────────┐
│  React app   │ ───────────────────────────────▶│  PostgreSQL 17         │
│  (Vite, PWA) │                                  │  RLS + RPC + trigeri   │
└──────┬───────┘                                  │  audit_log (append)    │
       │  REST (JWT)                              └───────▲────────────────┘
       ▼                                                  │ service role
┌──────────────────────────┐   webhook   ┌────────────────┴─────────────┐
│  kyc-orchestrator (Node) │◀────────────│  KYC provajder (liveness,    │
│  NestJS, stateless       │────────────▶│  OCR, provjera dokumenta)    │
│  RbacGuard + audit       │             └──────────────────────────────┘
└──────┬───────────────────┘
       │ red poslova
       ▼
┌──────────────────────────┐
│  media-scanner (Node)    │──▶ detektor AI slika + C2PA čitač
└──────────────────────────┘
```

## 1. Tok KYC verifikacije

```
korisnik                   baza                    orkestrator            provajder
   │  1. kyc_cases (draft)   │                          │                     │
   ├────────────────────────▶│                          │                     │
   │  2. upload u bucket 'kyc' (privatan, signed URL)    │                     │
   ├────────────────────────▶│                          │                     │
   │  3. submit               │   4. NOTIFY / webhook    │                     │
   ├────────────────────────▶├─────────────────────────▶│  5. OCR + liveness  │
   │                          │                          ├────────────────────▶│
   │                          │  7. kyc_checks (upis)    │  6. rezultat        │
   │                          │◀─────────────────────────┤◀────────────────────┤
   │                          │  8. state=awaiting_review│                     │
   │                          │                          │                     │
   │            ┌─────────────┴──────────────┐                                 │
   │            │  RED ZA RUČNI PREGLED      │  ← ovdje NEMA automatskog       │
   │            │  kyc_claim_next() (lease)  │    odobrenja                    │
   │            └─────────────┬──────────────┘                                 │
   │  10. odluka              │  9. Support pregleda dokaze                    │
   │◀─────────────────────────┤     kyc_decide(case, true/false)               │
```

**Zašto ovako:**

* **Dokument nikad ne prolazi kroz naš Node servis.** Ide direktno u privatni
  bucket preko potpisanog URL-a. Orkestrator dobije samo `case_id` i čita fajl
  kratkotrajnim potpisanim linkom. Manje kopija = manje mjesta odakle može procuriti.
* **Automatika ne odobrava.** `kyc_decide()` odbija odobrenje ako `liveness` nije
  `pass` i ako ne postoji tačno poklapanje imena sa računa. Operater, dakle, ne
  može "progurati" predmet, a ni sistem ne može odobriti bez čovjeka.
* **Lease umjesto dodjele.** 7 operatera zove istu funkciju `kyc_claim_next()`;
  `FOR UPDATE SKIP LOCKED` garantuje da dvoje nikad ne dobiju isti predmet, a
  zaključavanje ističe samo od sebe (15 min) ako operater zatvori prozor.
* **Svako otvaranje dokumenta je zabilježeno** (`kyc_document_open()` → `audit_log`).
  Bez toga nema odgovora na pitanje "ko je gledao nečiju ličnu kartu".

### Izbor provajdera
Liveness i provjeru dokumenta **ne pravimo sami** — to je biometrija sa ozbiljnim
pravnim i tehničkim zahtjevima. Kandidati: Sumsub, Veriff, Onfido, Ondato
(posljednji ima bolje pokrivanje regiona). Tabela `kyc_checks` pamti `provider` i
`threshold`, pa zamjena provajdera ne traži migraciju podataka.

## 2. AI-detekcija slika

Nadogradnja postojećeg `moderation_queue`:

```
upload slike ──▶ moderation_queue (pending)
                      │
                      ▼
              media-scanner (Node)
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
   C2PA/EXIF    detektor AI     perceptual hash
   (dokaz)      (score 0..1)    (već viđena slika?)
        └─────────────┼──────────────┘
                      ▼
          moderation_thresholds po tipu
                      │
    ┌─────────────────┼─────────────────┐
    ▼                 ▼                 ▼
score ≥ auto_reject  između         < review_from
   ODBIJ          RUČNI PREGLED       PROPUSTI
```

**Namjerno nije "AI odlučuje".** Detektori AI slika griješe u oba smjera —
označe pravu fotografiju kao lažnu i propuste dobar generisani portret. Zato
postoje tri zone i srednja ide čovjeku. Pragovi su u bazi (`moderation_thresholds`),
pa se podešavaju bez deploya kad se vidi stvarna stopa grešaka.

## 3. Novac: escrow, depozit, provizija

| Zahtjev | Gdje je izveden | Kako se ne može zaobići |
|---|---|---|
| Depozit 4.000 / 2.000 KM | `deposit_accounts`, `has_deposit()` | `can_transact()` je uslov u RLS politici za objavu posla i slanje ponude |
| Nema povrata nakon isplate | trigger `guard_payment_finality` | UPDATE u `refunded` puca ako nema odobrenja od nekoga sa `refund.authorize` |
| Finansijski zapis se ne briše | trigger `guard_payment_delete` | DELETE uvijek puca; storno je novi zapis |
| Klijent ne vidi proviziju | kolonske dozvole + pogledi | roli `authenticated` je oduzeta dozvola na `fee_percent`, `fee_amount`, `net_amount` |
| Realtime ne curi proviziju | `payment_events` | klijent sluša taj kanal; `job_payments` se vadi iz publikacije |

### Chargeback — šta softver ne može
"Onemogućen povrat" je izveden do kraja **unutar platforme**. Ali kad korisnik
pozove svoju banku i pokrene chargeback, taj novac se skida bez obzira na naš kod —
to je pravo vlasnika kartice na nivou kartične sheme i ne postoji zapis u bazi
koji to može spriječiti. Zato postoji tabela `chargebacks`: kad PSP javi spor,
prilažemo dokaze (prihvaćena ponuda, liveness, prepiska, potvrda isporuke).
**Odbrana od chargebacka je dokumentacija, ne zabrana.** Praktična posljedica:
liveness i potpisane ponude nisu samo KYC — oni su dokazni materijal koji dobija
sporove.

### Skrivanje provizije — granica
Skrivanje *razlaganja* cijene je uobičajeno i legitimno (klijent vidi konačnu
cijenu). Ono što se ne smije sakriti je **ukupan iznos koji se naplaćuje** — i
račun/faktura mora ga pokazati (`invoices`). Za pravna lica i PDV razlaganje je
zakonski obavezno na fakturi. Sažeto: u UI-u konačna cijena, na fakturi puna istina.

## 4. Vidljivost poslova (geofencing)

Jedna funkcija drži pravilo: `listing_visible_to(listing, lat, lng, radius)`.
Posao se vidi ako je **globalan**, **premium** (budžet ≥ prag iz
`job_visibility_settings`, podrazumijevano 1.500 KM), **online/bez lokacije**, ili
**unutar radijusa**. Trigger `mark_premium_listing` postavlja zastavice pri upisu,
pa pretraga ne računa pragove u letu. Prag se mijenja jednim UPDATE-om (permisija
`it.system.manage`), bez deploya.

## 5. Trust & Safety

```
"Prekini ugovor"  ──▶  contract_terminations (reported)
   (razlog iz šifarnika + dokaz ako ga razlog traži)
                              │
                              ▼
                     Support: review_termination()
                    ┌─────────┴─────────┐
                 dismissed            upheld
                                        │
                                        ▼
                                   strikes (+weight)
                                        │
                     ┌──────────────────┼──────────────────┐
                 1 strajak          2 strajka          3 strajka
                 (interno)      JAVNO UPOZORENJE      SUSPENZIJA 90 dana
                                 na profilu            + gubitak bedža
```

* **Strajk ne nastaje pritiskom na dugme.** Prijava ide u red; tek `review_termination()`
  je pretvara u strajk. Time se dugme "prekid ugovora" ne može koristiti kao oružje.
* **Razlozi su šifarnik**, ne slobodan tekst: nose težinu (`off_platform` i
  `harassment` vrijede 3 = trenutna suspenzija) i uslov dokaza.
* **Bedž povjerenja se računa**, ne dodjeljuje: KYC + depozit + nula strajkova +
  najmanje 3 završena posla + ocjena ≥ 4,3.
* Javni pogled `public_trust_signals` nosi samo signale (bedž, upozorenje) — nikad
  dokaze ni prepisku.

## 6. Redoslijed uvođenja

Pravila poput `can_transact()` odmah zaključavaju platformu, pa se uvode u fazama:

1. **01_rbac** — uloge i permisije. Nema vidljive promjene za korisnike.
2. **02_kyc** + orkestrator — verifikacija radi, ali još nije obavezna.
3. **05_trust_safety** — strajkovi i razlozi raskida.
4. **03_payments_deposits** — prvo kolonske dozvole i `payment_events`
   (uz izmjenu `paymentService.js`), pa tek onda depozit kao uslov.
5. **04_jobs_geo_consulting** — geofencing i savjetovanja.
6. **06_principal** — jedinstveni kontekst, na kraju.

Korisnicima koji već posluju treba prelazni rok (grandfathering): `can_transact()`
se uključuje kao uslov tek nakon roka, inače postojeći nalozi ostaju blokirani
preko noći.

## 7. Šta je provjereno

Sve SQL datoteke su pokrenute na lokalnom PostgreSQL-u nad scaffoldom koji
odgovara postojećim tabelama, pa su invarijante testirane:

| Test | Rezultat |
|---|---|
| Iznos/provizija se mijenja nakon uplate | odbijeno ✅ |
| Povrat nakon isplate bez odobrenja | odbijeno ✅ |
| Povrat odobren od Supporta (nema ovlaštenja) | odbijeno ✅ |
| Povrat odobren od Team Leada | prolazi ✅ |
| Brisanje finansijskog zapisa | odbijeno ✅ |
| "Išak, Bilal" = "BILAL ISAK" | poklapa ✅ |
| "Bilal Išak" = "Amir Isak" | ne poklapa ✅ |
| Posao od 4.000 KM | premium + globalan ✅ |
| 2. strajak | javno upozorenje ✅ |
| 3. strajak | suspenzija 90 dana ✅ |
| Razlog `off_platform` bez dokaza | odbijeno ✅ |
| Dvostruko bukiranje termina | odbijeno ✅ |
| Preklapanje termina istog izvođača | odbijeno ✅ |
| `authenticated` čita `fee_amount` | ne vidi ✅ (vidi samo `amount`) |

Tri greške pronađene i ispravljene tokom testiranja:

1. `REVOKE SELECT (kolona)` **ne radi** ako roli postoji dozvola na nivou tabele —
   Postgres je tiho ignoriše. Popravljeno: revoke na tabeli pa grant po kolonama.
2. `job_payments` je u `supabase_realtime` publikaciji i Realtime šalje **cijeli red**,
   pa bi provizija procurila mimo kolonskih dozvola. Popravljeno: `payment_events`.
3. Vraćeno (`refunded`) plaćanje se moglo obrisati. Popravljeno: finansijski zapis
   se ne briše nikad.
