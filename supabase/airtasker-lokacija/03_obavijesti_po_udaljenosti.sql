-- Lokacija kao na Airtaskeru, 3: obavijesti o novim poslovima (task_alerts) po udaljenosti i načinu rada.
-- radius_km: koliko daleko od upisanog mjesta (city) posao smije biti; null = samo to mjesto (kao do sada).
-- mode: 'all' (na licu mjesta i online), 'in_person' ili 'remote'. Online posao stiže svakome ko nije
-- izabrao 'in_person', bez obzira na mjesto. Pokrenuti poslije airtasker/05. Može se pokrenuti više puta.
begin;

alter table public.task_alerts
  add column if not exists radius_km integer,
  add column if not exists mode text not null default 'all';
alter table public.task_alerts drop constraint if exists task_alerts_radius_km_check;
alter table public.task_alerts add constraint task_alerts_radius_km_check check (radius_km is null or radius_km between 1 and 300);
alter table public.task_alerts drop constraint if exists task_alerts_mode_check;
alter table public.task_alerts add constraint task_alerts_mode_check check (mode in ('all', 'in_person', 'remote'));

-- does this alert want this job? (the same rule as the Pretraga screen: place + distance, online always in)
create or replace function public.task_alert_matches(t public.task_alerts, l public.listings)
returns boolean language plpgsql stable set search_path = public as $$
declare
  remote boolean := public.listing_is_remote(l.location);
  c record;
begin
  if t.mode = 'remote' and not remote then return false; end if;
  if t.mode = 'in_person' and remote then return false; end if;
  if coalesce(t.keyword, '') <> '' and (l.title || ' ' || coalesce(l.description, '')) not ilike '%' || t.keyword || '%' then return false; end if;
  if coalesce(t.category, '') <> '' and t.category is distinct from l.category then return false; end if;
  if remote or coalesce(t.city, '') = '' then return true; end if;
  if t.radius_km is null then return public.cities_match(t.city, l.location); end if;
  if l.lat is null or l.lng is null then return public.cities_match(t.city, l.location); end if;
  select x.lat, x.lng into c from public.coords_for_location(t.city) x;
  if c.lat is null then return public.cities_match(t.city, l.location); end if;
  return public.distance_km(c.lat, c.lng, l.lat, l.lng) <= t.radius_km;
end $$;
revoke all on function public.task_alert_matches(public.task_alerts, public.listings) from public, anon, authenticated;

create or replace function public.on_listing_published_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published'
     and not (old.invited_provider is not null and new.invited_provider is null) then
    return new;
  end if;

  if new.invited_provider is not null then
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    select new.user_id, 'task_live', 'Zahtjev za ponudu je poslan', left(new.title, 120) || ' — javićemo ti čim izvođač pošalje ponudu.', '/listings/' || new.id::text, 'quote_live:' || new.id::text
    where not exists (select 1 from public.notifications n where n.user_id = new.user_id and n.dedupe_key = 'quote_live:' || new.id::text);
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    select new.invited_provider, 'quote_request',
           case when btrim(coalesce(p.full_name, '')) = '' then 'Klijent' else public.display_name_of(p.full_name) end || ' traži ponudu od tebe',
           left(new.title, 120) || coalesce(' · ' || new.location, '') || case when new.price is not null then ' · ' || new.price || ' KM' else '' end,
           '/listings/' || new.id::text, 'quote:' || new.id::text
    from public.profiles p where p.user_id = new.user_id
      and not exists (select 1 from public.notifications n where n.user_id = new.invited_provider and n.dedupe_key = 'quote:' || new.id::text);
    return new;
  end if;

  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  select new.user_id, 'task_live', 'Tvoj posao je objavljen 🎉', left(new.title, 120) || ' — izvođači u blizini su obaviješteni. Ponude stižu ovdje.', '/listings/' || new.id::text, 'live:' || new.id::text
  where not exists (select 1 from public.notifications n where n.user_id = new.user_id and n.dedupe_key = 'live:' || new.id::text);
  if new.title like '[E2E]%' then return new; end if;
  for a in
    select distinct t.user_id from public.task_alerts t
    where t.user_id <> new.user_id
      and public.task_alert_matches(t, new)
    union
    select p.user_id from public.profiles p
    where p.user_id <> new.user_id
      and p.account_status = 'active'
      and p.account_type in ('provider', 'both')
      and p.notify_push is distinct from false
      and new.category = any(coalesce(p.trades, '{}'))
      and (coalesce(p.city, '') = '' or public.cities_match(p.city, new.location) or new.location ilike '%online%')
  loop
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    select a.user_id, 'task_alert', 'Novi posao: ' || new.title, coalesce(new.location, '') || case when new.price is not null then ' · ' || new.price || ' KM' else '' end, '/listings/' || new.id::text, 'alert:' || new.id::text || ':' || a.user_id::text
    where not exists (select 1 from public.notifications n where n.user_id = a.user_id and n.dedupe_key = 'alert:' || new.id::text || ':' || a.user_id::text);
  end loop;
  return new;
end;
$$;

commit;
