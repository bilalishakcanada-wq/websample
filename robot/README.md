# Robot za testiranje Poso.ba

Robot otvara sajt kao čovjek: na računaru, na telefonu, na malom Android telefonu (360 px) i unutar
Android aplikacije, kao gost, novi korisnik, klijent, izvođač i administrator. Na svakoj stranici
prati linkove, pritišće dugmad i zapisuje sve što ne valja:

- JavaScript greške i greške u konzoli
- zahtjeve prema serveru ili bazi koji padnu (4xx/5xx)
- ekran „Došlo je do greške“
- stranice koje se šire van ekrana (klizanje u stranu na telefonu)
- „undefined“, „NaN“, „null“ ili „Invalid Date“ prikazano ljudima
- slike koje se ne učitaju, linkove koji vode na „stranica ne postoji“
- dugmad koja se ne mogu pritisnuti (nešto ih prekriva ili su van ekrana) i dugmad koja ne rade ništa
- polja bez naziva i dugmad bez teksta (čitači ekrana), premala dugmad na telefonu, spore stranice

Dugmad koja brišu, odjavljuju, suspenduju ili prebacuju novac robot namjerno ne pritišće.

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

Test nalozi (lozinka `Test12345!`): `klijent@test.poso`, `izvodjac@test.poso`, `admin@test.poso`,
`novi@test.poso`. `bash robot/local-db/reset.sh` vraća ih u početno stanje.

Podešavanja (env): `ROBOT_BASE_URL`, `ROBOT_PROFILES=desktop,phone,small,app`,
`ROBOT_ROLES=guest,newbie,client,provider,admin`, `ROBOT_MAX_PAGES=45`, `ROBOT_CLICKS=0` (samo gleda),
`ROBOT_PARALLEL=4`, `ROBOT_FAIL_ON=error|warn|never`, `ROBOT_CHROMIUM=/putanja/do/chrome`, `ROBOT_TRACE=1`.

Na pravom sajtu samo kao gost i bez pritiskanja dugmadi, da ništa ne promijeni:
`ROBOT_BASE_URL=https://bilalishakcanada-wq.github.io/websample ROBOT_ROLES=guest ROBOT_CLICKS=0 node robot/explore.mjs`
