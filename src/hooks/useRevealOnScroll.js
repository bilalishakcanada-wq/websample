import { useEffect } from 'react'

export function useRevealOnScroll(selector = '.reveal') {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll(selector).forEach((el) => el.classList.add('reveal-visible'))
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
      { threshold: 0.05, rootMargin: '0px 0px 40px 0px' },
    )

    // Elements behind an async fetch (e.g. a section that only mounts once
    // listings finish loading) don't exist yet on the first pass, so keep
    // watching the DOM for newly-added .reveal nodes too.
    const observeAll = () => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!el.classList.contains('reveal-visible')) observer.observe(el)
      })
    }

    observeAll()
    const mutationObserver = new MutationObserver(observeAll)
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [selector])
}
