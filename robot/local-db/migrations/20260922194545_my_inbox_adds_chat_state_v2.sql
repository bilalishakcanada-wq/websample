drop function if exists public.my_inbox();

create function public.my_inbox()
 returns table(id uuid, listing_id uuid, listing_title text, created_at timestamptz,
   other_id uuid, other_name text, other_avatar text, other_type text,
   last_message text, last_sender uuid, last_at timestamptz, unread bigint,
   saved boolean, archived boolean, contacts_allowed boolean, chat_state text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    c.id, c.listing_id, l.title, c.created_at,
    o.user_id, coalesce(pp.display_name, 'Korisnik Poso.ba'), pp.avatar_url, pp.account_type,
    lm.content, lm.sender_id, coalesce(lm.created_at, c.created_at),
    (select count(*) from public.messages m where m.conversation_id = c.id and m.receiver_id = auth.uid() and m.read_at is null),
    coalesce(cp.saved, false), coalesce(cp.archived, false),
    public.conversation_contacts_allowed(c.id),
    public.chat_state(c.id)
  from public.conversations c
  cross join lateral (select case when c.participant_one = auth.uid() then c.participant_two else c.participant_one end as user_id) o
  left join public.public_profiles pp on pp.user_id = o.user_id
  left join public.listings l on l.id = c.listing_id
  left join lateral (select m.content, m.sender_id, m.created_at from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
  left join public.conversation_prefs cp on cp.conversation_id = c.id and cp.user_id = auth.uid()
  where auth.uid() in (c.participant_one, c.participant_two)
  order by coalesce(lm.created_at, c.created_at) desc;
$function$;

grant execute on function public.my_inbox() to authenticated;;
