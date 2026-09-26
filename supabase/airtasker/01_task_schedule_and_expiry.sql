-- ============================================================================
-- Airtasker-style task schedule, must-haves and expiry
--
--  * listings.date_type   'on' (na određeni dan) | 'before' (prije datuma) | 'flexible'
--  * listings.due_date    the date (null when flexible)
--  * listings.time_of_day subset of morning | midday | afternoon | evening (empty = any time)
--  * listings.requirements up to 3 short "must-haves" (npr. "Ima svoj alat")
--  * status 'expired': an open job whose date has passed without an accepted offer.
--    It leaves search, takes no new offers and no offer can be accepted until the
--    owner picks a new date ("Objavi ponovo"), which puts it back to 'published'.
--
-- Dates are judged in Bosnian time (Europe/Sarajevo), not UTC.
-- Idempotent: safe to run more than once.
-- ============================================================================

create or replace function public.today_ba()
returns date language sql stable set search_path = public
as $$ select (now() at time zone 'Europe/Sarajevo')::date $$;

alter table public.listings
  add column if not exists date_type text,
  add column if not exists due_date date,
  add column if not exists time_of_day text[] not null default '{}',
  add column if not exists requirements text[] not null default '{}';

alter table public.listings drop constraint if exists listings_date_type_check;
alter table public.listings add constraint listings_date_type_check
  check (date_type is null or date_type in ('on', 'before', 'flexible'));

alter table public.listings drop constraint if exists listings_due_date_check;
alter table public.listings add constraint listings_due_date_check
  check ((date_type in ('on', 'before') and due_date is not null) or (coalesce(date_type, 'flexible') = 'flexible' and due_date is null));

alter table public.listings drop constraint if exists listings_time_of_day_check;
alter table public.listings add constraint listings_time_of_day_check
  check (time_of_day <@ array['morning', 'midday', 'afternoon', 'evening']::text[]);

alter table public.listings drop constraint if exists listings_requirements_check;
alter table public.listings add constraint listings_requirements_check
  check (cardinality(requirements) <= 3 and coalesce(char_length(array_to_string(requirements, '')), 0) <= 240);

alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('draft', 'published', 'assigned', 'paused', 'closed', 'archived', 'completed', 'cancelled', 'expired'));

create index if not exists listings_open_due_idx on public.listings (due_date) where status = 'published' and due_date is not null;

-- Backfill from the "Kada: Na dan 2026-10-01 / Prije 2026-10-01 / Fleksibilan termin" line
-- the post flows used to append to the description.
update public.listings
set date_type = case when description ~ 'Kada: Prije \d{4}-\d{2}-\d{2}' then 'before' else 'on' end,
    due_date  = substring(description from 'Kada: (?:Na dan|Prije) (\d{4}-\d{2}-\d{2})')::date
where date_type is null and description ~ 'Kada: (Na dan|Prije) \d{4}-\d{2}-\d{2}';

update public.listings set date_type = 'flexible'
where date_type is null and description like '%Kada: Fleksibilan termin%';

-- Must-haves are scanned for contact details like title and description (Pravilo #1).
drop trigger if exists moderate_listings on public.listings;
create trigger moderate_listings
  before insert or update of title, description, requirements on public.listings
  for each row execute function public.moderate_content('user_id', 'title', 'description', 'requirements');

-- A new or changed date can't be in the past, and a job can only be (re)opened with a date
-- that is still ahead.
create or replace function public.guard_listing_schedule()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.due_date is not null and new.due_date < public.today_ba()
     and (tg_op = 'INSERT' or new.due_date is distinct from old.due_date
          or (new.status = 'published' and old.status is distinct from 'published')) then
    raise exception 'ROK_U_PROSLOSTI: odaberi datum od danas nadalje' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists listings_schedule_guard on public.listings;
create trigger listings_schedule_guard
  before insert or update of due_date, status on public.listings
  for each row execute function public.guard_listing_schedule();

-- No new offers, and no accepting an offer, on a job that isn't open or whose date has passed.
create or replace function public.guard_bid_listing_open()
returns trigger language plpgsql security definer set search_path = public
as $$
declare l record;
begin
  if tg_op = 'UPDATE' and not (new.status = 'accepted' and old.status is distinct from 'accepted') then
    return new;
  end if;
  select status, due_date into l from public.listings where id = new.listing_id;
  if l.status = 'expired' or (l.status = 'published' and l.due_date is not null and l.due_date < public.today_ba()) then
    raise exception 'POSAO_ISTEKAO: rok za ovaj posao je prošao' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and l.status is distinct from 'published' then
    raise exception 'POSAO_ZATVOREN: ovaj posao više ne prima ponude' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists bids_listing_open_guard on public.bids;
create trigger bids_listing_open_guard
  before insert or update of status on public.bids
  for each row execute function public.guard_bid_listing_open();

-- Expire overdue open jobs and tell the owner. Runs every 15 minutes (below).
create or replace function public.expire_overdue_listings()
returns integer language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  with gone as (
    update public.listings set status = 'expired'
    where status = 'published' and due_date is not null and due_date < public.today_ba()
    returning id, user_id, title
  ), notified as (
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    select g.user_id, 'task_expired', 'Rok za tvoj posao je prošao',
           left(g.title, 120) || ' — izaberi novi datum i objavi ponovo da primaš ponude.',
           '/listings/' || g.id::text, 'expired:' || g.id::text
    from gone g
    returning 1
  )
  select count(*) into n from gone;
  return n;
end $$;

revoke execute on function public.expire_overdue_listings() from public, anon, authenticated;
revoke execute on function public.guard_bid_listing_open() from public, anon, authenticated;
revoke execute on function public.guard_listing_schedule() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-overdue-listings';
    perform cron.schedule('expire-overdue-listings', '*/15 * * * *', 'select public.expire_overdue_listings()');
  end if;
end $$;

select public.expire_overdue_listings();
