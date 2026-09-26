import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { canGoBackInApp, parentOf } from '../utils/backNav'

/**
 * The on-screen back arrow: returns to the previous screen when it was ours, otherwise goes one
 * level up (replacing this entry, so history never grows loops). Never leaves the site.
 */
export function useGoBack(fallback) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  return useCallback(() => {
    if (canGoBackInApp()) navigate(-1)
    else navigate(fallback || parentOf(pathname, search) || '/', { replace: true })
  }, [navigate, fallback, pathname, search])
}
