# Booking Engine — ugovor kao state machine

Escrow je **već postojao** (`accept_offer_and_fund` skine novac klijentu, drži ga
na platformi, `release`/`cancel` ga puštaju). Ovi fajlovi dodaju ono bez čega
escrow nije pošten prema obje strane.

## Stanja ugovora

```
                    ┌──────────────┐
                    │ in_progress  │ ◀── novac osiguran u escrowu
                    └──────┬───────┘
         izvođač predaje   │  ┌──────────────────────────┐
         rad + DOKAZ       ▼  │ odbijen prekid → vraća se │
                    ┌──────────┴───┐    u prethodno stanje │
                    │  submitted   │ ──────────────────────┘
                    │  (teče 72 h) │
                    └──┬────┬───┬──┘
       klijent odobri  │    │   │ klijent traži ispravku (max 3)
       ILI istekne 72h │    │   └──────────▶ ┌──────────┐
                       │    │                │ revision │
                       │    │  ◀─────────────┴──────────┘
                       ▼    │   izvođač predaje ispravku
                 ┌──────────┐│
                 │completed ││ bilo ko otvori spor
                 │novac →   ││         ▼
                 │izvođaču  ││   ┌──────────┐
                 └──────────┘│   │ disputed │ sve zamrznuto,
                             │   └────┬─────┘ odlučuje podrška
                             │        │
        traži se prekid ─────▼        ▼
              ┌──────────────────┐  completed ili cancelled
              │ cancel_requested │
              └────────┬─────────┘
       druga strana pristane → cancelled (novac → klijentu)
```

Dozvoljeni prelazi su **podaci** u `work_transitions`, ne if-ovi po kodu. Novo
pravilo je jedan `INSERT`, i uvijek se vidi cijela istina o tome ko šta smije.

## Šta je zatvoreno (i šta je bilo otvoreno)

| Rupa prije | Sada |
|---|---|
| **Bilo koja strana je mogla jednostrano otkazati** i vratiti novac klijentu dok je posao „funded". Izvođač odradi posao, klijent klikne Otkaži. | `cancel_job_payment` traži prihvaćen zahtjev za sporazumni prekid ili odluku tima. |
| **Pošiljalac je mogao izmijeniti i obrisati svoju poruku** (`messages_manage_own` je bila `FOR ALL`). Podrška presuđuje po prepisci — a prepiska se mogla prekrojiti poslije svađe. | Nema `UPDATE`/`DELETE` politike; trigger odbija i admina. Moderacija skriva (`hidden_at`), ne briše. |
| **Vlasnik je mogao mijenjati `listings.status` direktno** kroz API — vratiti posao u „published" dok novac stoji u escrowu. | `protect_listing_system_fields` vraća sistemska polja; opis i cijena zaključani dok je uplata osigurana. |
| Izvođač je tvrdio da je završio, bez dokaza. | `submit_work` traži slike ili izvještaj (min. 20 znakova), i u funkciji i kao `CHECK`. |
| Klijent nestane → novac zaglavi. | 72 h pa automatska isplata (`pg_cron`, svakih 15 min). |
| Klijent traži ispravke unedogled i drži novac zaključanim. | Najviše 3 ispravke, pa samo odobrenje ili spor. |
| Stalni zahtjevi za prekid resetuju rok od 72 h. | `prev_state` + `restore_deadline`: odbijanje vraća ugovor **tačno** tamo gdje je bio, sa netaknutim rokom. |

## Testirano (lokalni PostgreSQL, vjerne kopije funkcija)

| Scenarij | Ishod |
|---|---|
| Klijent jednostrano otkazuje dok rad traje | ⛔ odbijeno, novac ostaje u escrowu |
| Predaja rada bez dokaza | ⛔ odbijeno |
| Predaja rada sa dokazom | ✅ `submitted`, rok +72 h |
| Izvođač sam sebi odobrava rad | ⛔ `FORBIDDEN` |
| Klijent odobrava dok je u ispravci | ⛔ `NEDOZVOLJEN_PRELAZ` |
| Odbijen prekid nakon predanog rada | ✅ vraća se u `submitted`, rok netaknut |
| Pun tok do isplate | ✅ izvođač 900 KM od 1.000 (provizija 10 %) |
| Mrtvi klijent, istekao rok | ✅ automatska isplata 900 KM + obavještenja |
| Sporazumni prekid | ✅ klijentu vraćeno 1.000 KM |
| Spor zamrzava sve | ✅ automatsko odobrenje preskače, odobrenje odbijeno |
| Izmjena poruke nakon slanja | ⛔ odbijeno |
| Brisanje poruke | ⛔ odbijeno |
| Izmjena cijene dok je novac u escrowu | ⛔ odbijeno |
| Direktna izmjena statusa posla | ⛔ trigger vratio staru vrijednost |

Tri greške pronađene i ispravljene u vlastitom kodu tokom testiranja:

