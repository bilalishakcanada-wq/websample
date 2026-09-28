-- Savjetnik "function_search_path_mutable": bez fiksnog search_path-a napadač koji
-- moze kreirati shemu ispred 'public' moze podmetnuti svoju funkciju istog imena.
-- Ovih pet su cisti pomocnici (bez pristupa podacima), ali pravilo treba vrijediti
-- svuda — jedan izuzetak je onaj koji se zaboravi.
alter function public.fold_text(text) set search_path = public, pg_temp;
alter function public.join_words(text[]) set search_path = public, pg_temp;
alter function public.distance_km(double precision, double precision, double precision, double precision) set search_path = public, pg_temp;
alter function public.coords_for_location(text) set search_path = public, pg_temp;
alter function public.search_tsquery(text) set search_path = public, pg_temp;

-- public_profiles NAMJERNO ostaje SECURITY DEFINER: to je kurirani javni prikaz
-- profila (RLS na profiles pusta samo vlastiti red, pa bi security_invoker ugasio
-- javne profile). Sigurnost se ovdje drzi izborom kolona, ne RLS-om — zato je
-- vazno da ovaj popis nikad ne dobije e-mail, telefon, balans ni tax_id.
comment on view public.public_profiles is
  'Javni prikaz profila (SECURITY DEFINER namjerno). NE dodavati email, phone, balance, tax_id, birth_date ni druge licne podatke.';;
