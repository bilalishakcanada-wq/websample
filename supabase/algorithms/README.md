# Algoritmi: pretraga, uparivanje, svi gradovi i tačna lokacija

Četiri SQL datoteke, tri Edge funkcije i izmjene u aplikaciji. Svaka SQL datoteka se smije pokrenuti
više puta. Redoslijed: 01, 02, 03, 04.

| Datoteka | Šta radi |
| --- | --- |
| `01_places_and_exact_location.sql` | Sve 141 općine imaju tačku na mapi (bilo ih je 50 bez nje), drugi nazivi (Banjaluka, Bosanski Novi, Rama…), prepoznavanje naselja. Tačna lokacija posla i osobe (ulica i broj ili GPS), s pravilima ko je vidi. Doseg ponude se mjeri od tačne lokacije majstora kad je postavljena. |
| `02_search.sql` | Nova pretraga: riječi bez značenja se preskaču, sinonimi, svi oblici riječi, greške u kucanju, grad iz upita, pretraga po značenju (pgvector). |
| `03_matching.sql` | Uparivanje majstora za posao, preporuke poslova za majstora i rang majstora: prvo prava struka, pa udaljenost i ocjene. |
| `04_embeddings.sql` | Red za vektore oglasa i profila, keš vektora upita, pg_cron posao koji svake minute zove `embed`. |

## Rezultati (lokalna kopija baze, 66 oglasa i 27 majstora sa stvarnim tekstovima)

| Mjerenje | Prije | Poslije |
| --- | --- | --- |
| Pretraga, 46 upita: pravi oglas u prvih 5 | 71 % | 92 % |
| Pretraga, 46 upita: upiti bez ijednog rezultata | 4 | 0 |
| Pretraga, 16 novih upita (nisu korišteni za podešavanje): pravi oglas u prvih 5 | 81 % | 100 % |
| Pretraga, 16 novih upita: bez rezultata | 3 | 0 |
| Uparivanje majstora: pravi majstor na vrhu | 3 od 7 | 6 od 7 |
| Preporuke poslova: pravi posao na vrhu | 3 od 5 | 4 od 5 |

Bez OpenAI ključa sve gore radi, samo bez dijela "po značenju". S ključem se dodaju oglasi napisani
drugim riječima.

## Tačna lokacija: ko šta vidi

* **Posao.** Klijent pri objavi bira mjesto, a može dodati i ulicu i broj ("Ilirska 67"), uzeti trenutnu
  GPS lokaciju ili pomjeriti iglu na mapi. Tačnu adresu vide samo klijent i izvođač čija je ponuda
  prihvaćena (`listing_address`, RLS na `listing_addresses`). Svi ostali vide mjesto, a javna tačka posla je
  ta adresa zaokružena na oko 1 km, pa udaljenost u pretrazi i doseg ponuda mjere od stvarnog mjesta bez
  otkrivanja kućnog broja. Promjena mjesta na poslu briše staru adresu.
* **Osoba.** U Profilu se može postaviti "Moja lokacija". Niko je ne vidi. Algoritmi koriste istu tačku
  zaokruženu na oko 1 km (`person_point`): preporuke poslova, uparivanje, doseg ponude, "Blizu mene".
* **Pretraga.** "Blizu mene" uzima GPS telefona; "Moja lokacija iz profila" uzima sačuvanu tačku.
* **Praćenje dolaska** vodi izvođača na tačnu adresu kad postoji.

## Šta treba uraditi na produkciji (tek nakon odobrenja)

1. Pokrenuti 01, 02, 03, 04 u SQL editoru (tim redom).
2. Deploy Edge funkcija:
   * `geocode` i `embed-query`: zovu ih prijavljeni i neprijavljeni korisnici preko aplikacije (verify_jwt uključen).
   * `embed`: zove ga pg_cron sa `x-sweep-key` (**verify_jwt isključen**, kao i ostale sweep funkcije).
3. Secret `OPENAI_API_KEY` (model `text-embedding-3-small`, 512 dimenzija, oko 0,02 USD na milion tokena;
   svi oglasi i profili danas su par centi). Bez ključa `embed` i `embed-query` vraćaju
   `configured: false` i ništa ne šalju.
   Napomena: naslov, kategorija i opis oglasa, te struke i bio majstora šalju se OpenAI-ju da se dobije vektor.
4. Adrese u tačke: javni OpenStreetMap Nominatim, besplatan, najviše 1 upit u sekundi, svaki odgovor se
   pamti u `geocode_cache`. Za veći promet: `NOMINATIM_URL` (+ `NOMINATIM_KEY`) na LocationIQ ili svoj server,
   bez izmjene koda.

## Testovi (samo lokalna baza)

`tests/` upisuje testne poslove i ljude, zato odbija da radi kad `PGHOST` pokazuje na Supabase.

```
python3 tests/seed.py              # piše tests/out/seed.sql i ids.json
psql … -f tests/out/seed.sql       # lokalna baza sa shemom aplikacije
python3 tests/eval_search.py       # 46 upita
SET=heldout python3 tests/eval_search.py   # 16 novih upita
python3 tests/eval_match.py        # uparivanje i preporuke
```
