import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { keys } from './queryKeys'

const SEARCH_EVERY_MS = 20 * 1000 // other people's jobs change all the time: refresh open search lists at most this often

/**
 * One Supabase Realtime connection for the whole app (web, Android, iOS) while someone is signed in.
 * Offers (bids), jobs (listings) and escrow rows (job_payments) stream in over the WebSocket and land
 * in the shared TanStack Query cache, so every open screen (job page, "Moji poslovi", the provider
 * board, search) updates without a reload. Row-level security decides what each person receives:
 * a client gets every offer on their own jobs, a provider only their own offers and payments.
 * The sound and the toast for a new offer come from the notification row the database writes
 * (NotificationBell), so they are not repeated here.
 */
export function useRealtimeSync() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const uid = user?.id

  useEffect(() => {
    if (!uid || !isSupabaseConfigured) return undefined
    const pending = new Map()
    let timer = 0
    let lastSearch = 0
    let searchTimer = 0
    let connectedOnce = false

    const flush = () => {
      timer = 0
      pending.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      pending.clear()
    }
    // a burst of events (an accept rejects every other offer at once) becomes one refetch per key
    const invalidate = (...queryKeys) => {
      queryKeys.forEach((queryKey) => pending.set(JSON.stringify(queryKey), queryKey))
      if (!timer) timer = window.setTimeout(flush, 250)
    }
    const refreshSearch = () => {
      const wait = lastSearch + SEARCH_EVERY_MS - Date.now()
      if (wait <= 0) { lastSearch = Date.now(); invalidate(['search']); return }
      if (!searchTimer) searchTimer = window.setTimeout(() => { searchTimer = 0; lastSearch = Date.now(); invalidate(['search']) }, wait)
    }
    const mine = () => [keys.myBids(uid), keys.myListings(uid), keys.providerPayments(uid)]

    const onBid = ({ eventType, new: row, old }) => {
      const bid = row?.id ? row : old
      if (!bid?.listing_id) return
      // the open job page shows the change at once; the refetch behind it brings the bidder's name and photo
      if (row?.id && (eventType === 'INSERT' || eventType === 'UPDATE')) {
        queryClient.setQueryData(keys.listing(bid.listing_id), (current) => {
          if (!current?.bids) return current
          const known = current.bids.some((item) => item.id === row.id)
          if (eventType === 'INSERT' && !known) return { ...current, bids: [{ ...row, bidder: null }, ...current.bids] }
          if (known) return { ...current, bids: current.bids.map((item) => (item.id === row.id ? { ...item, ...row, bidder: item.bidder } : item)) }
          return current
        })
      }
      invalidate(keys.listing(bid.listing_id), ...mine())
    }
    const onListing = ({ new: row, old }) => {
      const listing = row?.id ? row : old
      if (listing?.id && queryClient.getQueryData(keys.listing(listing.id))) invalidate(keys.listing(listing.id))
      if (listing?.user_id === uid) invalidate(keys.myListings(uid))
      refreshSearch()
    }
    const onPayment = ({ new: row, old }) => {
      const payment = row?.listing_id ? row : old
      if (payment?.listing_id) invalidate(keys.listing(payment.listing_id))
      invalidate(...mine())
    }

    const channel = supabase
      .channel(`sync-${uid}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, onBid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, onListing)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_payments' }, onPayment)
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        // back after a dropped connection (tunnel, phone asleep): catch up on whatever was missed
        if (connectedOnce) invalidate(...mine(), ['listing'], ['search'])
        connectedOnce = true
      })

    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(searchTimer)
      supabase.removeChannel(channel)
    }
  }, [uid, queryClient])
}

/** Mount once inside the router (App.jsx). */
export function RealtimeSync() {
  useRealtimeSync()
  return null
}
