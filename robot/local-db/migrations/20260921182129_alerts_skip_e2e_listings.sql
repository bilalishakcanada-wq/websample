-- Automated end-to-end tests post real jobs titled "[E2E] …": the owner still gets the
-- "objavljen" notice, but nobody else is alerted about a robot's job.
create or replace function public.on_listing_published_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if new.status <> 'published' or (TG_OP = 'UPDATE' and old.status = 'published') then return new; end if;
  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (new.user_id, 'task_live', 'Tvoj posao je objavljen 🎉', left(new.title, 120) || ' — izvođači u blizini su obaviješteni. Ponude stižu ovdje.', '/listings/' || new.id::text, 'live:' || new.id::text)
  on conflict do nothing;
  if new.title like '[E2E]%' then return new; end if;
  for a in
    select distinct t.user_id from public.task_alerts t
    where t.user_id <> new.user_id
      and (t.keyword is null or t.keyword = '' or (new.title || ' ' || coalesce(new.description, '')) ilike '%' || t.keyword || '%')
      and (t.category is null or t.category = '' or t.category = new.category)
      and (t.city is null or t.city = '' or public.cities_match(t.city, new.location))
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
    values (a.user_id, 'task_alert', 'Novi posao: ' || new.title, coalesce(new.location, '') || case when new.price is not null then ' · ' || new.price || ' KM' else '' end, '/listings/' || new.id::text, 'alert:' || new.id::text || ':' || a.user_id::text)
    on conflict do nothing;
  end loop;
  return new;
end;
$$;;
