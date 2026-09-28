-- Tab "Identitet" je tražio brojač identity_pending koji nije postojao, pa se
-- značka nikad nije prikazivala — moderator nije imao znak da ga red čeka.
create or replace function public.staff_overview()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when public.is_staff() then jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'online_now', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
    'suspended', (select count(*) from public.profiles where account_status = 'suspended'),
    'listings_open', (select count(*) from public.listings where status = 'published'),
    'listings_completed', (select count(*) from public.listings where status = 'completed'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'identity_pending', (select count(*) from public.identity_verifications where state in ('submitted','in_review')),
    'identity_risky', (select count(*) from public.identity_verifications where state in ('submitted','in_review') and risk_score >= 40),
    'support_unread', (select count(*) from public.support_messages where sender = 'user' and read_at is null),
    'strikes_24h', (select count(*) from public.moderation_events where action in ('masked', 'removed') and not dismissed and created_at > now() - interval '24 hours'),
    'messages_24h', (select count(*) from public.messages where created_at > now() - interval '24 hours'),
    'logins_24h', (select count(*) from public.session_log where created_at > now() - interval '24 hours')
  ) end;
$function$;;
