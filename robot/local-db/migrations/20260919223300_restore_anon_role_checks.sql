-- RLS policies call these for anonymous readers too; they only look at auth.uid()
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_moderator() to anon, authenticated;
grant execute on function public.is_staff_user(uuid) to anon, authenticated;
grant execute on function public.i_bid_on(uuid) to anon, authenticated;;
