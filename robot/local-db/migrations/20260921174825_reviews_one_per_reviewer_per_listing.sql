-- one review per person per job (keep the earliest if duplicates already exist)
delete from public.reviews r using public.reviews r2
 where r.listing_id is not null and r.listing_id = r2.listing_id and r.reviewer_id = r2.reviewer_id and r.created_at > r2.created_at;
create unique index if not exists reviews_listing_reviewer_uniq on public.reviews (listing_id, reviewer_id) where listing_id is not null;;
