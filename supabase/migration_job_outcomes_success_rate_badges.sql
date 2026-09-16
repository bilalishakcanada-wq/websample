-- Job outcomes (completed / cancelled), provider success rate, ranking functions on display_name, special badges.
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status = any (array['draft','published','paused','closed','archived','completed','cancelled']));
alter table public.listings add column if not exists completed_at timestamptz;
alter table public.listings add column if not exists cancelled_at timestamptz;
alter table public.listings add column if not exists cancel_reason text
  check (cancel_reason is null or cancel_reason in ('provider','client','other'));

create or replace function public.stamp_listing_outcome() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now()); new.cancelled_at := null; new.cancel_reason := null;
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now()); new.cancel_reason := coalesce(new.cancel_reason, 'other');
  end if;
  return new;
end; $$;
revoke execute on function public.stamp_listing_outcome() from public, anon, authenticated;
drop trigger if exists stamp_listing_outcome_trigger on public.listings;
create trigger stamp_listing_outcome_trigger before update of status on public.listings for each row execute function public.stamp_listing_outcome();

-- provider_metrics(): adds display_name, account_type, completed_jobs, failed_jobs, success_rate (drops full_name/display_uid)
-- ranked_providers(), match_providers_for_listing(), trust_summary(): rewritten on top of it
-- (full bodies: see Supabase migration "job_outcomes_success_rate_badges")

insert into public.badges (code, label, description, icon) values
  ('founder',        'Osnivački član',  'Među prvih 100 korisnika Poso.ba. Trajna oznaka.', 'crown'),
  ('flawless',       'Bez greške',      '10+ završenih poslova i 100% uspješnost.', 'gem'),
  ('local_hero',     'Lokalni heroj',   '10+ završenih poslova u istom gradu.', 'map-pinned'),
  ('veteran',        'Veteran',         'Više od godinu dana na platformi i 20+ završenih poslova.', 'medal'),
  ('trusted_client', 'Pouzdan klijent', '5+ završenih poslova kao klijent i redovno ostavlja recenzije.', 'handshake')
on conflict (code) do update set label = excluded.label, description = excluded.description, icon = excluded.icon;

-- refresh_user_badges(uuid): re-evaluates top_rated, rising_talent, reliable, fast_responder,
-- flawless, local_hero, veteran, trusted_client; founder is awarded once (rank <= 100) and never revoked.
-- set_badge(uuid, text, boolean): award/revoke helper.
-- Triggers: listing_outcome_refresh_badges (listings status -> completed/cancelled) and
-- profile_created_badges (after insert on profiles).
