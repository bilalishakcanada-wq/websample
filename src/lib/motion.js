/**
 * GSAP in one place: plugins registered once, plus the helpers every animated screen shares.
 * Only screens that animate import this, so GSAP lands in their chunks and not in the first load.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/** On phones #root is the scroller (see "Phone app shell" in App.css); elsewhere the window. */
export const scroller = () => (window.matchMedia('(max-width: 768px)').matches ? document.getElementById('root') : undefined)

/** A scroll trigger that fires once when `trigger` comes into view, on whichever element scrolls. */
export const onView = (trigger, start = 'top 88%') => ({ trigger, start, once: true, scroller: scroller() })

export { gsap, ScrollTrigger, useGSAP }
