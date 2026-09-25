# Verifikacija identiteta (JMBG + dokument)

Primijenjeno na produkciju 25.09.2026. Migracije: `jmbg_validation`,
`identity_verification_module_v2`, `identity_verification_rpcs`,
`normalize_person_name`, `identity_decide_cast_fix`, `identity_gate_on_jobs_and_bids`.

## Šta algoritam može, a šta ne

`jmbg_check(text)` provjerava **kontrolnu cifru, datum rođenja i šifru regije**
(BiH je 10–19) i iz broja izvodi datum rođenja, pol i regiju.

**Ne može potvrditi da osoba postoji** — u BiH ne postoji javni registar koji bi
privatna firma smjela pitati. Broj koji prođe algoritam je *moguć*, ne *stvaran*.
Da broj pripada baš toj osobi potvrđuje moderator poređenjem sa slikom dokumenta.

Testirano 11 slučajeva: četiri ispravna broja (Sarajevo, Mostar, Tuzla, Zenica) i
sedam neispravnih — pogrešna kontrolna cifra, strana regija, 32. dan, 13. mjesec,
datum u budućnosti, prekratak unos, slova. Svih 11 tačno.

## Kako se čuva JMBG

| | |
|---|---|
| sam broj | **šifrovan** (`pgp_sym_encrypt`, ključ u Supabase Vaultu) |
| čitanje običnim upitom | nemoguće — `revoke select (jmbg_enc)` |
| duplikati | preko **otiska** (sha256 + ključ), bez čitanja broja |
| izvedeno (datum, pol, regija) | otvoreno — treba za provjeru punoljetstva |
| otkrivanje moderatoru | samo kroz `identity_reveal()`, koja **uvijek** upiše ko je gledao |

Isti JMBG ne može biti odobren na dva naloga (jedinstveni indeks nad otiskom).

## Tok

```
korisnik popuni ime + JMBG + slika dokumenta
        │
        ▼  submit_identity()  ← odbija neispravan broj, maloljetne, bez slike
   stanje: submitted
        │
        ▼  identity_claim_next()  ← moderator preuzima (lease 15 min)
   stanje: in_review
        │
        ▼  identity_reveal()  ← otkriva broj + slike, ostavlja trag
        │
        ▼  identity_decide(odobri / odbij + razlog)
   approved ────▶ profil: identity_state='approved'
   rejected ────▶ korisnik dobije razlog i može poslati ponovo
```

Signali koje moderator dobija uz predmet (ne odbijaju, samo skreću pažnju):
ime se razlikuje od profila, isti broj već pokušan na drugom nalogu, neuobičajena
starost.

## Kapija

`identity_ok(user)` je tačno kad je identitet odobren **ili** je nalog stariji od
prelaznog roka **ili** je korisnik član tima.

Prekidači su u tabeli `verification_policy` (mijenja se samo migracijom):

| prekidač | zadano | značenje |
|---|---|---|
| `require_for_jobs` | ✅ | bez verifikacije se ne može objaviti posao |
| `require_for_bids` | ✅ | bez verifikacije se ne može poslati ponuda |
| `require_for_chat` | ❌ | dopisivanje ostaje otvoreno |
| `grandfather_before` | trenutak migracije | **postojeći nalozi su izuzeti** |

Provedeno dvostruko: RLS politika (`listings`, `bids`) i trigger koji daje jasnu
poruku `VERIFIKACIJA_POTREBNA` umjesto tihog RLS odbijanja.

Provjereno: novi nalog **ne može** ni objaviti posao ni poslati ponudu; postojeći
nalog radi normalno; poslije odobrenja novi nalog prolazi. 18/18 E2E prolazi.

## Zašto postojeći nalozi nisu zaključani

Bez `grandfather_before` platforma bi se preko noći zaključala svima — uključujući
vlasnika. Kad odlučite da svi moraju proći verifikaciju, pomjerite taj datum
naprijed (migracijom) i najavite korisnicima rok.

## Što još nije urađeno

Sučelje: forma za korisnika (`/account/verifikacija`) i ekran za moderatore.
Dok njih nema, RPC-ovi rade ali korisnik nema gdje unijeti podatke — zato su
prekidači postavljeni tako da **postojeći korisnici nisu pogođeni**.
