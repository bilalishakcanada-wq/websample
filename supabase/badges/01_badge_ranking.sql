-- ============================================================================
-- Rangiranje znački: nivo (bronza / srebro / zlato / platina), težina 10–100,
-- uputa kako se otključava, nove značke za rad na platformi, i proslava
-- (obavijest + push) kad sistem sam dodijeli značku.
--
--  * badges.tier_level 1–4 i badges.weight_score 0–100: profil pokazuje 5 najtežih.
--  * badges.unlock_hint: tekst za zaključanu značku u trezoru ("Kako je dobiti").
--  * Nove značke (kodovi postojećih se NE mijenjaju — uslovi posla ih koriste):
--      email_verified  E-mail potvrđen          bronza  10
--      jobs_5          Prvih 5 poslova          bronza  12
--      jobs_50         Iskusni izvođač (50)     platina 88
--      five_star_50    Čistih 5 zvjezdica (50+) platina 100
--  * set_badge: kad sistem prvi put dodijeli značku aktivnosti, korisnik dobija
--    obavijest "Nova značka", a postojeći okidač na notifications šalje push.
--    Jednom po znački (dedupe_key 'badge:<kod>'), da značka koja dolazi i odlazi
--    ne šalje obavijest svaki put. Identitet i licence već imaju svoju obavijest.
--  * my_badge_vault(): trezor samo za vlasnika — sve značke, osvojene i zaključane,
--    s napretkom (npr. 7 / 10 poslova). Prvo osvježi vlasnikove automatske značke.
--  * Na kraju tiho (bez obavijesti) dodijeli nove značke postojećim korisnicima.
--
-- Ne zavisi od drugih novih fajlova. Idempotentno: smije se pokrenuti više puta.
-- Na živoj bazi od 2026-10-05 (u dijelovima: badge_ranking_columns … badge_ranking_backfill).
-- ============================================================================

-- 1. Nivo, težina, uputa ------------------------------------------------------
alter table public.badges
  add column if not exists tier_level smallint not null default 1,
  add column if not exists weight_score integer not null default 30,
  add column if not exists unlock_hint text;
alter table public.badges drop constraint if exists badges_tier_level_check;
alter table public.badges add constraint badges_tier_level_check check (tier_level between 1 and 4);
alter table public.badges drop constraint if exists badges_weight_score_check;
alter table public.badges add constraint badges_weight_score_check check (weight_score between 0 and 100);

insert into public.badges (code, label, description, icon, kind, sort_order) values
  ('email_verified', 'E-mail potvrđen', 'E-mail adresa potvrđena linkom iz poruke.', 'mail', 'identity', 10),
  ('jobs_5', 'Prvih 5 poslova', '5 završenih poslova na Zadatku.', 'thumbs-up', 'activity', 30),
  ('jobs_50', 'Iskusni izvođač', '50 završenih poslova na Zadatku.', 'rocket', 'activity', 30),
  ('five_star_50', 'Čistih 5 zvjezdica', '50+ recenzija, i svaka je 5 zvjezdica.', 'sparkles', 'activity', 30)
on conflict (code) do nothing;