1. `UPDATE ... RETURNING * INTO v_row` prepisao staro stanje prije upisa u dnevnik,
   pa su svi zapisi glasili `submitted → submitted`. Dnevnik po kojem podrška
   presuđuje sporove bio bi bezvrijedan.
2. Odbijen prekid vraćao ugovor u `in_progress`, čime se gubio predani rad i
   resetovao rok od 72 h — klijent bi stalnim zahtjevima beskonačno odgađao isplatu.
3. `exception when others` u cron poslu progutao je potpuni otkaz i vraćao `0`,
   što izgleda identično kao „nema šta za obraditi". Izvođači bi mjesecima ne
   dobijali novac, a nadzor bi vidio uredan posao. Sada broji neuspjehe i diže
   upozorenje.

## Redoslijed primjene

```
supabase/security/01_money_race_fix.sql   ← PRVI (booking se oslanja na lock)
supabase/booking/01_state_machine.sql
supabase/booking/02_actions.sql
supabase/booking/03_guards.sql
```

Postojeći ugovori dobijaju `work_state = 'in_progress'`; oni koji su već
`released`/`refunded` treba jednokratno prebaciti u `completed`/`cancelled`:

```sql
update public.job_payments set work_state = 'completed' where status = 'released';
update public.job_payments set work_state = 'cancelled' where status = 'refunded';
```

**Napomena o E2E testovima:** `cancel_job_payment` više ne prolazi jednostrano, a
`e2e/job-flow.spec.js` koristi direktno oslobađanje — test treba dopuniti korakom
predaje rada prije odobrenja.

## Naknadni nalazi (25.09.2026.)

**`work_transitions` je bila bez RLS-a i sa pravom pisanja za `authenticated`.**
Ta tabela JESTE sigurnosno pravilo — `job_transition()` je čita da odluči smije li
prelaz. Svaki prijavljeni korisnik mogao je upisati vlastito pravilo, npr.
`('in_progress','completed','client')` i odobriti isplatu bez ijednog predanog
rada, ili `('disputed','completed','client')` i izaći iz spora. Zatvoreno:
RLS uključen, samo čitanje, dozvole oduzete, provjereno pozivom API-ja
(HTTP 403 `permission denied`). Isto je preventivno urađeno i za `job_events`,
`work_submissions`, `cancellation_requests`, `disputes` i `calls` — njih puni
isključivo SECURITY DEFINER funkcija, pa im direktne dozvole ne trebaju.

**Stanje ugovora se razilazilo sa novcem.** `release_job_payment` i
`cancel_job_payment` mijenjali su samo `status`, ne i `work_state`: klijent
oslobodi uplatu ranije → novac ode, a kartica i dalje piše „Izvođač radi posao"
i nudi „Predaj rad" za plaćen posao. Umjesto krpljenja svake funkcije posebno,
stanje sada prati novac trigerom `job_payments_sync_work_state` — vrijedi i za
funkcije koje se dodaju kasnije. Postojeći redovi su usklađeni.

## booking/04 — zaštita od prevare (05.10.2026.)

`04_fraud_shield.sql` (pustiti POSLIJE `security/09`, jer 09 inače ponovo otvara `job_transition`):

| Rupa prije (provjereno na živoj bazi) | Sada |
|---|---|
| Vlasnik je API pozivom mijenjao `listings.status`: plaćen posao nazad u „published", „completed" bez isplate, „cancelled" sa krivicom izvođača. | `listings_status_guard`: dok postoji uplata status mijenja samo tok posla; `assigned`/`archived` samo sistem; završen/otkazan je konačan. Dugme „Posao završen" i dalje radi za stare poslove bez uplate. |
| `job_transition()` se mogao zvati direktno: strana koja traži prekid sama upiše „cancelled" i zaključa novac. | Izvršava ga samo platforma, kroz akcije sa provjerama. |
| Stari `request_job_payment` / `open_job_dispute` mijenjali status mimo state machine-a. | Zatvoreni; aplikacija koristi `submit_work` i `open_dispute`. |
| `bidder_metrics()` svakome otkrivao ko je dao ponudu. | Samo vlasniku posla i timu. |
| Ništa nije garantovalo da red u `job_payments` odgovara skinutom novcu. | Pri nastanku: ponuda, strane, tačan iznos, tačna naknada i `escrow_hold` istog iznosa u istoj transakciji. Poslije: strane i uslovi nepromjenjivi, iznos samo raste uz plaćenu razliku. |
| Nije bilo dokaza da je izvođač bio na licu mjesta. | `work_proofs` + `add_work_proof`: slika kamerom u aplikaciji (bez galerije), GPS + UTC utisnuti na sliku, serversko vrijeme prijema, udaljenost od posla, SHA-256 (ista slika ne prolazi dvaput). Posao na terenu se ne predaje bez slike PRIJE i svježe slike POSLIJE. Online poslovi i ugovori stariji od ovog fajla nisu pogođeni. |

Testovi: `e2e/proof-flow.spec.js` (lažna kamera + GPS u Chromiumu) i ručni SQL napadi na lokalnoj kopiji baze.
