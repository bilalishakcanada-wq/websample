/**
 * @typedef {'free' | 'plus' | 'premium'} SubscriptionPlan
 * @typedef {'active' | 'trialing' | 'pending' | 'cancelled' | 'expired'} SubscriptionStatus
 * @typedef {{ plan: SubscriptionPlan, status: SubscriptionStatus, provider: null }} Subscription
 */

export const subscriptionPlans = Object.freeze(['free', 'plus', 'premium'])
export const subscriptionStatuses = Object.freeze(['active', 'trialing', 'pending', 'cancelled', 'expired'])
