/**
 * Šta je sljedeći korak na poslu, za onoga ko ga gleda. Jedno mjesto za stranicu posla
 * (telefon i računar) i kartice u „Moji poslovi“, da svuda piše isto i da je dugme ono pravo.
 *
 * action: šta dugme radi (stranica posla ga pretvara u radnju):
 *   'offers' (pogledaj ponude) · 'approve' (odobri i isplati) · 'submit' (predaj rad)
 *   'review' (ostavi recenziju) · 'workflow' (otvori tok posla) · 'messages' · 'repost' · 'reschedule'
 */
const km = (value) => {
  const amount = Number(value || 0)
  return `${amount.toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })} KM`
}
const ponude = (count) => `${count} ${count === 1 ? 'ponudu' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'ponude' : 'ponuda'}`

/** Stanje ugovora kad postoji uplata: work_state iz baze, a stari redovi bez njega po statusu novca. */
export const workStateOf = (payment) => {
  if (!payment) return null
  if (payment.status === 'released') return 'completed'
  if (payment.status === 'refunded') return 'cancelled'
  if (payment.status === 'disputed') return 'disputed'
  return payment.work_state || (payment.status === 'requested' ? 'submitted' : 'in_progress')
}

/** Klijentova strana. `pending` = broj ponuda koje čekaju odgovor. */
export function clientStep({ listing, payment = null, pending = 0, hasWorker = false, expired = false, reviewed = false, cancelByMe = null }) {
  const state = workStateOf(payment)
  if (listing.status === 'completed' || state === 'completed') {
    return reviewed
      ? { tone: 'done', title: 'Posao je završen', text: 'Hvala na recenziji.' }
      : { tone: 'act', title: 'Posao je završen', text: 'Ostavi recenziju izvođaču, pomaže drugima da izaberu.', action: 'review', cta: 'Ostavi recenziju', short: 'Ostavi recenziju' }
  }
  if (listing.status === 'cancelled' || state === 'cancelled') return { tone: 'off', title: 'Posao je otkazan', text: payment ? `${km(payment.amount)} je vraćeno na tvoj balans.` : 'Možeš ga objaviti ponovo kad želiš.', action: 'repost', cta: 'Objavi ponovo', short: 'Otkazan' }
  if (expired) return { tone: 'act', title: 'Rok je prošao', text: 'Posao ne prima ponude. Izaberi novi datum i ponude ponovo stižu.', action: 'reschedule', cta: 'Izaberi novi datum', short: 'Izaberi novi datum' }
  if (state === 'submitted') return { tone: 'act', title: 'Izvođač je predao rad', text: 'Pregledaj ga i odobri isplatu ili traži ispravku. Ako ne odgovoriš za 72 sata, isplata ide automatski.', action: 'approve', cta: 'Odobri i isplati', secondary: 'workflow', secondaryCta: 'Pogledaj rad ili traži ispravku', short: 'Pregledaj predani rad' }
  if (state === 'revision') return { tone: 'wait', title: 'Tražio/la si ispravku', text: 'Izvođač popravlja i predaje rad ponovo. Javit ćemo ti.', action: 'messages', cta: 'Piši izvođaču', short: 'Čeka se ispravka' }
  if (state === 'cancel_requested') return cancelByMe
    ? { tone: 'wait', title: 'Zatražio/la si prekid', text: 'Čeka se odgovor izvođača. Novac je i dalje osiguran.', action: 'workflow', cta: 'Pogledaj zahtjev', short: 'Čeka odgovor na prekid' }
    : { tone: 'act', title: 'Izvođač traži prekid posla', text: 'Ako prihvatiš, novac se vraća na tvoj balans. Ako odbiješ, posao se nastavlja.', action: 'workflow', cta: 'Odgovori', short: 'Odgovori na prekid' }
  if (state === 'disputed') return { tone: 'wait', title: 'Prijavljen je problem', text: 'Novac je zamrznut dok Zadatak tim ne pregleda prepisku i dokaze (obično do 48 sati).', action: 'messages', cta: 'Otvori poruke', short: 'Tim pregleda problem' }
  if (state === 'in_progress') return { tone: 'wait', title: 'Izvođač radi posao', text: `${km(payment.amount)} je osigurano na Zadatku. Kad izvođač preda rad, ovdje ga pregledaš i odobriš isplatu.`, action: 'messages', cta: 'Piši izvođaču', short: 'Posao u toku' }
  if (hasWorker) return { tone: 'act', title: 'Izvođač je odabran', text: 'Kad je posao gotov, označi ga kao završen.', action: 'outcome', cta: 'Posao je završen', short: 'Izvođač odabran' }
  if (pending > 0) return { tone: 'act', title: `Imaš ${ponude(pending)}`, text: 'Pogledaj ih i izaberi izvođača.', action: 'offers', cta: 'Pogledaj ponude', short: `Izaberi izvođača (${ponude(pending)})` }
  if (listing.invited_provider) return { tone: 'wait', title: 'Čekaš ponudu', text: 'Zahtjev je poslan samo odabranom izvođaču.', short: 'Čeka ponudu' }
  return { tone: 'wait', title: 'Čekaš ponude', text: 'Izvođači u blizini su obaviješteni.', short: 'Čeka ponude' }
}

/** Izvođačeva strana kad je njegova ponuda prihvaćena (postoji uplata za njega ili je posao dodijeljen njemu). */
export function workerStep({ listing, payment = null, cancelByMe = null }) {
  const state = workStateOf(payment)
  if (listing.status === 'completed' || state === 'completed') return { tone: 'done', title: 'Posao je završen', text: payment ? `${km(payment.net_amount)} je isplaćeno na tvoj balans.` : 'Hvala na dobrom radu.', action: 'review', cta: 'Ostavi recenziju klijentu' }
  if (listing.status === 'cancelled' || state === 'cancelled') return { tone: 'off', title: 'Posao je otkazan', text: 'Novac je vraćen klijentu.' }
  if (state === 'submitted') return { tone: 'wait', title: 'Rad je predat', text: 'Klijent ima 72 sata da ga pregleda. Ako ne odgovori, isplata ide automatski.', action: 'messages', cta: 'Piši klijentu' }
  if (state === 'revision') return { tone: 'act', title: 'Klijent traži ispravku', text: 'Popravi ono što traži pa predaj rad ponovo.', action: 'submit', cta: 'Predaj ispravljen rad', secondary: 'workflow' }
  if (state === 'cancel_requested') return cancelByMe
    ? { tone: 'wait', title: 'Zatražio/la si prekid', text: 'Čeka se odgovor klijenta.', action: 'workflow', cta: 'Pogledaj zahtjev' }
    : { tone: 'act', title: 'Klijent traži prekid posla', text: 'Ako prihvatiš, novac se vraća klijentu. Ako odbiješ, posao se nastavlja.', action: 'workflow', cta: 'Odgovori' }
  if (state === 'disputed') return { tone: 'wait', title: 'Prijavljen je problem', text: 'Novac je zamrznut dok Zadatak tim ne odluči (obično do 48 sati).', action: 'messages', cta: 'Otvori poruke' }
  if (state === 'in_progress') return { tone: 'act', title: 'Posao je tvoj', text: `Novac je osiguran: dobijaš ${km(payment.net_amount)} kad klijent odobri rad. Kad završiš, predaj rad.`, action: 'submit', cta: 'Predaj rad', secondary: 'messages' }
  return { tone: 'act', title: 'Posao je tvoj', text: 'Dogovori detalje s klijentom u porukama.', action: 'messages', cta: 'Piši klijentu' }
}
