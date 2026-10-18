# Doseg ponuda 2: lokacija uređaja i molba za plaćen prevoz

Pokrenuti na Supabase bazi poslije `airtasker/04`, `algorithms/01` i `communication/04`:

1. `01_device_location_and_travel_requests.sql`

| Plaća (budžet + novac za put) | Ponude do |
|---|---|
| „Po dogovoru“ | 25 km |
| do 49 KM | 10 km |
| 50–149 KM | 25 km |
| 150–299 KM | 50 km |
| 300 KM i više | cijela BiH |
| online posao | cijela BiH |

- Razredi su u tabeli `reach_tiers` (i `reach_config` za „Po dogovoru“, svježinu lokacije i najveći iznos
  molbe). Promjena: `update public.reach_tiers set km = 15 where pay_below = 50;` i isti broj u
  `src/utils/reach.js` (`REACH_TIERS`), da ekran pokazuje isto što baza provjerava.
- Udaljenost se mjeri od lokacije uređaja (dozvoljena lokacija, najviše 30 dana stara), pa od adrese iz
  profila, pa od grada iz profila. Tačka je uvijek zaokružena na ~1 km.
- Izvođač koji je predaleko ne može poslati ponudu ni pitanje ispod posla (`PREDALEKO`). Može samo poslati
  molbu da klijent plati prevoz (`request_travel`: gorivo, taksi ili prevoz, 1–300 KM, kratka poruka bez
  kontakata). Klijent prihvata ili odbija (`answer_travel_request`); kad prihvati, taj izvođač smije
  poslati ponudu. Jedna molba po poslu, najviše 10 dnevno po izvođaču.
- `01_test.sql` provjerava sve to na lokalnoj bazi (`robot/local-db/setup.sh`).
