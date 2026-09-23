# Sigurni sistem komunikacije

Primijenjeno na produkciju 22.09.2026. Migracije: `moderation_scan_close_bypasses`,
`moderation_scan_digit_run_rule`, `chat_lifecycle_gate`, `in_app_calls_log_and_gate`,
`messages_require_participation`.

## Gdje se pravila brane

Sva tri modula su u bazi, ne u Node middlewareu. Razlog je arhitektura: frontend
šalje `INSERT` direktno na PostgREST (`messageService.send`), pa bi svaki sloj
iznad baze napadač jednostavno preskočio pozivom na `supabase.co`. Socket.io
autorizacija koju prompt traži bi u ovom stacku bila ukras, ne brana.

## Modul 1 — chat vezan za životni ciklus

`chat_state(conversation_id)` vraća jedno od tri stanja, a trigger
`messages_lifecycle_gate` ga provodi pri svakom `INSERT`:

| Stanje | Kada | Ponašanje |
|---|---|---|
| `locked` | ponuda nije prihvaćena, novac nije u escrowu | slanje odbijeno (403) — koriste se javna pitanja na oglasu |
| `open` | posao u toku (`funded`/`requested`/`disputed`) | normalno dopisivanje |
| `readonly` | posao namiren (`released`/`refunded`) | slanje odbijeno (403), čitanje ostaje |

Razgovori bez oglasa (podrška) ostaju otvoreni. Osoblje smije pisati uvijek.

## Modul 2 — pozivi u aplikaciji

`start_call()` / `update_call()` + tabela `calls` (ko, kada, trajanje, je li išlo
preko releja). Poziv se može započeti **samo dok je `chat_state = 'open'`**, uz
ograničenje od 5 poziva u 5 minuta protiv uznemiravanja.

Signalizacija ide preko **Supabase Realtime broadcast kanala**
([`src/lib/webrtc.js`](../../src/lib/webrtc.js)), ne preko zasebnog Socket.io
servera: SDP i ICE poruke su prolazne, kanal već postoji i već je autentifikovan
istim JWT-om. Jedan servis manje za držati i osiguravati.

**Što ovo ne rješava:** peer-to-peer ne prolazi iza simetričnog NAT-a (dio
mobilnih mreža). Za to treba **TURN relej** — plaćen servis (Cloudflare Calls,
Twilio, Metered) ili vlastiti coturn. Bez njega oko 10–20 % poziva neće uspjeti.
Kredencijali TURN-a moraju se izdavati kratkoročno iz Edge funkcije
(`turn-credentials`), nikad upisivati u frontend build.

## Modul 3 — sprječavanje zaobilaženja platforme

**Već je postojao** (`moderation_scan` + `moderate_content` + `apply_moderation_strike`)
i bio je jači nego što prompt traži: hvata `[at]`/`(dot)`, brojeve ispisane
riječima, homoglife, društvene mreže i zabranjenu robu, maskira u `[uklonjeno]`,
piše u `moderation_events` i dodjeljuje strajk.

Umjesto prepisivanja, testiran je i probijen. Zatvorena zaobilaženja:

| Pokušaj | Prije | Sada |
|---|---|---|
| `O61 234 S67` (slova kao cifre) | prošlo | uhvaćeno |
| `06I2345б7` (ćirilično б) | prošlo | uhvaćeno |
| `peroATgmailDOTcom` | prošlo | uhvaćeno |
| `061·234·567` (unicode tačka) | prošlo | uhvaćeno |
| `pero(kod)gmail(tacka)com` | prošlo | uhvaćeno |
| emoji cifre `0️⃣6️⃣1️⃣` | prošlo | uhvaćeno |

Rezultat: **23/23** — svih 11 pokušaja zaobilaženja uhvaćeno, svih 12 normalnih
poslovnih rečenica prošlo netaknuto (cijene, kvadrature, rokovi, garancije).

