-- Registracije i aktivacija po sedmicama, za Admin → Rast.
-- Aktiviran = u prvih 7 dana od registracije objavio posao ili poslao ponudu.
-- Sve se računa iz postojećih tabela (auth.users, listings, bids): nema kolačića ni vanjskog servisa.
-- Samo admin.

create or replace function public.admin_growth(p_weeks int default 8)
returns table (
  week_start date,
  signups int,
  activated int,
  posted_job int,
  sent_offer int
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  with weeks as (
    select generate_series(
      date_trunc('week', now()) - make_interval(weeks => greatest(least(p_weeks, 52), 1) - 1),
      date_trunc('week', now()),
      interval '1 week'
    ) as ws
  ),
  people as (
    select
      u.id,
      date_trunc('week', u.created_at) as ws,
      exists (select 1 from public.listings l where l.user_id = u.id and l.created_at < u.created_at + interval '7 days') as job,
      exists (select 1 from public.bids b where b.bidder_id = u.id and b.created_at < u.created_at + interval '7 days') as offer
    from auth.users u
    where u.created_at >= date_trunc('week', now()) - make_interval(weeks => greatest(least(p_weeks, 52), 1) - 1)
  )
  select
    w.ws::date,
    count(p.id)::int,
    count(p.id) filter (where p.job or p.offer)::int,
    count(p.id) filter (where p.job)::int,
    count(p.id) filter (where p.offer)::int
  from weeks w
  left join people p on p.ws = w.ws
  group by w.ws
  order by w.ws desc;
end;
$$;

revoke all on function public.admin_growth(int) from public, anon;
grant execute on function public.admin_growth(int) to authenticated;
