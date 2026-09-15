-- Fixes silent PostgREST embed failures (400 errors) caused by missing FKs.
-- bids.bidder_id, reviews.reviewer_id/reviewee_id, conversations.*, messages.*
-- and profiles.user_id had no foreign key constraints at all, so
-- `!table_fkey(...)` embed hints used across the app services could never
-- resolve. bidService/reviewService masked this with a fallback double-query;
-- messageService had no fallback, so the Messages page would hard-fail as
-- soon as any conversation existed.

alter table public.bids
  add constraint bids_bidder_id_fkey foreign key (bidder_id) references public.profiles(user_id) on delete cascade;

alter table public.reviews
  add constraint reviews_reviewer_id_fkey foreign key (reviewer_id) references public.profiles(user_id) on delete cascade,
  add constraint reviews_reviewee_id_fkey foreign key (reviewee_id) references public.profiles(user_id) on delete cascade,
  add constraint reviews_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete set null;

alter table public.conversations
  add constraint conversations_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete cascade,
  add constraint conversations_participant_one_fkey foreign key (participant_one) references public.profiles(user_id) on delete cascade,
  add constraint conversations_participant_two_fkey foreign key (participant_two) references public.profiles(user_id) on delete cascade;

alter table public.messages
  add constraint messages_conversation_id_fkey foreign key (conversation_id) references public.conversations(id) on delete cascade,
  add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles(user_id) on delete cascade,
  add constraint messages_receiver_id_fkey foreign key (receiver_id) references public.profiles(user_id) on delete cascade;

-- profiles.user_id never referenced auth.users(id), so deleting a user
-- (e.g. via the admin dashboard) left an orphaned profile row forever.
alter table public.profiles
  add constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
