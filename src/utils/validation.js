export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export const isStrongPassword = (value) => {
  if (!value || value.length < 8) return false
  return /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value)
}

export const sanitizeText = (value) => String(value ?? '').trim()

export const publicError = () => new Error('Zahtjev nije moguće obraditi. Pokušajte ponovo.')

/**
 * Greške koje baza namjerno šalje korisniku. Bez ovoga sve završi u generičkom
 * "pokušajte ponovo", pa korisnik ne zna ni šta je pogriješio ni šta da uradi.
 * `akcija` daje sučelju link na kojem se problem rješava.
 */
const POZNATE_GRESKE = [
  {
    test: /VERIFIKACIJA_POTREBNA|identity_required/i,
    poruka: 'Prije ovoga treba potvrditi identitet — provjera traje obično do 24 sata.',
    akcija: { tekst: 'Potvrdi identitet', href: '/account/verifikacija' },
  },
  { test: /SUSPENDED|is_suspended/i, poruka: 'Nalog je privremeno suspendovan, pa ova radnja nije moguća.' },
  { test: /CHAT_JOS_NIJE_OTVOREN/i, poruka: 'Dopisivanje počinje kada klijent prihvati ponudu i osigura uplatu.' },
  { test: /CHAT_JE_ZAKLJUCAN/i, poruka: 'Posao je namiren — prepiska ostaje samo za čitanje.' },
  { test: /NISI_UCESNIK_RAZGOVORA/i, poruka: 'Nemaš pristup ovom razgovoru.' },
  { test: /ROK_U_PROSLOSTI/i, poruka: 'Datum je već prošao — odaberi današnji ili neki kasniji dan.' },
  { test: /POSAO_ISTEKAO/i, poruka: 'Rok za ovaj posao je prošao. Vlasnik ga mora objaviti ponovo s novim datumom.' },
  { test: /POSAO_ZATVOREN/i, poruka: 'Ovaj posao više ne prima ponude.' },
  {
    test: /PREDALEKO/i,
    // "PREDALEKO: udaljen/a si 56 km, a za ovaj posao ponude mogu slati izvođači do 15 km"
    poruka: (tekst) => {
      const detalj = (tekst.match(/PREDALEKO:\s*([^\n]+?)(?:\s{2,}|$)/) || [])[1]
      return `Predaleko si za ovaj posao${detalj ? ` — ${detalj.trim()}` : ''}. Što je posao bolje plaćen (ili klijent plaća put), to izdaleka se mogu slati ponude.`
    },
  },
  {
    test: /GRAD_POTREBAN/i,
    poruka: 'Dodaj svoj grad u profil — po njemu vidimo koliko si daleko od posla.',
    akcija: { tekst: 'Dodaj grad', href: '/account/profil' },
  },
]

/** Vraća Error sa razumljivom porukom (i eventualno linkom), ili null. */
export function prepoznajGresku(error) {
  const tekst = `${error?.message || ''} ${error?.hint || ''} ${error?.details || ''}`
  const nadjena = POZNATE_GRESKE.find((g) => g.test.test(tekst))
  if (!nadjena) return null
  const e = new Error(typeof nadjena.poruka === 'function' ? nadjena.poruka(tekst) : nadjena.poruka)
  if (nadjena.akcija) e.akcija = nadjena.akcija
  return e
}
