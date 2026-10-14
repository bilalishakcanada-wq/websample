import { useEffect, useId, useMemo, useState } from 'react'
import { cevapi, diver, dzezva, navijac, sebilj, stariMost } from '../art/bosnia'
import '../art/bosnia.css'

// Each drawing is built once; it is static markup we wrote ourselves (no user data in it).
const DRAW = { stariMost, diver, sebilj, dzezva, cevapi, navijac }
const cache = {}
const markup = (name) => (cache[name] ??= DRAW[name]())

/* The three hero scenes: a left and a right drawing each. */
export const SCENES = [
  { key: 'mostar', left: 'stariMost', right: 'diver' },
  { key: 'carsija', left: 'sebilj', right: 'dzezva' },
  { key: 'cevapi', left: 'cevapi', right: 'navijac' },
]
/* Close-ups of single characters, for small spots (app header, promo cards). */
export const CROPS = {
  diver: ['diver', '60 140 330 440'],
  dzezva: ['dzezva', '60 180 340 420'],
  navijac: ['navijac', '110 250 260 420'],
  majstor: ['stariMost', '226 130 190 190'],
  burek: ['sebilj', '20 440 200 190'],
  somun: ['cevapi', '200 170 270 290'],
  most: ['stariMost', '90 120 480 420'],
  sebilj: ['sebilj', '80 150 470 560'],
}

/** One drawing. Ids inside are made unique per copy, so two copies on a page never share clip paths. */
export function BosniaArt({ name, viewBox, className = '', ...props }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const html = useMemo(() => {
    let svg = markup(name).replace(/id="([^"]+)"/g, `id="$1-${uid}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${uid})`)
    if (viewBox) svg = svg.replace(/viewBox="[^"]+"/, `viewBox="${viewBox}"`)
    return svg
  }, [name, viewBox, uid])
  return <span className={`bosnia-art ${className}`.trim()} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} {...props} />
}

export function CropArt({ crop, className = '' }) {
  const [name, viewBox] = CROPS[crop]
  return <BosniaArt name={name} viewBox={viewBox} className={`is-crop ${className}`} />
}

const still = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** A random item from `count`, changing to another random one every `every` ms (not on reduced motion). */
export function useShuffle(count, every = 9000) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * count))
  useEffect(() => {
    if (count < 2 || still()) return undefined
    const timer = window.setInterval(() => {
      if (document.hidden) return
      setIndex((current) => {
        const next = Math.floor(Math.random() * (count - 1))
        return next >= current ? next + 1 : next
      })
    }, every)
    return () => window.clearInterval(timer)
  }, [count, every])
  return index
}
