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

## Prvi put (Mac) — korak po korak
Xcode 27 je već instaliran. iOS projekat je sinhronizovan (`ios/App`), ikone i splash su generisani.

1. **Prihvati Xcode licencu** (jednom, traži lozinku Maca) — u Terminalu:
   ```bash
   sudo xcodebuild -license accept
   ```
   Bez ovoga ne rade ni `git`, ni `python3`, ni build.
2. **Otvori projekat u Xcode-u:**
   ```bash
   open ios/App/App.xcodeproj
   ```
   (ili `npm run app:ios`). Pri prvom otvaranju Xcode sam skine Capacitor pakete (SPM) — sačekaj da završi (donji status bar).
3. **Simulator:** gore u traci izaberi *App → iPhone 17 Pro* (bilo koji simulator) → klikni ▶ (Run). Aplikacija se otvara preko cijelog ekrana i učitava live sajt.
4. **Tvoj iPhone:** spoji ga kablom → na telefonu *Postavke → Privatnost i sigurnost → Developer Mode → uključi* → u Xcode-u izaberi svoj iPhone kao uređaj → *Signing & Capabilities → Team: dodaj svoj Apple ID* (besplatan nalog radi za testiranje 7 dana) → ▶ Run. Na telefonu: *Postavke → Opšte → VPN i upravljanje uređajem → Vjeruj*.
5. **TestFlight / App Store:** treba Apple Developer Program (99 $/god): *Product → Archive → Distribute App → TestFlight*. Testeri instaliraju TestFlight i dobiju link.
6. **Android:** instaliraj Android Studio → `npm run app:android` → Run. Za Play: *Build → Generate Signed Bundle*.

Nakon svake promjene web koda **nije potreban novi build** — ljuska učitava live sajt. Novi build treba samo kad se mijenja `capacitor.config.json`, ikone ili native plugini.

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
