# Robot za testiranje Zadatka

Robot otvara sajt kao kupac: na računaru, na telefonu, na malom Android telefonu (360 px) i na telefonu
sa povećanim slovima (130 %, kako ih mnogi stariji ljudi imaju), kao gost,
novi korisnik, klijent i izvođač. Na svakoj glavnoj stranici traži ono na čemu se kupac spotakne:

- dugmad, linkove i polja koja nešto prekriva (pritisak bi pao na to drugo)
- dugmad i polja jedno preko drugog, tekst preko teksta
- dugmad, polja ili tekst odsječene na ivici ekrana, stranice koje se šire van ekrana
- polja bez naziva (ne zna se šta upisati), polja sa sitnim slovima zbog kojih iPhone zumira stranicu
- trake i baneri koji na telefonu zauzimaju veliki dio ekrana
- ekran „Došlo je do greške“, JavaScript greške, zahtjeve koji padnu, „undefined“/„NaN“ prikazano ljudima,
  slike koje se ne učitaju i linkove koji vode na „stranica ne postoji“

Svaki problem ima sliku ekrana na kojoj je taj element zaokružen crvenom bojom. Cijeli krug traje oko 5 minuta.

## Kada radi

Na svakom pull requestu i svake noći (GitHub Actions, `.github/workflows/robot.yml`). Pravi
privatnu kopiju baze sa test nalozima, pokreće testove toka posla (`e2e/`), puni bazu primjerima
poslova i ponuda (`robot/seed.mjs`), pa istražuje sajt. Izvještaj sa slikama ekrana je na stranici
pokretanja („robot-report“). Ništa ne dira pravi sajt niti pravu bazu.

## Lokalno

```bash
bash robot/local-db/setup.sh          # Docker; lokalna baza + test nalozi + .env.local
npx vite build && npx vite preview --port 4175 &
export $(cat robot/local-db/.anon) && node robot/seed.mjs
node robot/explore.mjs                # izvještaj: robot-report/report.md
```

Test nalozi (lozinka `Test12345!`): `klijent@test.zadatak`, `izvodjac@test.zadatak`, `admin@test.zadatak`,
`novi@test.zadatak`. `bash robot/local-db/reset.sh` vraća ih u početno stanje.

Podešavanja (env): `ROBOT_BASE_URL`, `ROBOT_PROFILES=desktop,phone,small,bigtext` (ima i `app`),
`ROBOT_ROLES=guest,newbie,client,provider` (ima i `admin`), `ROBOT_MAX_PAGES=30`, `ROBOT_CLICKS=1` (pritisne i
svako dugme), `ROBOT_FORMS=1` (popuni forme čudnim unosom), `ROBOT_VITALS=1` (mjeri brzinu), `ROBOT_PARALLEL=4`,
`ROBOT_FAIL_ON=error|warn|never`, `ROBOT_CHROMIUM=/putanja/do/chrome`, `ROBOT_TRACE=1`.

Na pravom sajtu samo kao gost, da ništa ne promijeni: na GitHubu Actions → Robot → Run workflow, polje „site“
= adresa sajta. Ili lokalno:
`ROBOT_BASE_URL=https://bilalishakcanada-wq.github.io/websample ROBOT_ROLES=guest node robot/explore.mjs`
