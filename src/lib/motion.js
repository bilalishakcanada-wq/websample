/**
 * GSAP in one place: plugins registered once, plus the helpers every animated screen shares.
 * Only screens that animate import this, so GSAP lands in their chunks and not in the first load.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)

export const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/** On phones #root is the scroller (see "Phone app shell" in App.css); elsewhere the window. */
export const scroller = () => (window.matchMedia('(max-width: 768px)').matches ? document.getElementById('root') : undefined)

/** A scroll trigger that fires once when `trigger` comes into view, on whichever element scrolls. */
export const onView = (trigger, start = 'top 88%') => ({ trigger, start, once: true, scroller: scroller() })

/** Words of a heading rise out of their own line, one after another. Returns the tween (or null). */
export function revealWords(el, { delay = 0, scroll = true, stagger = 0.06 } = {}) {
  if (!el || el.dataset.split) return null
  el.dataset.split = '1'
  const split = new SplitText(el, { type: 'words', mask: 'words', wordsClass: 'split-word' })
  return gsap.from(split.words, {
    yPercent: 110,
    duration: 0.8,
    ease: 'power4.out',
    stagger,
    delay,
    scrollTrigger: scroll ? onView(el) : undefined,
    onComplete: () => { split.revert(); delete el.dataset.split },
  })
}

export { gsap, ScrollTrigger, SplitText, useGSAP }
