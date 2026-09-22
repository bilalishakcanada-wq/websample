-- ============================================================================
-- SIGURNOSNA ZAKRPA 02 — ograničenje učestalosti, idempotencija, detekcija anomalija
-- ----------------------------------------------------------------------------
-- VAŽNO O ARHITEKTURI: frontend razgovara DIREKTNO sa PostgREST-om. Nema Node
-- servisa u putanji zahtjeva. Zato rate limiting u Express/Next middlewareu ovdje
-- NE ŠTITI NIŠTA — napadač jednostavno zove api.supabase.co i zaobiđe ga.
-- Ograničenje mora biti tamo gdje zahtjev stvarno stiže: u bazi i na CDN-u.
-- ============================================================================

-- ------------------------------------------------- 2.1 Brojač po korisniku/akciji
create table if not exists public.rate_limits (
  bucket       text not null,          -- 'bid', 'payment', 'message', 'kyc_submit'
  subject      text not null,          -- user id (ili ip za neprijavljene)
  window_start timestamptz not null,
  hits         integer not null default 1,
  primary key (bucket, subject, window_start)
);

create index if not exists rate_limits_cleanup_idx on public.rate_limits (window_start);

-- Vraća broj preostalih pokušaja; puca kad se prekorači.
-- Atomično: ON CONFLICT DO UPDATE je jedan upis, pa 100 paralelnih poziva
-- ne može "prošvercati" 100 prolaza (isti razlog zbog kojeg escrow treba lock).
create or replace function public.rate_limit_hit(
  p_bucket text, p_limit integer, p_window interval default '1 minute', p_subject text default null
) returns integer
language plpgsql security definer set search_path = public as $fn$
declare v_subject text; v_start timestamptz; v_hits integer;
begin
  v_subject := coalesce(p_subject, auth.uid()::text, 'anon');
  v_start := date_trunc('second', now()) - (extract(epoch from now())::bigint % greatest(1, extract(epoch from p_window)::bigint)) * interval '1 second';

  insert into public.rate_limits (bucket, subject, window_start, hits)
  values (p_bucket, v_subject, v_start, 1)
  on conflict (bucket, subject, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  if v_hits > p_limit then
    raise exception 'PREVISE_ZAHTJEVA: % (dozvoljeno %/%)', p_bucket, p_limit, p_window
      using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return p_limit - v_hits;
end $fn$;

revoke execute on function public.rate_limit_hit(text, integer, interval, text) from anon, authenticated;

create or replace function public.rate_limits_cleanup() returns integer
language plpgsql security definer set search_path = public as $fn$
declare v integer;
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics v = row_count; return v;
end $fn$;

-- ---------------------------------------------------- 2.2 Idempotentni ključevi
-- Mreža prekine vezu nakon što je server primio zahtjev; klijent pošalje ponovo.
-- Bez ključa to je druga transakcija. Sa ključem, drugi poziv vrati prvi rezultat.
create table if not exists public.idempotency_keys (
  key         text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  operation   text not null,
  request_hash text not null,          -- isti ključ + drugi parametri = napad
  response    jsonb,
  state       text not null default 'in_progress' check (state in ('in_progress','done','failed')),
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idempotency_keys_user_idx on public.idempotency_keys (user_id, created_at desc);

alter table public.idempotency_keys enable row level security;
drop policy if exists idem_own on public.idempotency_keys;
create policy idem_own on public.idempotency_keys for select to authenticated using (user_id = auth.uid());

/* Upotreba u finansijskoj funkciji:

     v_cached := public.idempotency_begin(p_key, 'release_job_payment',
                   jsonb_build_object('listing_id', p_listing_id));
     if v_cached is not null then return v_cached; end if;   -- ponovljen zahtjev
     ... posao ...
     perform public.idempotency_finish(p_key, to_jsonb(v_row));
*/
create or replace function public.idempotency_begin(p_key text, p_operation text, p_request jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_row public.idempotency_keys; v_hash text;
begin
  if coalesce(trim(p_key), '') = '' then raise exception 'IDEMPOTENCY_KEY_OBAVEZAN'; end if;
  v_hash := encode(digest(p_request::text, 'sha256'), 'hex');

  select * into v_row from public.idempotency_keys where key = p_key for update;

  if v_row.key is null then
    insert into public.idempotency_keys (key, user_id, operation, request_hash)
    values (p_key, auth.uid(), p_operation, v_hash);
    return null;                                  -- prvi put: nastavi
  end if;

  if v_row.user_id <> auth.uid() then
    raise exception 'IDEMPOTENCY_TUDJI_KLJUC' using errcode = '42501';
  end if;
  if v_row.request_hash <> v_hash then            -- isti ključ, drugi parametri
    raise exception 'IDEMPOTENCY_KONFLIKT: ključ je već upotrijebljen za drugi zahtjev'
      using errcode = 'P0001';
  end if;
  if v_row.state = 'in_progress' then
    raise exception 'ZAHTJEV_U_TOKU: pokušaj ponovo za koji trenutak' using errcode = 'P0001';
  end if;
  return coalesce(v_row.response, '{}'::jsonb);   -- ponovljen: vrati stari odgovor
end $fn$;

create or replace function public.idempotency_finish(p_key text, p_response jsonb)
returns void
language sql security definer set search_path = public as $fn$
  update public.idempotency_keys
     set state = 'done', response = p_response, completed_at = now()
   where key = p_key;
$fn$;

-- ------------------------------------------ 2.3 Detekcija nemogućeg putovanja
-- Koristi postojeće session_log (user_id, ip, created_at) i ip_geo (ip, lat, lng).
create table if not exists public.security_alerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,               -- 'impossible_travel' | 'velocity' | 'new_country_payout'
  severity    smallint not null default 2, -- 1 info, 2 upozorenje, 3 blokada
  details     jsonb not null default '{}',
  state       text not null default 'open' check (state in ('open','reviewing','cleared','confirmed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists security_alerts_open_idx on public.security_alerts (state, created_at desc)
  where state in ('open','reviewing');

alter table public.security_alerts enable row level security;
drop policy if exists alerts_staff_read on public.security_alerts;
create policy alerts_staff_read on public.security_alerts for select to authenticated
  using (public.is_staff());

-- Brzina kretanja između zadnje dvije prijave. Preko 900 km/h = nije avion nego
-- dva različita čovjeka (ili VPN — zato je ovo signal za provjeru, ne presuda).
create or replace function public.check_impossible_travel(p_user uuid, p_ip inet)
returns public.security_alerts
language plpgsql security definer set search_path = public as $fn$
declare
  v_prev record; v_now record; v_km numeric; v_hours numeric; v_kmh numeric; v_alert public.security_alerts;
begin
  -- host() a NE p_ip::text: cast inet->text daje '2.2.2.2/32' i nikad se ne
  -- poklopi sa '2.2.2.2' u ip_geo. Bez ovoga kontrola tiho nikad ne okine.
  select g.lat, g.lng, g.country_code into v_now
    from public.ip_geo g where g.ip = host(p_ip);
  if v_now.lat is null then return null; end if;          -- nepoznat IP: bez signala

  select g.lat, g.lng, g.country_code, s.created_at into v_prev
    from public.session_log s
    join public.ip_geo g on g.ip = s.ip
   where s.user_id = p_user and s.ip <> host(p_ip) and g.lat is not null
   order by s.created_at desc limit 1;
  if v_prev.lat is null then return null; end if;         -- prva prijava: nema s čim porediti

  v_km := public.distance_km(v_prev.lat, v_prev.lng, v_now.lat, v_now.lng);
  v_hours := greatest(extract(epoch from (now() - v_prev.created_at)) / 3600.0, 0.0166);  -- min 1 minuta
  v_kmh := v_km / v_hours;

  if v_km < 100 or v_kmh < 900 then return null; end if;

  insert into public.security_alerts (user_id, kind, severity, details)
  values (p_user, 'impossible_travel', 3, jsonb_build_object(
    'km', round(v_km), 'sati', round(v_hours, 2), 'kmh', round(v_kmh),
    'iz', v_prev.country_code, 'u', v_now.country_code))
  returning * into v_alert;
  return v_alert;
end $fn$;

-- Kapija za osjetljive radnje: podizanje novca, promjena IBAN-a, KYC.
-- Ako postoji otvoren alarm ozbiljnosti 3, radnja se ne izvršava.
create or replace function public.require_no_open_block(p_user uuid default auth.uid())
returns void
language plpgsql stable security definer set search_path = public as $fn$
begin
  if exists (select 1 from public.security_alerts
              where user_id = p_user and severity >= 3 and state in ('open','reviewing')) then
    raise exception 'NALOG_NA_PROVJERI: sigurnosna provjera je u toku, kontaktiraj podršku'
      using errcode = '42501', hint = 'security_hold';
  end if;
end $fn$;