Lažne uzbune su bile stvarni rizik: prva verzija ispravke lijepila je susjedne
riječi uz broj (`je 06I…` → `j306I…`), čime je nestala granica riječi i broj se
prestao prepoznavati. Riješeno posebnim pravilom koje uzme neprekinut niz znakova
nalik ciframa, svede ga na cifre i provjeri ima li oblik BiH broja.

### Što regex ne može
`nadji me na guglu`, `broj je u opisu oglasa`, `mail ti je u profilu` — to su
upute, ne podaci. Opis oglasa i profil se ipak skeniraju istim detektorom, pa je
druga polovina toga pokrivena. Ostatak traži ponašajnu detekciju (razgovori koji
prestanu bez posla), što je poseban posao.

## Rupa nađena usput (starija od ovih izmjena)

Politika za slanje poruke provjeravala je samo `auth.uid() = sender_id`, ali ne i
da je pošiljalac učesnik razgovora. **Bilo koji prijavljeni korisnik mogao je
ubaciti poruku u bilo čiji razgovor** i, birajući `receiver_id`, poslati
obavijest bilo kome na platformi. Dokazano pozivom API-ja (HTTP 201), zatvoreno,
pa ponovo provjereno (HTTP 403 `NISI_UCESNIK_RAZGOVORA`).

## Frontend (gotov)

| Dio | Gdje |
|---|---|
| Stanje chata u inboxu | `my_inbox()` vraća `chat_state` — bez dodatnog poziva po razgovoru |
| Zaključano / read-only umjesto forme | [`ChatStateNotice.jsx`](../../src/components/ChatStateNotice.jsx) |
| Dugmad za poziv (samo kad je otvoreno) | `MessagesPage.jsx` (desktop) i `Chat.jsx` (telefon) |
| Ekran poziva | [`CallPanel.jsx`](../../src/components/CallPanel.jsx) |
| Logika poziva | [`useCalls.js`](../../src/hooks/useCalls.js) + [`webrtc.js`](../../src/lib/webrtc.js) |
| TURN kredencijali | Edge funkcija `turn-credentials` (bez podešenog provajdera vraća STUN) |

Testovi: [`e2e/calls.spec.js`](../../e2e/calls.spec.js) — Chromium dobija lažni
mikrofon i kameru (`--use-fake-device-for-media-stream`), pa poziv prolazi bez
hardvera. **8/8 E2E prolazi.**

### Tri greške nađene tokom uvezivanja

1. **Hook za pozive se montirao dvaput.** `MessagesPage` na telefonu renderuje
   `Chat`, pa su oba zvala `useCalls` → dvije pretplate na isti Realtime kanal →
   `cannot add postgres_changes callbacks after subscribe()` i **cijela stranica
   Poruke je pucala na telefonu**. Riješeno: hook se zove jednom, prosljeđuje se
   kroz props; kanal je dobio i jedinstveno ime za svaki slučaj.
2. **Propušten poziv se gubio bez traga.** Realtime ne ponavlja događaje: poziv
   upućen dok se pretplata uspostavljala (ili dok je veza pala) nikad ne bi
   stigao. Dodata jednokratna provjera pri otvaranju — traži poziv koji upravo
   zvoni (zadnjih 45 s).
3. **Poziv koji niko ne javi zvonio je zauvijek.** Zapis je ostajao `ringing`,
   pozivaocu je stajalo „Zvoni…", a pozvanom se poziv javljao pri svakom
   otvaranju aplikacije. Sada ističe nakon 45 s na klijentu i nakon 60 s u bazi
   (cron `expire-stale-calls`, svake minute); „aktivan" poziv stariji od 6 sati
   se zatvara kao prekinuta veza.

## Prije puštanja poziva u rad

TURN mora biti plaćen i podešen (`TURN_URLS` + `TURN_SECRET`, ili
`CF_TURN_KEY_ID` + `CF_TURN_API_TOKEN` u Supabase Secrets). Bez toga pozivi rade
na većini mreža, ali padaju iza simetričnog NAT-a.
