alter function public.display_name_of(text) set search_path = public;
alter function public.is_valid_full_name(text) set search_path = public;
alter function public.moderation_scan(text) set search_path = public;

-- trigger-only functions never need to be callable through the API
revoke execute on function public.handle_verification_approved() from public, anon, authenticated;

-- listing owners only (signed in); conversation checks are for participants
revoke execute on function public.match_providers_for_listing(uuid, integer) from public, anon;
revoke execute on function public.conversation_contacts_allowed(uuid) from public, anon;;
