create or replace function public.admin_user_dossier(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_admin boolean := public.is_admin();
  v jsonb;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select jsonb_build_object(
    'viewer_is_admin', v_admin,
    'profile', (
      select jsonb_build_object(
        'user_id', p.user_id, 'member_id', p.member_id, 'full_name', p.full_name, 'display_name', public.display_name_of(p.full_name),
        'email', case when v_admin then p.email end, 'phone', case when v_admin then p.phone end, 'phone_verified_at', p.phone_verified_at,
        'city', p.city, 'bio', p.bio, 'avatar_url', p.avatar_url, 'account_type', p.account_type, 'account_status', p.account_status,
        'suspended_until', p.suspended_until, 'suspension_reason', p.suspension_reason, 'created_at', p.created_at, 'last_seen_at', p.last_seen_at,
        'onboarding_completed', p.onboarding_completed, 'trades', p.trades, 'verified_trade', p.verified_trade,
        'birth_date', case when v_admin then p.birth_date end,
        'tax_id_masked', case when v_admin and p.tax_id is not null then repeat('•', greatest(length(p.tax_id) - 4, 0)) || right(p.tax_id, 4) end,
        'languages', p.languages, 'transportation', p.transportation, 'education', p.education, 'work_experience', p.work_experience, 'specialties', p.specialties,
        'ai_assessment', p.ai_assessment, 'ai_assessed_at', p.ai_assessed_at
      ) from public.profiles p where p.user_id = p_user_id
    ),
    'auth', (
      select jsonb_build_object(
        'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed_at', u.email_confirmed_at,
        'phone', case when v_admin then u.phone end, 'phone_confirmed_at', u.phone_confirmed_at, 'banned_until', u.banned_until,
        'providers', (select coalesce(jsonb_agg(distinct i.provider), '[]'::jsonb) from auth.identities i where i.user_id = u.id)
      ) from auth.users u where u.id = p_user_id
    ),
    'registry', (select jsonb_build_object('deleted_at', r.deleted_at, 'deletion_note', r.deletion_note, 'email', case when v_admin then r.email end, 'full_name', r.full_name, 'created_at', r.created_at) from public.member_registry r where r.user_id = p_user_id),
    'roles', (select coalesce(jsonb_agg(r.name), '[]'::jsonb) from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p_user_id),
    'stats', jsonb_build_object(
      'listings', (select count(*) from public.listings where user_id = p_user_id),
      'listings_published', (select count(*) from public.listings where user_id = p_user_id and status = 'published'),
      'listings_completed', (select count(*) from public.listings where user_id = p_user_id and status = 'completed'),
      'listings_cancelled', (select count(*) from public.listings where user_id = p_user_id and status = 'cancelled'),
      'bids', (select count(*) from public.bids where bidder_id = p_user_id),
      'bids_accepted', (select count(*) from public.bids where bidder_id = p_user_id and status = 'accepted'),
      'jobs_completed', (select count(*) from public.bids b join public.listings l on l.id = b.listing_id where b.bidder_id = p_user_id and b.status = 'accepted' and l.status = 'completed'),
      'earnings_30d', coalesce((select public.provider_earnings_30d(p_user_id)), 0),
      'messages_sent', (select count(*) from public.messages where sender_id = p_user_id),
      'conversations', (select count(*) from public.conversations where participant_one = p_user_id or participant_two = p_user_id),
      'reviews_received', (select count(*) from public.reviews where reviewee_id = p_user_id),
      'avg_rating', (select round(avg(rating)::numeric, 2) from public.reviews where reviewee_id = p_user_id),
      'reviews_given', (select count(*) from public.reviews where reviewer_id = p_user_id),
      'strikes_30d', (select count(*) from public.moderation_events where user_id = p_user_id and action in ('masked', 'removed') and not dismissed and created_at > now() - interval '30 days'),
      'strikes_total', (select count(*) from public.moderation_events where user_id = p_user_id and action in ('masked', 'removed') and not dismissed),
      'suspensions', (select count(*) from public.moderation_events where user_id = p_user_id and action = 'suspended'),
      'support_messages', (select count(*) from public.support_messages where user_id = p_user_id and sender = 'user'),
      'reports_made', (select count(*) from public.reports where reporter_id = p_user_id),
      'reports_against', (select count(*) from public.reports r where r.target_id = p_user_id or r.target_id in (select id from public.listings where user_id = p_user_id)),
      'logins', (select count(*) from public.session_log where user_id = p_user_id),
      'distinct_ips', (select count(distinct ip) from public.session_log where user_id = p_user_id),
      'portfolio', (select count(*) from public.portfolio_items where user_id = p_user_id)
    ),
    'trust', (select to_jsonb(t) from public.trust_summary(p_user_id) t),
    'badges', (
      select coalesce(jsonb_agg(jsonb_build_object('code', b.code, 'label', b.label, 'description', b.description, 'icon', b.icon, 'kind', b.kind, 'color', b.color, 'awarded_at', ub.awarded_at, 'manual', ub.manual, 'note', ub.note) order by b.sort_order, ub.awarded_at desc), '[]'::jsonb)
      from public.user_badges ub join public.badges b on b.id = ub.badge_id where ub.user_id = p_user_id
    ),
    'verifications', (
      select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'kind', v.kind, 'licence_type', v.licence_type, 'trade', v.trade, 'status', v.status, 'document_url', case when v_admin then v.document_url end, 'created_at', v.created_at) order by v.created_at desc), '[]'::jsonb)
      from public.verification_requests v where v.user_id = p_user_id
    ),
    'moderation', (
      select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'action', e.action, 'source_table', e.source_table, 'kinds', e.kinds, 'fields', e.fields, 'snippet', e.snippet, 'dismissed', e.dismissed, 'created_at', e.created_at) order by e.created_at desc), '[]'::jsonb)
      from (select * from public.moderation_events where user_id = p_user_id order by created_at desc limit 60) e
    ),
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'ip', s.ip, 'user_agent', s.user_agent, 'created_at', s.created_at) order by s.created_at desc), '[]'::jsonb)
      from (select * from public.session_log where user_id = p_user_id order by created_at desc limit 50) s
    ),
    'active_sessions', (
      select coalesce(jsonb_agg(jsonb_build_object('ip', host(s.ip), 'user_agent', s.user_agent, 'created_at', s.created_at, 'refreshed_at', s.refreshed_at) order by s.refreshed_at desc nulls last), '[]'::jsonb)
      from auth.sessions s where s.user_id = p_user_id and (s.not_after is null or s.not_after > now())
    ),
    'shared_ips', (
      select coalesce(jsonb_agg(jsonb_build_object('ip', x.ip, 'user_id', x.user_id, 'full_name', pp.full_name, 'member_id', pp.member_id, 'account_status', pp.account_status)), '[]'::jsonb)
      from (
        select distinct o.ip, o.user_id
        from public.session_log o
        where o.user_id <> p_user_id and o.ip in (select ip from public.session_log where user_id = p_user_id and ip is not null)
        limit 20
      ) x left join public.profiles pp on pp.user_id = x.user_id
    ),
    'conversations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'listing_id', c.listing_id, 'listing_title', l.title,
        'partner_id', partner.user_id, 'partner_name', partner.full_name, 'partner_member', partner.member_id,
        'message_count', (select count(*) from public.messages m where m.conversation_id = c.id),
        'sent_by_user', (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id = p_user_id),
        'last_at', (select max(m.created_at) from public.messages m where m.conversation_id = c.id),
        'last_message', case when v_admin then (select m.content from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) end
      ) order by coalesce((select max(m.created_at) from public.messages m where m.conversation_id = c.id), c.created_at) desc), '[]'::jsonb)
      from public.conversations c
      left join public.listings l on l.id = c.listing_id
      left join public.profiles partner on partner.user_id = case when c.participant_one = p_user_id then c.participant_two else c.participant_one end
      where c.participant_one = p_user_id or c.participant_two = p_user_id
    ),
    'listings', (
      select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'status', l.status, 'category', l.category, 'location', l.location, 'price', l.price, 'created_at', l.created_at) order by l.created_at desc), '[]'::jsonb)
      from (select * from public.listings where user_id = p_user_id order by created_at desc limit 40) l
    ),
    'bids', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'amount', b.amount, 'status', b.status, 'message', left(b.message, 160), 'listing_id', b.listing_id, 'listing_title', l.title, 'created_at', b.created_at) order by b.created_at desc), '[]'::jsonb)
      from (select * from public.bids where bidder_id = p_user_id order by created_at desc limit 40) b left join public.listings l on l.id = b.listing_id
    ),
    'reviews_received', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'rating', r.rating, 'comment', r.comment, 'from_name', public.display_name_of(rp.full_name), 'from_id', r.reviewer_id, 'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.reviews where reviewee_id = p_user_id order by created_at desc limit 30) r left join public.profiles rp on rp.user_id = r.reviewer_id
    ),
    'reviews_given', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'rating', r.rating, 'comment', r.comment, 'to_name', public.display_name_of(rp.full_name), 'to_id', r.reviewee_id, 'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.reviews where reviewer_id = p_user_id order by created_at desc limit 30) r left join public.profiles rp on rp.user_id = r.reviewee_id
    ),
    'support', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'sender', s.sender, 'message', s.message, 'created_at', s.created_at) order by s.created_at desc), '[]'::jsonb)
      from (select * from public.support_messages where user_id = p_user_id order by created_at desc limit 40) s
    ),
    'reports_made', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason, 'status', r.status, 'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.reports where reporter_id = p_user_id order by created_at desc limit 30) r
    ),
    'reports_against', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason, 'status', r.status, 'created_at', r.created_at, 'reporter_name', public.display_name_of(rp.full_name)) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.reports x where x.target_id = p_user_id or x.target_id in (select id from public.listings where user_id = p_user_id) order by created_at desc limit 30) r
      left join public.profiles rp on rp.user_id = r.reporter_id
    ),
    'payout', (
      select case when v_admin then jsonb_build_object('holder_name', a.holder_name, 'bank_name', a.bank_name, 'iban_masked', left(a.iban, 4) || ' •••• •••• ' || right(a.iban, 4), 'billing_city', a.billing_city, 'created_at', a.created_at) end
      from public.payout_accounts a where a.user_id = p_user_id
    ),
    'notes', (
      select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'author_id', n.author_id, 'author_name', ap.full_name, 'created_at', n.created_at) order by n.created_at desc), '[]'::jsonb)
      from public.staff_notes n left join public.profiles ap on ap.user_id = n.author_id where n.user_id = p_user_id
    ),
    'staff_actions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'details', a.details, 'actor_id', a.actor_id, 'actor_name', ap.full_name, 'created_at', a.created_at) order by a.created_at desc), '[]'::jsonb)
      from (select * from public.staff_actions where target_user_id = p_user_id order by created_at desc limit 40) a left join public.profiles ap on ap.user_id = a.actor_id
    )
  ) into v;
  return v;
