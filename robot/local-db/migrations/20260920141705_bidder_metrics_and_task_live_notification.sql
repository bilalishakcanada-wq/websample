-- Rating / completion rate for the people who made offers on one job (offer cards on the job page).
create or replace function public.bidder_metrics(p_listing_id uuid)
returns table(user_id uuid, avg_rating numeric, review_count bigint, completed_jobs bigint, success_rate numeric, is_verified boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.avg_rating, m.review_count, m.completed_jobs, m.success_rate, m.is_verified
  from public.provider_metrics() m
  where m.user_id in (select b.bidder_id from public.bids b where b.listing_id = p_listing_id);
$$;
grant execute on function public.bidder_metrics(uuid) to anon, authenticated;

-- When a job goes live: tell the owner (push "your job is live") and link task-alert notifications to the job.
create or replace function public.on_listing_published_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if new.status <> 'published' or (TG_OP = 'UPDATE' and old.status = 'published') then return new; end if;
  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (new.user_id, 'task_live', 'Tvoj posao je objavljen 🎉', left(new.title, 120) || ' — izvođači u blizini su obaviješteni. Ponude stižu ovdje.', '/listings/' || new.id::text, 'live:' || new.id::text)
  on conflict do nothing;
  for a in
    select distinct t.user_id from public.task_alerts t
    where t.user_id <> new.user_id
      and (t.keyword is null or t.keyword = '' or (new.title || ' ' || coalesce(new.description, '')) ilike '%' || t.keyword || '%')
      and (t.category is null or t.category = '' or t.category = new.category)
      and (t.city is null or t.city = '' or public.cities_match(t.city, new.location))
  loop
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (a.user_id, 'task_alert', 'Novi posao: ' || new.title, coalesce(new.location, '') || case when new.price is not null then ' · ' || new.price || ' KM' else '' end, '/listings/' || new.id::text, 'alert:' || new.id::text || ':' || a.user_id::text)
    on conflict do nothing;
  end loop;
  return new;
end;
$$;;
