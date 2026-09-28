-- Stara verzija (7 argumenata) je ostala uz novu i zaobilazila je provjeru
-- kvaliteta slike i otisak dokumenta. Poziv na nju je bio potpuno legitiman put
-- oko svih novih provjera — briše se.
drop function if exists public.submit_identity(text, text, doc_kind, text, text, text, text);

select count(*)::text || ' verzija submit_identity' as stanje
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_identity';;
