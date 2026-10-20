import { gsap, onView, reducedMotion, revealWords, useGSAP } from '../../lib/motion'

/** Desktop home: the hero builds itself, the drawings drift as you scroll, every section heading rises in. */
export function useDesktopHomeMotion(scope) {
  useGSAP(() => {
    if (reducedMotion()) return
    const root = scope.current
    const has = (selector) => root.querySelector(selector)

    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.hero-arc', { opacity: 0, scale: 0.86, y: 30, duration: 1.1, ease: 'back.out(1.5)' })
      .from('.hero-stage-actions', { opacity: 0, y: 20, duration: 0.6, clearProps: 'transform' }, '-=0.5')
      .from('.hero-search', { opacity: 0, y: 26, duration: 0.7 }, '-=0.4')
      .from('.hero-cities > *', { opacity: 0, y: 10, duration: 0.4, stagger: 0.03 }, '-=0.45')
      .from('.hero-proof, .hero-rating', { opacity: 0, y: 8, duration: 0.6 }, '-=0.3')

    // the Bosnian drawings slide in from the sides, then drift apart as the hero scrolls away
    gsap.from('.hero-scene-left', { xPercent: -35, opacity: 0, duration: 1.3, ease: 'power3.out', delay: 0.2 })
    gsap.from('.hero-scene-right', { xPercent: 35, opacity: 0, duration: 1.3, ease: 'power3.out', delay: 0.3 })
    const away = { trigger: '.hero-stage', start: 'top top', end: 'bottom top', scrub: 0.6 }
    gsap.to('.hero-scene-left', { yPercent: 22, rotate: -5, ease: 'none', scrollTrigger: away })
    gsap.to('.hero-scene-right', { yPercent: -16, rotate: 6, ease: 'none', scrollTrigger: away })
    gsap.to('.hero-stars', { yPercent: -18, ease: 'none', scrollTrigger: away })
    gsap.to('.hero-stage-inner', { y: 70, ease: 'none', scrollTrigger: away })

    root.querySelectorAll('main > section:not(.hero-stage):not(.boss-band) h2').forEach((heading) => revealWords(heading))

    // numbered steps pop in, the illustrations swing into place and float with the scroll
    if (has('.post-task-steps')) gsap.from('.post-task-steps li span', { scale: 0, rotate: -120, duration: 0.6, ease: 'back.out(2.2)', stagger: 0.12, scrollTrigger: onView('.post-task-steps') })
    for (const art of ['.trust-visual', '.boss-band-art']) {
      if (!has(art)) continue
      gsap.from(art, { opacity: 0, scale: 0.86, rotate: -4, duration: 1, ease: 'power3.out', scrollTrigger: onView(art, 'top 85%') })
      gsap.fromTo(art, { y: 40 }, { y: -40, ease: 'none', scrollTrigger: { trigger: art, start: 'top bottom', end: 'bottom top', scrub: 0.8 } })
    }
    if (has('.fee-card-big')) gsap.from('.fee-card-big', { scale: 0.6, opacity: 0, duration: 0.7, ease: 'back.out(1.8)', stagger: 0.1, scrollTrigger: onView('.fee-grid') })
  }, { scope })
}

/** Home in a phone browser: the hero builds itself, categories and steps arrive as you scroll. */
export function useMobileHomeMotion(scope) {
  useGSAP(() => {
    if (reducedMotion()) return
    gsap.set('.mw-btn, .mw-cat', { transition: 'none' }) // their CSS hover transition would fight the tween
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.mw-hero .hero-arc', { opacity: 0, scale: 0.88, y: 18, duration: 0.9, ease: 'back.out(1.5)' })
      .from('.mw-tagline, .mw-btn, .mw-proof', { opacity: 0, y: 14, duration: 0.5, stagger: 0.07, clearProps: 'transform,transition' }, '-=0.45')
      .from('.mw-scene', { opacity: 0, y: 30, duration: 0.8 }, '-=0.5')
    gsap.from('.mw-cat', { opacity: 0, y: 18, scale: 0.94, duration: 0.45, ease: 'power2.out', stagger: 0.05, clearProps: 'transform,transition', scrollTrigger: onView('.mw-cats', 'top 92%') })
    gsap.from('.mw-steps li b', { scale: 0, rotate: -120, duration: 0.6, ease: 'back.out(2.2)', stagger: 0.12, scrollTrigger: onView('.mw-steps', 'top 90%') })
    scope.current.querySelectorAll('.mw-head h2, .mw-steps h2').forEach((heading) => revealWords(heading))
  }, { scope })
}
