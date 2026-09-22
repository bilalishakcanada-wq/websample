/** Query keys only (no service imports) — safe to import from the entry bundle (tab bar badges). */
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
