# Sigurnosni audit — Poso.ba (22.09.2026.)

Audit je rađen nad **živom arhitekturom**, ne nad pretpostavljenom: pregledane su
RLS politike, sve `SECURITY DEFINER` funkcije, prava na kolone, Realtime
publikacija i tok novca. Nalazi su dokazani izvršavanjem, ne zaključivanjem.

## Sažetak

| # | Nalaz | Ozbiljnost | Stanje |
|---|---|---|---|
| 1 | Dvostruka isplata iz escrowa (race condition) | **KRITIČNO** | zakrpa napisana i testirana |
| 2 | `release` + `cancel` paralelno prazne escrow | **KRITIČNO** | isto |
| 3 | Provizija curi kroz Realtime | VISOKO | zakrpa u `enterprise/03` |
| 4 | `REVOKE` na koloni ne djeluje uz table-level `GRANT` | VISOKO | isto |
| 5 | Nema idempotentnih ključeva | SREDNJE | dodano |
| 6 | Nema ograničenja učestalosti u bazi | SREDNJE | dodano |
| 7 | Nema detekcije anomalija prijave | SREDNJE | dodano |
| 8 | `public_profiles` je `SECURITY DEFINER` view | SREDNJE | otvoreno |
| 9 | 5 funkcija bez fiksnog `search_path` | NISKO | otvoreno |
| 10 | Zaštita od procurjelih lozinki isključena | NISKO | vlasnik uključuje |

## Nalaz 1 i 2 — dvostruka isplata (KRITIČNO)

Sve četiri funkcije koje pomjeraju novac rade po istom obrascu:

```sql
select * into v_row from job_payments where listing_id = ...;   -- bez FOR UPDATE
if v_row.status <> 'funded' then raise ...                       -- provjera na
perform wallet_move(...);                                        -- zastarjelom
update job_payments set status = '...';                          -- snapshotu
```

Pod `READ COMMITTED` izolacijom dvije paralelne transakcije vide isti stari status,
obje prođu provjeru i obje isplate novac.

**Dokazano na vjernoj kopiji funkcija, dvije paralelne sesije:**

```
escrow 1000 KM
 → dva puta "Oslobodi uplatu"       = 1800 KM isplaćeno   (izvođač plaćen dvaput)
 → "Oslobodi" + "Otkaži" paralelno  = 1900 KM isplaćeno   (izvođač 900 + klijent 1000)
```

Napadač ne treba saučesnika: **klijent je ovlašten i za oslobađanje i za
otkazivanje**, pa dva istovremena zahtjeva iz istog browsera prazne escrow.
Gubitak je do punog iznosa svakog posla.

`accept_offer_and_fund` je slučajno preživio jer `UNIQUE(listing_id)` obori drugi
`INSERT` — dakle zaštićen je sporednim efektom sheme, ne namjerom.

**Zakrpa** (`supabase/security/01_money_race_fix.sql`), tri sloja:

1. `SELECT ... FOR UPDATE` — druga transakcija čeka umjesto da čita staro stanje.
2. Uslovni `UPDATE ... WHERE status IN (...) RETURNING` prije dodira novca —
   compare-and-swap; ko izgubi trku, puca sa `VEC_NAMIRENO`.
3. Trigger `guard_payment_transition` — iz `released`/`refunded` se ne izlazi,
   pa ni buduća funkcija napisana bez lock-a ne može platiti dvaput.

**Isti napadi nakon zakrpe:**

```
dva puta "Oslobodi"        → A: ISPLAĆENO 900 · B: BAD_STATUS   → ukupno 900 ✅
"Oslobodi" + "Otkaži"      → isplata 900 · povrat odbijen       → ukupno 900 ✅
normalna pojedinačna isplata                                     → 900 ✅
```

## Šta je već bilo dobro (i ne treba dirati)

Nekoliko stvari iz vašeg zahtjeva je već riješeno, pa bi „popravka" bila šteta:

* **Balans se ne može mijenjati s klijenta.** Trigger `protect_profile_system_fields`
  vraća `balance`, `account_status`, `suspended_until` i ostala sistemska polja na
  staru vrijednost za svakoga ko nije admin ili sistem. `PATCH /profiles` sa
  `{"balance": 999999}` prolazi kao zahtjev, ali ne mijenja ništa.
* **IDOR na novčaniku ne postoji.** `my_wallet()` i sve `wallet_*` funkcije rade
  isključivo nad `auth.uid()`; `user_id` se ne prima kao parametar s klijenta.
  `wallet_move` uopšte nije izvršiv za rolu `authenticated`.
* **`wallet_move` je otporan na klasičan race**: `balance = balance + x` je jedan
  `UPDATE` koji uzme lock na redu, pa 100 paralelnih poziva ne može prekoračiti stanje.
* **SQL injection nije moguć.** PostgREST parametrizuje sve, a provjerio sam svih
  ~130 `SECURITY DEFINER` funkcija: **nijedna ne koristi dinamički SQL** (`EXECUTE format`).
* **Suspenzije su ispravno zatvorene.** `staff_guard_target` brani rad nad sobom,
  nad vlasnikom i nad drugim zaposlenim (osim za admina).
* **Lozinke** hešira Supabase Auth (bcrypt). Nema šta mijenjati.
* **XSS površina je minimalna**: nigdje `dangerouslySetInnerHTML` ni `innerHTML =`.

## Tri zahtjeva koja u ovom stacku ne stoje kako ste zamislili

