# Poso.ba — mobilna aplikacija (iOS / Android)

Web stranica je već PWA (instalira se sa telefona bez app storea). Za App Store / Google Play
i beta testiranje (TestFlight / Play Internal testing) tu su nativni projekti napravljeni sa Capacitorom:

- `ios/App/App.xcodeproj` — otvori u Xcode-u (`npm run app:ios`)
- `android/` — otvori u Android Studiju (`npm run app:android`)

## Kako radi
`capacitor.config.json` → `server.url` pokazuje na objavljenu stranicu
(https://bilalishakcanada-wq.github.io/websample/). Aplikacija je nativna ljuska koja učitava
uvijek najnoviju verziju — svaki push na `main` = nova verzija u aplikaciji, bez novog builda.

Kad želiš da aplikacija radi i bez interneta / potpuno iz paketa: obriši `server` iz
`capacitor.config.json`, napravi build sa `VITE_BASE=/ npm run build` i pokreni `npm run app:sync`.

## Prvi put (Mac)
1. Instaliraj **Xcode** iz App Storea (besplatno, ~12 GB) i jednom ga otvori da prihvatiš licencu.
2. `npm run app:ios` → u Xcode-u izaberi simulator (iPhone 16) → ▶ Run.
3. Za TestFlight: Xcode → Signing & Capabilities → tvoj Apple Developer tim (99 $/god) → Product → Archive → Distribute → TestFlight.
4. Android: instaliraj Android Studio → `npm run app:android` → Run. Za Play: Build → Generate Signed Bundle.

Ikone i splash ekrani su već generisani (`npm run app:assets` ih pravi iz `assets/icon.png` i `assets/splash.png`).
ID aplikacije: `ba.poso.app`, ime: Poso.ba.
