import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from its previous value to `target` (ease-out), the way
 * balances and stats "tick up" in native apps. Respects reduced-motion.
 */
export function useCountUp(target, { duration = 700 } = {}) {
  const value = Number(target) || 0
  // starts from 0 so the first paint ticks up to the real number
  const [shown, setShown] = useState(0)
  const fromRef = useRef(0)
  const frameRef = useRef(0)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = fromRef.current
    if (reduce || from === value) {
      fromRef.current = value
      setShown(value)
      return undefined
    }
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(from + (value - from) * eased)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return shown
}