end;
$$;

drop policy if exists moderation_events_staff_select on public.moderation_events;
create policy moderation_events_staff_select on public.moderation_events for select using (public.is_staff());
drop policy if exists moderation_events_staff_update on public.moderation_events;
create policy moderation_events_staff_update on public.moderation_events for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists moderation_queue_staff_select on public.moderation_queue;
create policy moderation_queue_staff_select on public.moderation_queue for select using (public.is_staff());
drop policy if exists reports_staff_select on public.reports;
create policy reports_staff_select on public.reports for select using (public.is_staff());
drop policy if exists reports_staff_update on public.reports;
create policy reports_staff_update on public.reports for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists support_messages_admin_insert on public.support_messages;
create policy support_messages_admin_insert on public.support_messages for insert with check (public.is_staff() and sender = 'admin');
drop policy if exists support_messages_admin_update on public.support_messages;
create policy support_messages_admin_update on public.support_messages for update using (public.is_staff()) with check (public.is_staff());

create or replace function public.staff_overview()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_staff() then jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'online_now', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
    'suspended', (select count(*) from public.profiles where account_status = 'suspended'),
    'listings_open', (select count(*) from public.listings where status = 'published'),
    'listings_completed', (select count(*) from public.listings where status = 'completed'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'support_unread', (select count(*) from public.support_messages where sender = 'user' and read_at is null),
    'strikes_24h', (select count(*) from public.moderation_events where action in ('masked', 'removed') and not dismissed and created_at > now() - interval '24 hours'),
    'messages_24h', (select count(*) from public.messages where created_at > now() - interval '24 hours'),
    'logins_24h', (select count(*) from public.session_log where created_at > now() - interval '24 hours')
  ) end;
$$;;
