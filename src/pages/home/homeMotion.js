import { gsap, onView, reducedMotion, useGSAP } from '../../lib/motion'

// Quiet on purpose: the headline, buttons and search are there from the first frame (nothing to wait
// for before typing), and below it each section just settles in once as it scrolls into view.
const settle = (targets, trigger, start) => {
  gsap.set(targets, { transition: 'none' }) // a CSS hover/press transition would fight the tween
  return gsap.from(targets, { opacity: 0, y: 16, duration: 0.5, ease: 'power2.out', stagger: 0.06, clearProps: 'transform,transition', scrollTrigger: onView(trigger, start) })
}

/** Desktop home: the Bosnian drawings fade in and drift apart as the hero scrolls away; sections settle in. */
export function useDesktopHomeMotion(scope) {
  useGSAP(() => {
    if (reducedMotion()) return
    const root = scope.current

    gsap.from('.hero-scene-left, .hero-scene-right', { opacity: 0, duration: 0.8, ease: 'power1.out' })
    const away = { trigger: '.hero-stage', start: 'top top', end: 'bottom top', scrub: true }
    gsap.to('.hero-scene-left', { yPercent: 14, ease: 'none', scrollTrigger: away })
    gsap.to('.hero-scene-right', { yPercent: -10, ease: 'none', scrollTrigger: away })

    root.querySelectorAll('main > section:not(.hero-stage):not(.boss-band)').forEach((section) => {
      const heading = section.querySelector('h2')
      if (heading) settle(heading, heading, 'top 90%')
    })
    for (const art of ['.trust-visual', '.boss-band-art']) {
      if (root.querySelector(art)) settle(art, art, 'top 85%')
    }
  }, { scope })
}

/** Home in a phone browser: everything is there at once; categories and steps settle in as you scroll. */
export function useMobileHomeMotion(scope) {
  useGSAP(() => {
    if (reducedMotion()) return
    const root = scope.current
    if (root.querySelector('.mw-cats')) settle('.mw-cat', '.mw-cats', 'top 92%')
    if (root.querySelector('.mw-steps')) settle('.mw-steps li', '.mw-steps', 'top 90%')
  }, { scope })
}
