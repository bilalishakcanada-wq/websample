alter table public.bids
  add constraint bids_bidder_id_fkey foreign key (bidder_id) references public.profiles(user_id) on delete cascade;

alter table public.reviews
  add constraint reviews_reviewer_id_fkey foreign key (reviewer_id) references public.profiles(user_id) on delete cascade,
  add constraint reviews_reviewee_id_fkey foreign key (reviewee_id) references public.profiles(user_id) on delete cascade,
  add constraint reviews_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete set null;;
