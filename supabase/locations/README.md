# Naselja (lokacije u BiH)

Svako naselje, selo i dio grada u BiH (19 507 mjesta) s općinom, kantonom/entitetom i tačkom na karti.
Posao i profil čuvaju mjesto kao „Naselje, Općina“ (npr. „Otes, Ilidža“); doseg ponuda, preporučeni poslovi,
pretraga po udaljenosti i provjera ponude mjere od tačke tog naselja.

| Fajl | Šta je |
|---|---|
| `01_bih_locations.sql` | tabela `bih_locations`, indeksi (GIN full-text + trigram), `search_locations` (kucanje), `coords_for_location` (naselje → tačka), okidač na poslovima, `jobs_near_location` (poslovi u krugu) |
| `02_seed_bih_locations.sql` | podaci (generisano iz CSV-a) |
| `bih_locations.csv` | izvor podataka |

Redoslijed: `01`, pa `02`. Oba se smiju pokrenuti više puta.

## Odakle su podaci

[Who's On First](https://whosonfirst.org) (`whosonfirst-data-admin-ba`), tačke većinom iz
[GeoNames](https://www.geonames.org) — licenca **CC BY 4.0**, zato je zasluga navedena u podnožju stranice.
Općine su preimenovane u današnje nazive (`scripts/locations/municipalities.mjs`), a dijelovi gradova koje izvor
nema (Sokolović Kolonija, Alipašino Polje, Bijeli Brijeg, Slatina…) dodani su ručno s približnom tačkom
(`scripts/locations/extra-places.mjs`). Poštanski brojevi još nisu popunjeni (izvor ih nema).

Ponovo izgraditi i napuniti:

```bash
git clone --depth 1 https://github.com/whosonfirst-data/whosonfirst-data-admin-ba /tmp/wof-ba
node scripts/locations/build-bih-locations.mjs /tmp/wof-ba     # → bih_locations.csv
node scripts/locations/seed-bih-locations.mjs                  # → 02_seed_bih_locations.sql
# ili pravo u bazu: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/locations/seed-bih-locations.mjs --upload
```

PostGIS nije uključen na ovom projektu; udaljenost je haversine (`distance_km`) s kutijom širine/dužine prvo,
isto kao `performance/01_search_radius_first.sql` — unutar jedne zemlje daje isti rezultat.
