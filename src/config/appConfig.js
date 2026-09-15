export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME || 'Poso.ba',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  defaultLocale: import.meta.env.VITE_DEFAULT_LOCALE || 'bs',
  featureFlags: {
    paymentsEnabled: import.meta.env.VITE_ENABLE_PAYMENT === 'true',
    analyticsEnabled: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  },
}

export const subscriptionConfig = {
  freeLimit: 3,
  plusLimit: 5,
  premiumUnlimited: true,
  currency: 'KM',
  billingCycle: 'monthly',
}