update public.badges b set tier_level = v.tier, weight_score = v.weight, unlock_hint = v.hint
from (values
  -- platina (85–100)
  ('five_star_50',         4, 100, 'Skupi 50 recenzija, i to sve od 5 zvjezdica.'),
  ('id_verified',          4,  95, 'Slikaj ličnu kartu ili pasoš u Moj nalog → Značke. Tim provjerava da li se slaže s profilom.'),
  ('verified',             4,  90, 'Potvrdi identitet i struku kod Zadatak tima.'),
  ('jobs_50',              4,  88, 'Završi 50 poslova kao izvođač.'),
  -- zlato (60–84)
  ('licence_electrician',  3,  80, 'Priloži važeću elektroinstalatersku licencu u Moj nalog → Značke.'),
  ('licence_plumber',      3,  80, 'Priloži važeću vodoinstalatersku licencu u Moj nalog → Značke.'),
  ('licence_gas',          3,  80, 'Priloži važeću plinsku licencu u Moj nalog → Značke.'),
  ('licence_hvac',         3,  80, 'Priloži važeću licencu za klimatizaciju i grijanje u Moj nalog → Značke.'),
  ('licence_construction', 3,  80, 'Priloži važeću građevinsku licencu u Moj nalog → Značke.'),
  ('licence_driver',       3,  78, 'Priloži važeću vozačku dozvolu u Moj nalog → Značke.'),
  ('police_check',         3,  76, 'Priloži važeće uvjerenje o nekažnjavanju (MUP / sud) u Moj nalog → Značke.'),
  ('top_rated',            3,  74, 'Skupi 10+ recenzija s prosjekom 4.8 ili više.'),
  ('flawless',             3,  72, 'Završi 10 poslova bez ijednog otkazivanja s tvoje strane.'),
  ('veteran',              3,  68, 'Budi član duže od godinu dana i završi 20+ poslova.'),
  ('majstor_mjeseca',      3,  65, 'Zadatak tim je dodjeljuje najbolje ocijenjenom izvođaču u mjesecu.'),
  -- srebro (30–59)
  ('local_hero',           2,  55, 'Završi 10 poslova u istom gradu.'),
  ('founder',              2,  50, 'Samo za prvih 100 članova Zadatka. Više se ne može dobiti.'),
  ('reliable',             2,  45, 'Neka bar 3 tvoje ponude budu prihvaćene i 80% prihvaćenih završi bez povlačenja.'),
  ('trusted_client',       2,  45, 'Kao klijent završi 5 poslova i ostavi bar 3 recenzije.'),
  ('payment_verified',     2,  40, 'Dodaj IBAN za primanje uplata u Moj nalog → Načini plaćanja.'),
  ('fast_responder',       2,  35, 'Odgovaraj na poruke u prosjeku za manje od 1 sat (bar 3 odgovora).'),
  ('rising_talent',        2,  30, 'U prvih 30 dana dobij 1–9 recenzija s prosjekom 4.5 ili više.'),
  -- bronza (10–29)
  ('mobile_verified',      1,  15, 'Potvrdi broj telefona SMS kodom u Moj nalog → Značke.'),
  ('jobs_5',               1,  12, 'Završi 5 poslova kao izvođač.'),
  ('email_verified',       1,  10, 'Klikni link iz e-maila koji ti je Zadatak poslao pri registraciji.')
) as v(code, tier, weight, hint)
where b.code = v.code;

