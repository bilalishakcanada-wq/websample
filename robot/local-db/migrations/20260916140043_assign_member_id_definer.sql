create or replace function public.assign_member_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.member_id is null then
    new.member_id := public.generate_member_id();
  end if;
  return new;
end;
$$;
revoke execute on function public.assign_member_id() from public, anon, authenticated;;
