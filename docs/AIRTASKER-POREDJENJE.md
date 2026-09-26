# Poso.ba i Airtasker: šta imamo, šta je dodano, šta slijedi

Airtasker (airtasker.com/au) je uzor za tok posla: klijent objavi posao, izvođači šalju ponude,
klijent prihvati jednu i novac je osiguran, posao se završi, novac se isplati, obje strane ostave
recenziju. Ovaj dokument poredi svaki korak s Poso.ba (PC, mobilni web i aplikacija dijele isti kod).

Oznake: ✅ već postoji · 🆕 dodano u ovoj izmjeni · 🔜 predloženo sljedeće · ➡️ radi druga nit

## 1. Objava posla

| Airtasker | Poso.ba |
|---|---|
| Naslov, opis, kategorija (s prijedlogom kategorije) | ✅ |
| Datum: na dan / prije datuma / fleksibilno | ✅ ranije samo kao tekst u opisu · 🆕 sada pravi podatak (`date_type`, `due_date`) |
| Doba dana (jutro, podne, popodne, veče) | 🆕 |
| Uživo ili online, grad | ✅ |
| Slike | ✅ (do 10, provjera kontakt podataka na slikama) |
| Budžet uz prijedlog cijene za kategoriju | ✅ |
| „Must-haves“ – do 3 obavezna uslova za izvođača | 🆕 (provjera kontakt podataka kao i za opis) |
| Objavi sličan posao / ponovo | 🆕 „Objavi sličan“ za završene, otkazane i istekle poslove |
| Broj potrebnih izvođača | 🔜 |

## 2. Pretraga poslova

| Airtasker | Poso.ba |
|---|---|
| Lista + mapa, filteri (kategorija, udaljenost, cijena, online, bez ponuda) | ✅ |
| Sortiranje (preporučeno, najnovije, cijena, najbliže) | ✅ |
| Sortiranje po roku („Due soonest“) | 🆕 „Rok uskoro“ |
| Datum i doba dana na kartici posla | 🆕 (ranije je svaka kartica pisala „Fleksibilan termin“) |
| Sačuvani poslovi | 🆕 dugme na kartici i na poslu, lista u „Moji poslovi → Sačuvano“ |
| Obavještenja za nove poslove (task alerts) | ✅ |
| Algoritam preporuka (vještine, udaljenost, svježina, konkurencija) | ✅ |

## 3. Stranica posla, pitanja i ponude

| Airtasker | Poso.ba |
|---|---|
| Javna pitanja | ✅ |
| Ponuda s cijenom i porukom, povlačenje ponude | ✅ |
| Za ponudu treba potvrđen identitet | ✅ (od 26.09.2026. bez izuzetaka) |
| Izvođač vidi koliko mu ostaje nakon naknade | ✅ |
| Izmjena poslane ponude | ➡️ nit „Fix offer sending error“ |
| Klijent odgovara na ponudu (privatno pitanje uz ponudu) | ➡️ nit „Fix offer sending error“ |
| Prijava oglasa, dijeljenje, slični poslovi, predloženi izvođači | ✅ |

## 4. Istek posla (novo pravilo)

Kao na Airtaskeru: kad prođe datum posla, a nijedna ponuda nije prihvaćena, posao **ističe**.
- nestaje iz pretrage i ne prima nove ponude,
- ne može se prihvatiti postojeća ponuda,
- vlasnik dobija obavijest i dugme „Izaberi novi datum“; kad izabere datum, posao je opet otvoren
  i postojeće ponude ostaju.

Baza ovo provodi sama (ne samo ekran), a datum se računa po bosanskom vremenu.

## 4a. Doseg ponuda i troškovi puta (novo pravilo)

Slabo plaćen posao uživo mogu uzeti samo izvođači u blizini; što je posao bolje plaćen, to izdaleka
izvođač smije poslati ponudu. Klijent može dodati novac za put („Platiću put“: gorivo, taksi,
prevoz) i taj iznos se računa u platu, pa širi krug. Izvođač to vidi prije ponude.

| Plaća (budžet + put) | Ponude do |
|---|---|
| „Po dogovoru“ bez puta | 25 km |
| do 49 KM | 15 km |
| 50–99 KM | 25 km |
| 100–199 KM | 40 km |
| 200–399 KM | 70 km |
| 400–799 KM | 120 km |
| 800 KM i više, ili online | cijela BiH |

- Na stranici posla je **radar**: posao u sredini, krug dosega i tvoj grad kao tačka („U dosegu si“
  ili „Predaleko za ovaj posao“).
- U pretrazi kartice pokazuju „U dosegu“ / „Predaleko“ / „Put 20 KM“, a filter „Samo u mom dosegu“
  sakriva poslove koje ne možeš uzeti. Postojeći filter udaljenosti od grada (10–100 km) ostaje.
- Baza odbija ponudu izvan dosega; izvođač bez grada u profilu mora ga dodati.
- Preporučeni poslovi izvođaču ne nude poslove izvan dosega.
- Novac za put je za sada dogovor koji izvođač vidi i uračuna u ponudu; da ide kroz Poso.ba Pay
  kao poseban iznos → ➡️ nit „Plan rollout of enterprise modules“.

## 5. Dodjela, plaćanje, završetak

| Airtasker | Poso.ba |
|---|---|
| Novac osiguran pri prihvatanju ponude (Airtasker Pay) | ✅ Poso.ba Pay (za sada samo ručno dodan kredit) |
| Poruke otvorene tek nakon dodjele, zaštita kontakata | ✅ |
| Izvođač traži isplatu, klijent odobrava, automatska isplata nakon roka | ✅ |
| Revizije, sporovi, zahtjev za otkazivanje | ✅ |
| Kartično plaćanje i isplate izvođačima | ➡️ nit „Plan rollout of enterprise modules“ (test način) |
| Povećanje cijene tokom posla (dodatna sredstva) | ➡️ ista nit |
| Naknada za otkazivanje i uticaj na stopu završenih poslova | ➡️ ista nit |

## 6. Povjerenje

| Airtasker | Poso.ba |
|---|---|
| Recenzije obje strane, prosjek zvjezdica | ✅ |
| Stopa završenih poslova | ✅ |
| Značke (ID, licence, osiguranje) | ✅ |
| Nivoi izvođača i manja naknada za aktivne | ✅ |
| Zadnji put online, član od | ✅ |

## Predloženo sljedeće (ova nit)

1. **Direktan zahtjev izvođaču** („Zatraži ponudu“ s profila izvođača, kao „Request a quote“).
2. **Broj potrebnih izvođača** za veće poslove (selidbe, događaji).
3. **Rok u rangiranju**: posao s rokom sutra malo više u preporukama za izvođače u blizini.

## Baza

SQL je u `supabase/airtasker/` (redom 01, 02, 03). Ekrani rade i prije migracije
(rok se tada čita iz opisa, a čuvanje poslova javlja da još nije uključeno).
