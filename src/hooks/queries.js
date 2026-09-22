import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { listingService } from '../services/listingService'
import { bidService } from '../services/bidService'
import { messageService } from '../services/messageService'
import { notificationService } from '../services/notificationService'
import { profileService } from '../services/profileService'
import { matchService } from '../services/matchService'

/**
 * Every server read goes through here, so screens share one cache: a list someone scrolled
 * a minute ago paints instantly (stale-while-revalidate), pages invalidate what they change,
 * and Realtime events only invalidate — the refetch is deduped by the cache.
 */
export const keys = {
  search: (params) => ['search', params],
  listing: (id) => ['listing', id],
  listingExtras: (id) => ['listing', id, 'extras'],
  related: (id) => ['listing', id, 'related'],
  suggested: (id) => ['listing', id, 'suggested'],
  myBundle: (userId) => ['me', userId, 'bundle'],
  myListings: (userId) => ['me', userId, 'listings'],
  myBids: (userId) => ['me', userId, 'bids'],
  inbox: (userId) => ['me', userId, 'inbox'],
  thread: (conversationId) => ['thread', conversationId],
  notifications: (userId) => ['me', userId, 'notifications'],
  unreadNotifications: (userId) => ['me', userId, 'unread-notifications'],
  unreadMessages: (userId) => ['me', userId, 'unread-messages'],
  recommended: (userId) => ['me', userId, 'recommended'],
  publicProfile: (userId) => ['profile', userId],
}

export const useSearchListings = (params, options = {}) => useQuery({
  queryKey: keys.search(params),
  queryFn: () => listingService.search(params),
  placeholderData: keepPreviousData, // filter changes keep the old list on screen until the new one lands
  staleTime: 30 * 1000,
  ...options,
})

export const useMyBundle = (userId) => useQuery({
  queryKey: keys.myBundle(userId),
  queryFn: () => profileService.getMyBundle(),
  enabled: Boolean(userId),
  meta: { persist: false }, // private
})

export const useMyListings = (userId) => useQuery({
  queryKey: keys.myListings(userId),
  queryFn: () => listingService.listAll({ status: 'published', pageSize: 50, ownerId: userId }).then((r) => r.data || []),
  enabled: Boolean(userId),
  meta: { persist: false },
})

export const useMyBids = (userId, limit = 50) => useQuery({
  queryKey: [...keys.myBids(userId), limit],
  queryFn: () => bidService.listMine(userId, limit),
  enabled: Boolean(userId),
  meta: { persist: false },
})

export const useRecommendedListings = (userId, limit = 6) => useQuery({
  queryKey: [...keys.recommended(userId), limit],
  queryFn: () => matchService.recommendedListings(limit),
  enabled: Boolean(userId),
  staleTime: 2 * 60 * 1000,
  meta: { persist: false },
})

export const useInbox = (userId) => useQuery({
  queryKey: keys.inbox(userId),
  queryFn: () => messageService.inbox(),
  enabled: Boolean(userId),
  staleTime: 15 * 1000,
  meta: { persist: false },
})

export const useThread = (conversationId) => useQuery({
  queryKey: keys.thread(conversationId),
  queryFn: () => messageService.listMessages(conversationId),
  enabled: Boolean(conversationId),
  staleTime: 15 * 1000,
  meta: { persist: false },
})

export const useNotifications = (userId, limit = 50) => useQuery({
  queryKey: [...keys.notifications(userId), limit],
  queryFn: () => notificationService.listMine(limit),
  enabled: Boolean(userId),
  staleTime: 30 * 1000,
  meta: { persist: false },
})

export const usePublicProfile = (userId) => useQuery({
  queryKey: keys.publicProfile(userId),
  queryFn: () => profileService.getPublicBundle(userId),
  enabled: Boolean(userId),
  staleTime: 2 * 60 * 1000,
})

/** Invalidates a set of keys whenever the window regains focus or a custom app event fires. */
export function useInvalidateOn(eventNames, queryKeys) {
  const queryClient = useQueryClient()
  useEffect(() => {
    const handler = () => queryKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
    eventNames.forEach((name) => window.addEventListener(name, handler))
    return () => eventNames.forEach((name) => window.removeEventListener(name, handler))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, JSON.stringify(queryKeys), eventNames.join(',')])
}
