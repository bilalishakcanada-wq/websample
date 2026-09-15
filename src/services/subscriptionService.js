import { mockPlans } from '../data/mockData'

export const getSubscriptionPlans = async () => {
  return mockPlans
}

export const selectPlan = async (planId) => {
  const selectedPlan = mockPlans.find((plan) => plan.id === planId)

  if (!selectedPlan) {
    throw new Error('Selected plan does not exist.')
  }

  return {
    planId: selectedPlan.id,
    status: 'ready_for_provider_integration',
    message:
      'Payment provider integration is intentionally deferred. This layer is ready to connect to a billing provider later.',
  }
}

export const checkoutCredits = async (creditOption) => {
  if (!creditOption) {
    throw new Error('No credit option selected.')
  }

  return {
    status: 'ready_for_provider_integration',
    creditOption,
    message:
      'Credit purchase flow is prepared for future payment provider integration without implementing a provider yet.',
  }
}
