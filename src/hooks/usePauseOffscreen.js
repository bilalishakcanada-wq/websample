import { useEffect } from 'react'

/** Sets data-paused on the element while it is off screen, so its CSS animations stop costing frames. */
export function usePauseOffscreen(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.removeAttribute('data-paused')
      else el.setAttribute('data-paused', '')
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
}
