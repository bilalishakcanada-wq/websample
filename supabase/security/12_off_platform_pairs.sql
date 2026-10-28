-- Sumnjivi parovi: klijent i izvođač koji su se možda dogovorili van Zadatka (Admin → Nadzor → Sumnjivi parovi).
-- Samo čitanje, samo za osoblje (is_staff). Za svaki par klijent–izvođač broji tri znaka:
--   quick_cancels      posao između njih otkazan u roku od 48 h poslije uplate (kontakti su tada već otvoreni)
--   later_unhired      poslije zajedničkog posla klijent je objavio posao iste kategorije i zatvorio ga bez ikoga
--                      (otkazan ili istekao bez uplate): vjerovatno je istog izvođača zvao direktno
--   contact_attempts   pokušaji slanja kontakta (Pravilo #1) u njihovom razgovoru
-- Lista je trag za pregled, ne dokaz: admin otvara oba naloga i odlučuje.

create or replace function public.admin_suspicious_pairs(p_limit integer default 50)
returns table (
  client_id uuid, client_name text, client_member_id text,
  provider_id uuid, provider_name text, provider_member_id text,
  jobs_together bigint, completed_together bigint, quick_cancels bigint,
  later_unhired bigint, contact_attempts bigint, last_job_at timestamptz, score bigint
)
language sql stable security definer set search_path = public as $$
  with pairs as (
    select jp.client_id, jp.provider_id,
           count(*) as jobs_together,
           count(*) filter (where jp.work_state = 'completed') as completed_together,
           count(*) filter (where jp.work_state = 'cancelled' and jp.funded_at is not null
                              and coalesce(jp.refunded_at, now()) < jp.funded_at + interval '48 hours') as quick_cancels,
           max(jp.created_at) as last_job_at
    from public.job_payments jp
    where jp.client_id is not null and jp.provider_id is not null and jp.client_id <> jp.provider_id
    group by jp.client_id, jp.provider_id
  ),
  unhired as (
    select p.client_id, p.provider_id, count(distinct l2.id) as later_unhired
    from pairs p
    join public.job_payments jp on jp.client_id = p.client_id and jp.provider_id = p.provider_id and jp.work_state = 'completed'
    join public.listings l1 on l1.id = jp.listing_id
    join public.listings l2 on l2.user_id = p.client_id and l2.category = l1.category
                           and l2.created_at > coalesce(jp.released_at, jp.created_at)
                           and l2.status in ('cancelled', 'expired', 'archived')
    where not exists (select 1 from public.job_payments x where x.listing_id = l2.id)
    group by p.client_id, p.provider_id
  ),
  attempts as (
    select p.client_id, p.provider_id, count(e.id) as contact_attempts
    from pairs p
    join public.conversations c on (c.participant_one = p.client_id and c.participant_two = p.provider_id)
                                or (c.participant_one = p.provider_id and c.participant_two = p.client_id)
    join public.messages m on m.conversation_id = c.id
    join public.moderation_events e on e.source_id = m.id and e.source_table = 'messages' and not e.dismissed
    group by p.client_id, p.provider_id
  )
  select p.client_id, cp.full_name, cp.member_id,
         p.provider_id, pp.full_name, pp.member_id,
         p.jobs_together, p.completed_together, p.quick_cancels,
         coalesce(u.later_unhired, 0), coalesce(a.contact_attempts, 0), p.last_job_at,
         p.quick_cancels * 3 + coalesce(u.later_unhired, 0) * 2 + coalesce(a.contact_attempts, 0) as score
  from pairs p
  left join unhired u on u.client_id = p.client_id and u.provider_id = p.provider_id
  left join attempts a on a.client_id = p.client_id and a.provider_id = p.provider_id
  left join public.profiles cp on cp.user_id = p.client_id
  left join public.profiles pp on pp.user_id = p.provider_id
  where public.is_staff()
    and (p.quick_cancels > 0 or coalesce(u.later_unhired, 0) > 0 or coalesce(a.contact_attempts, 0) > 0)
  order by score desc, p.last_job_at desc
  limit greatest(1, least(p_limit, 200));
$$;

revoke execute on function public.admin_suspicious_pairs(integer) from public, anon;
grant execute on function public.admin_suspicious_pairs(integer) to authenticated;
