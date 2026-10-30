# Odluke

Najnovije gore. Svaka odluka ima datum i izvor (PR ili razgovor). Nazad: [[README]]

- **30.10.2026.** Zatvaranje naloga (sd): Postavke > "Deaktiviraj ili obriši nalog" vodi na `/account/zatvori-nalog`. Izbor privremena deaktivacija ili trajno brisanje, obavezan razlog (lista, "Nešto drugo" traži tekst), pa 6-cifreni kod s emaila naloga (15 min, 5 pokušaja, novi kod nakon 60 s, najviše 5 na sat). Deaktivacija: profil se ne vidi, objavljeni poslovi se pauziraju, ponude na čekanju se povlače; nalog vidi samo ekran "Ponovo aktiviraj". Razlozi u tabeli `account_closure_reasons` (poslije brisanja bez veze s osobom), čita ih samo admin. Kod: `supabase/security/13_account_closure.sql`, funkcija `delete-account`.
- **30.10.2026.** Balans bez ilustracije. Gore bijeli panel: Dostupno, Ukupno na Zadatku i jedna traka (Dostupno, Rezervisano, Stiže); sd izabrao opciju C od tri dizajna. Ispod: Rezervisano za poslove, Stiže na balans, Može se isplatiti, pa Na putu i 5 posljednjih transakcija (PR #103).
- **30.10.2026.** Baner za kolačiće s izborom (Postavke, Samo neophodno, Prihvati sve) i stranica `/kolacici`; Sentry radi samo uz pristanak. Bez izmišljenih izvođača i recenzija, bez dugih crta, emojija i pilula; svaki email obavijesti ima link "Isključi email obavijesti" (PR #101, funkcije objavljene).
- **30.10.2026.** Pravila dizajna i uslovi za pokretanje, vidi [[pravila]].
- **28.10.2026.** Robot poslije svake objave sam pregleda živi sajt kao gost (PR #99).
- **28.10.2026.** Admin: Nadzor > Sumnjivi parovi, za klijente i izvođače koji se možda dogovaraju van Zadatka (PR #99).
- **28.10.2026.** Sentry hvata greške čim se doda DSN; stranica se sama osvježi poslije nove verzije umjesto da padne (PR #98).
- **27.10.2026.** Svi mailovi idu s info@zadatak.ba preko Resenda (PR #97).
- **25.10.2026.** Potvrda broja telefona SMS kodom u Postavkama i Nalogu (PR #85 do #90; Infobip, može i Twilio).
- **25.10.2026.** Suspenzija na vrijeme iz admin panela; suspendovan nalog vidi samo odbrojavanje, server odbija sve ostalo (PR #84).
- **25.10.2026.** Uspješnost na profilu se računa iz stvarnih poslova (PR #82).
- **23.10.2026.** Android bez pozadinske lokacije (nema FOREGROUND_SERVICE_LOCATION), sd izabrao opciju B (PR #76).
- **22.10.2026.** Android package za Google Play: `ba.zadatak.app` (PR #75).
- **11.10.2026.** Novi izgled sajta i aplikacije u plavo-bijelom, s bosanskim ilustracijama.
- **04.10.2026.** Ime Poso.ba promijenjeno u Zadatak.
- **28.09.2026.** Plaćanje karticom (Monri) čeka; sd: "payment method i will do later".
- **26.09.2026.** Ponude mogu slati samo izvođači s potvrđenom ličnom kartom i tim.
- **26.09.2026.** Dugme Nazad uvijek ide jedan korak nazad, isto na sajtu, Androidu i iPhoneu (PR #7).
