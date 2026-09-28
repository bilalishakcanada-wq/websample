-- 1) Welcome note when a profile is created (shows up in the bell right after sign-up).
create or replace function public.on_profile_created_welcome()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (new.user_id, 'welcome', 'Dobro došao/la na Poso.ba 🎉',
          case when new.account_type in ('provider', 'both') then 'Dopuni profil (vještine, grad, slika) — klijenti biraju izvođače s potpunim profilom.' else 'Objavi prvi posao — ponude obično stignu u roku sat vremena.' end,
          case when new.account_type in ('provider', 'both') then '/account/profil' else '/objavi' end,
          'welcome:' || new.user_id::text)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists profile_created_welcome on public.profiles;
create trigger profile_created_welcome after insert on public.profiles for each row execute function public.on_profile_created_welcome();

-- 2) New review → the person reviewed.
create or replace function public.on_review_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_title text;
begin
  select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.reviewer_id;
  select title into v_title from public.listings where id = new.listing_id;
  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (new.reviewee_id, 'review', 'Nova recenzija: ' || repeat('★', greatest(1, least(5, new.rating))),
          coalesce(v_name, 'Korisnik') || coalesce(' · ' || v_title, '') || coalesce(' — „' || left(new.comment, 100) || '“', ''),
          '/korisnik/' || new.reviewee_id::text, 'review:' || new.id::text)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_review_notify on public.reviews;
create trigger on_review_notify after insert on public.reviews for each row execute function public.on_review_notify();

-- 3) Offer rejected → the bidder (soft wording), in addition to the existing offer / accepted notes.
create or replace function public.on_bid_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_name text; v_amount text;
begin
  select user_id, title into v_owner, v_title from public.listings where id = new.listing_id;
  v_amount := case when new.amount is null then '?' else rtrim(rtrim(new.amount::text, '0'), '.') end;
  if TG_OP = 'INSERT' then
    if v_owner is null or v_owner = new.bidder_id then return new; end if;
    select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.bidder_id;
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (v_owner, 'offer', 'Nova ponuda: ' || v_amount || ' KM', coalesce(v_name, 'Izvođač') || ' · ' || coalesce(v_title, ''), '/listings/' || new.listing_id::text, 'bid:' || new.id::text);
  elsif TG_OP = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (new.bidder_id, 'offer_accepted', 'Ponuda prihvaćena 🎉', coalesce(v_title, 'Posao') || ' — uplata je osigurana, možeš početi.', '/listings/' || new.listing_id::text, 'bidacc:' || new.id::text)
    on conflict do nothing;
  elsif TG_OP = 'UPDATE' and new.status = 'rejected' and old.status = 'pending' then
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (new.bidder_id, 'offer_rejected', 'Klijent je izabrao drugog izvođača', coalesce(v_title, 'Posao') || ' — hvala na ponudi. Novi poslovi stižu svaki dan.', '/search', 'bidrej:' || new.id::text)
    on conflict do nothing;
  end if;
  return new;
end $$;

-- 4) New job → providers in the same city whose trades cover the category (plus the keyword alerts as before).
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