**1. Rate limiting u Node middlewareu ne štiti ništa.**
Frontend zove Supabase direktno. Express/Next middleware nije u putanji zahtjeva —
napadač zove `https://<projekt>.supabase.co/rest/v1/...` i middleware ne sazna za
to. Zato je ograničenje izvedeno tamo gdje zahtjev stvarno stiže: u bazi
(`public.rate_limit_hit`, atomično kroz `ON CONFLICT DO UPDATE`) i na Cloudflareu.
Node middleware (`server/src/security/`) štiti samo rute koje stvarno idu kroz
Node: KYC upload, webhookove, fakture.

**2. JWT u `HttpOnly` cookie nije moguć bez promjene arhitekture.**
Supabase JS SDK drži sesiju u `localStorage`; kolačići traže server koji ih
postavlja (`@supabase/ssr` + SSR okvir). To je prelazak na Next.js, mjesec dana posla.
Trezvena procjena: `HttpOnly` štiti od krađe tokena kroz XSS — a XSS površina vam je
već minimalna (React bježi sve, nema `innerHTML`). Bolji odnos uloženog i dobijenog:
**stroga CSP** (u middlewareu), kratko trajanje tokena i rotacija refresh tokena.
Ironija koju treba znati: prelaskom na kolačiće **uvodite CSRF**, koji danas
strukturno ne postoji jer PostgREST koristi `Authorization` zaglavlje, a ne kolačiće.
CSRF tokeni vam trenutno nisu potrebni.

**3. AES-256 za KYC dokumente — Supabase Storage već šifruje na disku.**
Dodatna vrijednost je zaštita od nekoga ko ima pristup bazi. Za to ima smisla
šifrovati na klijentu prije uploada (ključ u KMS-u), ne u aplikacijskom sloju.
Važnije od šifre je **ko smije otvoriti fajl** — to rješava `kyc_document_open()`
uz obavezan audit.

## Greška pronađena u mom vlastitom kodu

Prva verzija detekcije nemogućeg putovanja **nikad ne bi okinula**: poredio sam
`ip_geo.ip` sa `p_ip::text`, a cast `inet → text` daje `2.2.2.2/32`, što se nikad
ne poklopi sa `2.2.2.2` u tabeli. Kontrola bi stajala u bazi, izgledala ispravno i
tiho ne radila ništa — najopasnija vrsta sigurnosne greške. Ispravljeno na
`host(p_ip)` i ponovo testirano.

Pouka koja vrijedi za cijelu platformu: **kontrola koja nije viđena kako pada nije
kontrola.** Svaki sigurnosni mehanizam treba test koji dokazuje da blokira napad.

## Preostali vektori koje treba pokriti

**Novac i prevara**
1. **Pranje novca kroz lažne poslove** — dva naloga, posao od 5.000 KM, novac izađe
   kao „zarada". Mjera: pravilo da par klijent↔izvođač koji međusobno radi > N puta
   ide na pregled; prag za isplatu bez provjere.
2. **Zlatni korisnik pa nestanak** — dobre ocjene, pa veliki posao i nestanak.
   Mjera: limit escrowa vezan za historiju, ne za ocjenu.
3. **Nadoplata pa povrat na drugu karticu** — klasična shema pranja. Mjera: povrat
   isključivo na izvorni instrument.
4. **Manipulacija provizijom** — `fee_percent_for()` čita `fee_tiers` po prometu;
   provjeriti da promet ne može biti naduvan samosklopljenim poslovima.

**Nalozi i identitet**
5. **Preuzimanje naloga preko e-maila** — promjena e-maila mora tražiti potvrdu sa
   stare adrese i blokirati isplatu 24 h nakon promjene.
6. **Dijeljenje verifikovanog naloga** — jedan verifikovan nalog radi za više ljudi.
   Signali: više uređaja, više gradova, obrazac rada.
7. **OAuth `implicit` flow** — vaš klijent koristi `flowType: 'implicit'`, pa token
   dolazi u URL hash-u. Radi to zbog OAuth-a iz instalirane aplikacije, ali hash
   može procuriti kroz historiju/`Referer`. Kad native tok bude na PKCE-u, prebaciti.

**Platforma**
8. **Preuzimanje Storage objekata** — provjeriti da nijedan bucket sa dokumentima
   nije javan i da potpisani URL-ovi traju kratko (≤ 60 s).
9. **Zloupotreba Edge funkcija** — `moderate-media`, `support-assistant` i
   `trust-agent` troše novac po pozivu; trebaju ograničenje po korisniku.
10. **Napad kroz sadržaj na AI agenta** — korisnik u opis posla upiše uputu za
    `support-assistant`/`trust-agent`. Tretirati korisnički tekst kao podatak,
    nikad kao uputu; ne dati agentu alate koji mijenjaju novac ili uloge.
11. **Nabrajanje korisnika** — `/korisnik/:id` i pretraga ne smiju otkrivati e-mail
    ni telefon; provjeriti šta tačno vraća `public_profiles`.
12. **Odbijanje usluge kroz Realtime** — jedan klijent otvori 1.000 pretplata.
    Ograničiti broj konekcija po korisniku.
13. **Zavisnosti** — uključiti Dependabot i `npm audit` u CI.
14. **Oporavak** — testirati vraćanje baze iz kopije. Kopija koja nije isprobana
    nije kopija.

## Redoslijed

1. **Odmah:** zakrpa 01 (dvostruka isplata) — dok ovo stoji, svaki posao sa pravim
   novcem je izložen.
2. **Ove sedmice:** zakrpa 02 (ograničenje, idempotencija, anomalije), Realtime
   popravka, kolonska prava, `search_path`, `public_profiles`.
3. **Prije pravog novca:** stavke 1–4 i 8 iz liste vektora, pa vanjski pentest.
