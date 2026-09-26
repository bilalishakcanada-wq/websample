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
  { test: /PONUDA_NA_SVOJ_OGLAS/i, poruka: 'Ne možeš slati ponudu na vlastiti posao.' },
  { test: /PONUDA_ZAKLJUCANA/i, poruka: 'Iznos i opis ponude može mijenjati samo izvođač koji ju je poslao.' },
  { test: /BID_STATUS_FORBIDDEN/i, poruka: 'Ponuda se prihvata dugmetom „Prihvati i plati“, uz osiguranu uplatu.' },
]

/** Vraća Error sa razumljivom porukom (i eventualno linkom), ili null. */
export function prepoznajGresku(error) {
  const tekst = `${error?.message || ''} ${error?.hint || ''} ${error?.details || ''}`
  const nadjena = POZNATE_GRESKE.find((g) => g.test.test(tekst))
  if (!nadjena) return null
  const e = new Error(nadjena.poruka)
  if (nadjena.akcija) e.akcija = nadjena.akcija
  return e
}
