import { useEffect } from 'react'

export function useRevealOnScroll(selector = '.reveal') {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(selector))
    if (elements.length === 0) return undefined

    if (!('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('reveal-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [selector])
}