-- 2. Dodjela + proslava ---------------------------------------------------------
-- Ista potpisna linija kao prije; samo dodaje obavijest kad je značka aktivnosti nova.
-- Tihi način (zadatak.badge_quiet = on) koristi samo jednokratno popunjavanje ispod.
create or replace function public.set_badge(p_user_id uuid, p_code text, p_award boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_badge public.badges%rowtype;
  v_added integer;
begin
  if p_award then
    select * into v_badge from public.badges where code = p_code;
    if v_badge.id is null then return; end if;
    insert into public.user_badges (user_id, badge_id) values (p_user_id, v_badge.id)
    on conflict do nothing;
    get diagnostics v_added = row_count;
    if v_added > 0
       and v_badge.kind = 'activity'
       and coalesce(current_setting('zadatak.badge_quiet', true), '') <> 'on'
       and not exists (select 1 from public.notifications
                       where user_id = p_user_id and dedupe_key = 'badge:' || p_code) then
      insert into public.notifications (user_id, type, title, message, link, dedupe_key)
      values (p_user_id, 'badge', '🏆 Nova značka: ' || v_badge.label,
              coalesce(v_badge.description, 'Osvojio/la si novu značku.') || ' Vidi se na tvom profilu.',
              '/account/znacke', 'badge:' || p_code);
    end if;
  else
    delete from public.user_badges ub using public.badges b
    where ub.badge_id = b.id and b.code = p_code and ub.user_id = p_user_id and ub.manual = false;
  end if;
end;
$$;
revoke execute on function public.set_badge(uuid, text, boolean) from public, anon, authenticated;

-- 3. Automatske značke: sve dosadašnje + e-mail, 5 i 50 poslova, čistih 5 zvjezdica ----
create or replace function public.refresh_user_badges(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_avg numeric;
  v_min integer;
  v_count bigint;
  v_joined timestamptz;
  v_accepted bigint;
  v_resolved bigint;
  v_resp_count bigint;
  v_resp_avg numeric;
  v_completed bigint;
  v_failed bigint;
  v_city_max bigint;
  v_rank bigint;
  v_client_done bigint;
  v_reviews_given bigint;
  v_email boolean;
begin
  select avg(rating), min(rating), count(*) into v_avg, v_min, v_count
  from public.reviews where reviewee_id = p_user_id;

  select created_at into v_joined from public.profiles where user_id = p_user_id;

  select count(*) filter (where status = 'accepted'),
         count(*) filter (where status in ('accepted','rejected','withdrawn'))
    into v_accepted, v_resolved
  from public.bids where bidder_id = p_user_id;

  select count(*) filter (where l.status = 'completed'),
         count(*) filter (where l.status = 'cancelled' and l.cancel_reason = 'provider')
    into v_completed, v_failed
  from public.bids b join public.listings l on l.id = b.listing_id
  where b.bidder_id = p_user_id and b.status = 'accepted';

  select coalesce(max(n), 0) into v_city_max from (
    select count(*) as n
    from public.bids b join public.listings l on l.id = b.listing_id
    where b.bidder_id = p_user_id and b.status = 'accepted' and l.status = 'completed' and l.location is not null
    group by public.city_key(l.location)
  ) c;

  select count(*) + 1 into v_rank from public.profiles where created_at < v_joined;

  select count(*) into v_client_done from public.listings where user_id = p_user_id and status = 'completed';
  select count(*) into v_reviews_given from public.reviews where reviewer_id = p_user_id;

  select count(*), avg(response_minutes) into v_resp_count, v_resp_avg
  from (
    select extract(epoch from (m.created_at - lag(m.created_at) over (partition by m.conversation_id order by m.created_at))) / 60 as response_minutes,
           m.sender_id,
           lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender
    from public.messages m
    where m.conversation_id in (select conversation_id from public.messages where sender_id = p_user_id)
  ) pairs
  where sender_id = p_user_id and prev_sender is not null and prev_sender <> p_user_id;

  select email_confirmed_at is not null into v_email from auth.users where id = p_user_id;

  perform public.set_badge(p_user_id, 'top_rated',      coalesce(v_count,0) >= 10 and coalesce(v_avg,0) >= 4.8);
  perform public.set_badge(p_user_id, 'rising_talent',  v_joined > now() - interval '30 days' and coalesce(v_count,0) between 1 and 9 and coalesce(v_avg,0) >= 4.5);
  perform public.set_badge(p_user_id, 'reliable',       coalesce(v_accepted,0) >= 3 and coalesce(v_resolved,0) > 0 and v_accepted::numeric / v_resolved >= 0.8);
  perform public.set_badge(p_user_id, 'fast_responder', coalesce(v_resp_count,0) >= 3 and coalesce(v_resp_avg, 9999) <= 60);
  perform public.set_badge(p_user_id, 'flawless',       coalesce(v_completed,0) >= 10 and coalesce(v_failed,0) = 0);
  perform public.set_badge(p_user_id, 'local_hero',     v_city_max >= 10);
  perform public.set_badge(p_user_id, 'veteran',        v_joined <= now() - interval '365 days' and coalesce(v_completed,0) >= 20);
  perform public.set_badge(p_user_id, 'trusted_client', v_client_done >= 5 and v_reviews_given >= 3);
  perform public.set_badge(p_user_id, 'jobs_5',         coalesce(v_completed,0) >= 5);
  perform public.set_badge(p_user_id, 'jobs_50',        coalesce(v_completed,0) >= 50);
  perform public.set_badge(p_user_id, 'five_star_50',   coalesce(v_count,0) >= 50 and v_min = 5);
  perform public.set_badge(p_user_id, 'email_verified', coalesce(v_email, false));
  -- founder is permanent: only ever awarded, never revoked
  if v_rank <= 100 then
    perform public.set_badge(p_user_id, 'founder', true);
  end if;
end;
$$;
revoke execute on function public.refresh_user_badges(uuid) from public, anon, authenticated;

-- E-mail značka dolazi pri sljedećem osvježavanju (otvaranje trezora, posao, recenzija).
-- Okidač na auth.users namjerno nije dodan: Supabase alat ga ne može postaviti na živoj bazi.

-- 4. Trezor (samo vlasnik) --------------------------------------------------------
create or replace function public.my_badge_vault()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_completed bigint;
  v_failed bigint;
  v_count bigint;
  v_avg numeric;
  v_min integer;
  v_city_max bigint;
  v_client_done bigint;
  v_reviews_given bigint;
  v_days integer;
  v_progress jsonb;
begin
  if v_uid is null then raise exception 'Prijavi se.' using errcode = '42501'; end if;

  perform public.refresh_user_badges(v_uid);

  select count(*) filter (where l.status = 'completed'),
         count(*) filter (where l.status = 'cancelled' and l.cancel_reason = 'provider')
    into v_completed, v_failed
  from public.bids b join public.listings l on l.id = b.listing_id
  where b.bidder_id = v_uid and b.status = 'accepted';
  select count(*), avg(rating), min(rating) into v_count, v_avg, v_min from public.reviews where reviewee_id = v_uid;
  select coalesce(max(n), 0) into v_city_max from (
    select count(*) as n
    from public.bids b join public.listings l on l.id = b.listing_id
    where b.bidder_id = v_uid and b.status = 'accepted' and l.status = 'completed' and l.location is not null
    group by public.city_key(l.location)
  ) c;
  select count(*) into v_client_done from public.listings where user_id = v_uid and status = 'completed';
  select count(*) into v_reviews_given from public.reviews where reviewer_id = v_uid;
  select greatest(0, (now()::date - created_at::date)) into v_days from public.profiles where user_id = v_uid;

  -- napredak za značke koje se broje: current / target (+ kratka napomena)
  v_progress := jsonb_build_object(
    'jobs_5',         jsonb_build_object('current', v_completed, 'target', 5, 'unit', 'poslova'),
    'jobs_50',        jsonb_build_object('current', v_completed, 'target', 50, 'unit', 'poslova'),
    'flawless',       jsonb_build_object('current', case when v_failed > 0 then 0 else v_completed end, 'target', 10, 'unit', 'poslova bez otkazivanja'),
    'veteran',        jsonb_build_object('current', v_completed, 'target', 20, 'unit', 'poslova', 'days', v_days, 'days_target', 365),
    'local_hero',     jsonb_build_object('current', v_city_max, 'target', 10, 'unit', 'poslova u jednom gradu'),
    'top_rated',      jsonb_build_object('current', v_count, 'target', 10, 'unit', 'recenzija', 'avg', round(coalesce(v_avg, 0), 2), 'avg_target', 4.8),
    'five_star_50',   jsonb_build_object('current', case when coalesce(v_min, 5) = 5 then v_count else 0 end, 'target', 50, 'unit', 'recenzija od 5 zvjezdica'),
    'trusted_client', jsonb_build_object('current', v_client_done, 'target', 5, 'unit', 'završenih poslova kao klijent', 'reviews', v_reviews_given, 'reviews_target', 3)
  );

  return jsonb_build_object(
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', b.code, 'label', b.label, 'description', b.description, 'icon', b.icon, 'color', b.color,
               'kind', b.kind, 'tier_level', b.tier_level, 'weight_score', b.weight_score, 'unlock_hint', b.unlock_hint,
               'earned', ub.user_id is not null, 'awarded_at', ub.awarded_at, 'progress', v_progress -> b.code)
             order by (ub.user_id is not null) desc, b.weight_score desc, b.label)
      from public.badges b
      left join public.user_badges ub on ub.badge_id = b.id and ub.user_id = v_uid
      -- ručne posebne značke (custom) prikaži samo kad su osvojene
      where b.kind <> 'custom' or ub.user_id is not null
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.my_badge_vault() from public, anon;
grant execute on function public.my_badge_vault() to authenticated;

-- 5. Jednokratno: dodijeli nove značke postojećim članovima, bez obavijesti ---------
do $$
declare r record;
begin
  perform set_config('zadatak.badge_quiet', 'on', true);
  for r in select user_id from public.profiles where account_status = 'active' loop
    perform public.refresh_user_badges(r.user_id);
  end loop;
end;
$$;
