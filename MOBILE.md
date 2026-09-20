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

## Push obavijesti (Web Push)

- Radi u Chrome/Edge/Firefox (Android + desktop) i u Safariju na iOS 16.4+ **samo kad je Poso.ba dodan na početni ekran**.
- Korisnik ih uključi karticom „Uključi obavijesti“ (nadzorna ploča / poruke) ili u *Postavke → Ovaj uređaj*.
- Tok: `notifications` insert → trigger `on_notification_push` → Edge Function `send-push` → push servis → `src/sw.js` prikazuje notifikaciju; klik otvara `link` u aplikaciji.
- Nove obavijesti se prave i za poruke (`on_message_notify`, jedna po razgovoru dok se ne pročita) i ponude (`on_bid_notify`).
- VAPID: javni ključ je u `src/utils/push.js` (`VITE_VAPID_PUBLIC_KEY` ga može pregaziti); privatni je u Supabase Vault (`vapid_private_jwk`), čita ga samo `service_role` preko `public.vapid_private_jwk()`.
- SQL je u `supabase/migration_push_notifications.sql`.

> Napomena: u nativnoj ljusci (Capacitor/WKWebView) Web Push ne radi — za push u App Store verziji treba `@capacitor/push-notifications` + APNs/FCM. Za beta preko početnog ekrana (PWA) push radi kako je opisano gore.
