create or replace function public.check_message_contact_info()
returns trigger as $$
declare
  conv record;
  has_accepted_bid boolean;
begin
  select listing_id, participant_one, participant_two into conv
  from public.conversations where id = new.conversation_id;

  if conv.listing_id is null then
    has_accepted_bid := true;
  else
    select exists(
      select 1 from public.bids
      where listing_id = conv.listing_id
        and status = 'accepted'
        and bidder_id in (conv.participant_one, conv.participant_two)
    ) into has_accepted_bid;
  end if;

  if not has_accepted_bid and new.content ~* '(\+?387[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4})|(\y0\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4}\y)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})' then
    raise exception 'CONTACT_INFO_BLOCKED: contact details can only be shared after a bid is accepted' using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

revoke execute on function public.check_message_contact_info() from public;;
