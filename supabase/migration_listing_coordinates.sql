-- Coordinates for the browse-page map.
--
-- The post-task form only offers a fixed list of BiH towns (src/data/cities.js),
-- so lat/lng come from a static table (src/data/cityCoordinates.js) that the
-- client attaches at create/update time - no external geocoder, no rate limit.
-- "Online / na daljinu" listings intentionally stay null and are shown in the
-- list without a pin.

alter table public.listings
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create index if not exists listings_published_geo_idx
  on public.listings (status, lat, lng)
  where status = 'published';

-- Existing rows were backfilled once from the same table (exact city name
-- first, then longest city name contained in a free-text location). See the
-- applied migration `listing_coordinates_for_map` for the one-off backfill.
