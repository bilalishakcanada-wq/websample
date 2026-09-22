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
