import { supabase } from '../lib/supabase'

export const providerBoardService = {
  /** Escrow rows where I am the provider (RLS: only my own), newest first. */
  async myPayments(userId, limit = 100) {
    const { data, error } = await supabase
      .from('job_payments')
      .select('id, listing_id, bid_id, amount, net_amount, fee_amount, status, work_state, funded_at, released_at, refunded_at, created_at')
      .eq('provider_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('Supabase provider payments fetch failed', { message: error.message, code: error.code })
      throw new Error('Poslovi se nisu učitali. Pokušaj ponovo.')
    }
    return data || []
  },
}

const WORK_LABEL = {
  in_progress: 'Radiš na poslu',
  submitted: 'Predano · čeka potvrdu klijenta',
  revision: 'Klijent traži doradu',
  cancel_requested: 'Traži se prekid posla',
  disputed: 'Spor u toku',
  completed: 'Završeno · isplata u toku',
}

/**
 * One row per job I offered on (my newest offer counts), sorted into the three tabs:
 *   active   — offer waiting for the client, or rejected on a job that is still open (send a new price)
 *   ongoing  — offer accepted: escrow funded / work in progress / waiting for release or a dispute
 *   done     — paid out, refunded/cancelled, or finished outside Zadatak Pay
 *   lost     — offers that did not win (shown folded under "done")
 */
export function groupProviderBoard(bids = [], payments = []) {
  const paymentByListing = new Map()
  payments.forEach((payment) => { if (!paymentByListing.has(payment.listing_id)) paymentByListing.set(payment.listing_id, payment) })
  const latest = new Map()
  bids.forEach((bid) => { if (bid.status !== 'withdrawn' && !latest.has(bid.listing_id)) latest.set(bid.listing_id, bid) })

  const board = { active: [], ongoing: [], done: [], lost: [] }
  latest.forEach((bid) => {
    const listing = bid.listing || {}
    const payment = paymentByListing.get(bid.listing_id) || null
    const open = listing.status === 'published'
    const row = { bid, listing, payment, id: bid.listing_id }
    if (payment) {
      if (payment.status === 'released') board.done.push({ ...row, state: 'paid', label: 'Isplaćeno', earned: Number(payment.net_amount || 0) })
      else if (payment.status === 'refunded') board.done.push({ ...row, state: 'refunded', label: 'Otkazano · novac vraćen klijentu', earned: 0 })
      else board.ongoing.push({ ...row, state: payment.status, label: payment.status === 'disputed' ? 'Spor u toku' : payment.status === 'requested' ? 'Čeka isplatu' : WORK_LABEL[payment.work_state] || 'Uplata osigurana' })
      return
    }
    if (bid.status === 'accepted') {
      if (listing.status === 'completed') board.done.push({ ...row, state: 'completed', label: 'Završen (bez Zadatak Pay)', earned: null })
      else if (listing.status === 'cancelled') board.done.push({ ...row, state: 'cancelled', label: 'Otkazan', earned: 0 })
      else board.ongoing.push({ ...row, state: 'accepted', label: 'Dodijeljen tebi' })
      return
    }
    if (bid.status === 'pending' && open) board.active.push({ ...row, state: 'pending', label: 'Čeka odgovor klijenta' })
    else if (bid.status === 'rejected' && open) board.active.push({ ...row, state: 'rejected', label: 'Klijent je odbio ponudu. Pošalji novu cijenu.' })
    else board.lost.push({ ...row, state: 'lost', label: bid.status === 'rejected' ? 'Nije prošla' : 'Posao je zatvoren' })
  })
  return board
}
