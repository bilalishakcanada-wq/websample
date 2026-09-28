create or replace function public.check_listing_content()
returns trigger as $$
declare
  combined text;
begin
  combined := lower(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  if combined ~* '(pi[sš]tolj|pu[sš]k[ae]?|oru[zž]j[ae]|municij|granat[ae]|eksploziv|\mgun\M|firearm|\mpistol\M|\mrifle\M|ammunition|explosive|drog[aeu]|kokain|heroin|mari[hj]uana|kanabis|canabis|ecstasy|amfetamin|metamfetamin|cocaine)' then
    raise exception 'PROHIBITED_CONTENT: listing violates the content policy' using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function public.protect_profile_system_fields()
returns trigger as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    new.subscription_status = old.subscription_status;
    new.account_status = old.account_status;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;;
