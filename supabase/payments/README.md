# Uplata karticom i isplata na račun

Provajder: **Monri** (WebPay Form). Radi u KM (BAM) i najrašireniji je procesor
kartica u BiH. Poso.ba nikad ne vidi broj kartice: korisnik je unosi na Monri
stranici.

## Tok uplate

```
Balans → „Uplati karticom“ → iznos (5–2.000 KM)
  → Edge funkcija card-topup-start: red u card_payments + potpisana forma
  → preglednik šalje formu na Monri (ipgtest.monri.com u testu)
  → Monri naplati karticu
  → Monri zove card-topup-callback (potpis WP3-callback sha512(ključ + tijelo))
  → card_payment_complete(): jednom upiše novac na balans (card_topup)
  → korisnik se vrati na /account/novcanik?uplata=ok i vidi potvrdu
```

Povratak na sajt **ne** upisuje novac: samo potpisan callback. Isti callback
poslan dvaput upisuje jednom. Iznos koji je Monri naplatio mora biti tačno
onaj koji je traženi, inače se uplata odbija.

## Tok isplate

Monri ne šalje novac na tuđe račune, pa isplata ide bankovnim nalogom firme:

```
Balans → „Isplati na račun“ → iznos (min 20 KM)
  → request_payout(): iznos se skine s balansa (payout_hold)
  → /admin → Balans → „Zahtjevi za isplatu“
  → tim uplati nalogom i klikne „Poslano“ uz referencu naloga
     ili „Odbij“ uz razlog → iznos se vraća na balans (payout_return)
```

Pravila protiv prevara:

| Pravilo | Zašto |
|---|---|
| isplaćuje se samo zarada od poslova, ne novac uplaćen karticom | ukradena kartica ne može postati gotovina na tuđem računu |
| identitet mora biti potvrđen | zna se kome se šalje novac |
| račun mora glasiti na ime s profila | nema „posuđenih“ računa |
| jedan otvoren zahtjev po korisniku | nema duplih isplata |
| najviše 5 pokušaja plaćanja u 10 minuta | forma ne služi za testiranje ukradenih kartica |

## Uključivanje

1. Monri nalog (test): merchant key i authenticity token iz Monri panela.
2. Supabase → Edge Functions → Secrets:
   `MONRI_KEY`, `MONRI_AUTHENTICITY_TOKEN`, `MONRI_ENV=test`.
3. Deploy: `card-topup-start` (verify_jwt uključen) i `card-topup-callback`
   (**verify_jwt isključen**: Monri nema Supabase token; štiti ga potpis).
4. Test kartice iz Monri dokumentacije → uplata se pojavi na balansu sa „(TEST)“.
5. Za pravi novac: `MONRI_ENV=live` + produkcijski ključevi.

Bez ključeva dugme „Uplati karticom“ kaže da plaćanje još nije uključeno. Ništa
se ne lomi.

Testirano 26.09.2026. na produkciji unutar transakcije koja je vraćena
(22 slučaja: callback, ponovljeni callback, pogrešan iznos, direktan poziv bez
prava, isplata bez verifikacije / bez računa / na tuđe ime / preko zarade / ispod
minimuma / dvostruka, otkazivanje, odluka tima sa i bez reference).

## Povećanje cijene i otkazivanje (`02_price_increase_and_cancellation_policy.sql`)

Kao na Airtaskeru:

- **Povećanje cijene:** izvođač dok radi traži dodatni iznos (1–2.000 KM) uz razlog.
  Klijent odobri i iznos se odmah osigura s njegovog balansa, ili odbije. Jedan
  zahtjev na čekanju, najviše 3 po poslu.
- **Otkazivanje:** ko traži prekid kaže ko je odgovoran (on ili druga strana), a
  druga strana prihvata ili odbija (tada spor). Odgovorna strana plaća 10 % cijene,
  najviše 50 KM, osim u prvom satu nakon prihvatanja ponude. Klijentu se naknada
  zadrži od povrata; izvođaču se skine s balansa, a ostatak od sljedeće zarade.
  Na oglasu se upiše `cancel_reason = client | provider`, pa se izvođaču prekid
  računa kao neuspješan posao (stopa uspješnosti u `provider_metrics`).

Sučelje radi i prije nego što je ovaj SQL u bazi: dugme za povećanje i izbor
odgovorne strane pojave se tek kad tabela `price_increase_requests` postoji.

Testirano 26.09.2026. na produkciji unutar transakcije koja je vraćena: povećanje
(odobreno, odbijeno, povučeno, limit, samo izvođač traži, samo klijent odobrava,
dvostruko odobravanje), otkazivanje izvođača nakon sat vremena (naknada 25 KM
dugovana, naplaćena od sljedeće zarade, neuspješan posao), otkazivanje u prvom satu
(bez naknade) i otkazivanje klijenta (povrat 700 − 50 KM).
