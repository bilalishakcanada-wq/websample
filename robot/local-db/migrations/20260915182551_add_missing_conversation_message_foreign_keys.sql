alter table public.conversations
  add constraint conversations_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete cascade,
  add constraint conversations_participant_one_fkey foreign key (participant_one) references public.profiles(user_id) on delete cascade,
  add constraint conversations_participant_two_fkey foreign key (participant_two) references public.profiles(user_id) on delete cascade;

alter table public.messages
  add constraint messages_conversation_id_fkey foreign key (conversation_id) references public.conversations(id) on delete cascade,
  add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles(user_id) on delete cascade,
  add constraint messages_receiver_id_fkey foreign key (receiver_id) references public.profiles(user_id) on delete cascade;;
