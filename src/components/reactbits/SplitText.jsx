// From React Bits (https://reactbits.dev, MIT + Commons Clause, © David Haz), adapted for Zadatak.
// Changes: GSAP comes from lib/motion; "reduce motion" shows the text as is; `immediate` plays on
// mount instead of on scroll; the scroll trigger watches whichever element scrolls (#root on phones).
import { useEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger, SplitText as GSAPSplitText, useGSAP, reducedMotion, scroller } from '../../lib/motion'

const SplitText = ({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign,
  tag = 'p',
  immediate = false,
  startDelay = 0,
  onLetterAnimationComplete,
}) => {
  const ref = useRef(null)
  const animationCompletedRef = useRef(false)
  const onCompleteRef = useRef(onLetterAnimationComplete)
  const [fontsLoaded, setFontsLoaded] = useState(() => typeof document === 'undefined' || document.fonts?.status === 'loaded')

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete
  }, [onLetterAnimationComplete])

  useEffect(() => {
    if (fontsLoaded) return undefined
    let cancelled = false
    // never wait on a stalled web font: after a moment, split with whatever font is showing
    const timer = window.setTimeout(() => setFontsLoaded(true), 1200)
    document.fonts?.ready.then(() => { if (!cancelled) setFontsLoaded(true) })
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [fontsLoaded])

  useGSAP(
    () => {
      if (!ref.current || !text || !fontsLoaded || reducedMotion()) return undefined
      if (animationCompletedRef.current) return undefined
      const el = ref.current

      const startPct = (1 - threshold) * 100
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin)
      const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0
      const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px'
      const sign = marginValue === 0 ? '' : marginValue < 0 ? `-=${Math.abs(marginValue)}${marginUnit}` : `+=${marginValue}${marginUnit}`
      const start = `top ${startPct}%${sign}`

      let targets
      const assignTargets = (self) => {
        if (splitType.includes('chars') && self.chars.length) targets = self.chars
        if (!targets && splitType.includes('words') && self.words.length) targets = self.words
        if (!targets && splitType.includes('lines') && self.lines.length) targets = self.lines
        if (!targets) targets = self.chars || self.words || self.lines
      }

      const splitInstance = new GSAPSplitText(el, {
        type: splitType,
        smartWrap: true,
        autoSplit: splitType === 'lines',
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        reduceWhiteSpace: false,
        onSplit: (self) => {
          assignTargets(self)
          return gsap.fromTo(targets, { ...from }, {
            ...to,
            duration,
            ease,
            delay: startDelay,
            stagger: delay / 1000,
            scrollTrigger: immediate ? undefined : { trigger: el, start, once: true, fastScrollEnd: true, scroller: scroller() },
            onComplete: () => {
              animationCompletedRef.current = true
              onCompleteRef.current?.()
            },
            force3D: true,
          })
        },
      })

      return () => {
        ScrollTrigger.getAll().forEach((st) => { if (st.trigger === el) st.kill() })
        try { splitInstance.revert() } catch { /* already reverted */ }
      }
    },
    {
      dependencies: [text, delay, duration, ease, splitType, JSON.stringify(from), JSON.stringify(to), threshold, rootMargin, fontsLoaded, immediate, startDelay],
      scope: ref,
    },
  )

  const Tag = tag || 'p'
  return (
    <Tag ref={ref} style={textAlign ? { textAlign } : undefined} className={`split-parent ${className}`.trim()}>
      {text}
    </Tag>
  )
}

export default SplitText
