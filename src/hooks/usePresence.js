import { useEffect, useState } from 'react'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Keeps an overlay mounted for its exit animation. `mounted` stays true for `duration` ms after
 * `open` turns false, and `closing` is true during that window, so CSS can play the way out
 * (`.is-closing`). People who asked for reduced motion get the instant close.
 */
export function usePresence(open, duration = 200) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (open || !mounted) return undefined
    const timer = window.setTimeout(() => setMounted(false), reducedMotion() ? 0 : duration)
    return () => window.clearTimeout(timer)
  }, [open, mounted, duration])

  return { mounted: open || mounted, closing: !open && mounted }
}
