// From React Bits (https://reactbits.dev, MIT + Commons Clause, © David Haz), adapted for Zadatak.
// Changes: moves the element directly (no React re-render on every mouse move) and stays still on
// touch screens and with "reduce motion".
import { useEffect, useRef } from 'react'

const Magnet = ({
  children,
  padding = 100,
  disabled = false,
  magnetStrength = 2,
  activeTransition = 'transform 0.3s ease-out',
  inactiveTransition = 'transform 0.5s ease-in-out',
  wrapperClassName = '',
  innerClassName = '',
  ...props
}) => {
  const magnetRef = useRef(null)
  const innerRef = useRef(null)

  useEffect(() => {
    const inner = innerRef.current
    const still = !window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (disabled || still || !inner) {
      if (inner) inner.style.transform = ''
      return undefined
    }

    let active = false
    let frame = 0
    const handleMouseMove = (e) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!magnetRef.current) return
        const { left, top, width, height } = magnetRef.current.getBoundingClientRect()
        const centerX = left + width / 2
        const centerY = top + height / 2
        const near = Math.abs(centerX - e.clientX) < width / 2 + padding && Math.abs(centerY - e.clientY) < height / 2 + padding
        if (near) {
          active = true
          inner.style.transition = activeTransition
          inner.style.transform = `translate3d(${(e.clientX - centerX) / magnetStrength}px, ${(e.clientY - centerY) / magnetStrength}px, 0)`
        } else if (active) {
          active = false
          inner.style.transition = inactiveTransition
          inner.style.transform = 'translate3d(0, 0, 0)'
        }
      })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(frame)
    }
  }, [padding, disabled, magnetStrength, activeTransition, inactiveTransition])

  return (
    <div ref={magnetRef} className={wrapperClassName} style={{ position: 'relative', display: 'inline-block' }} {...props}>
      <div ref={innerRef} className={innerClassName} style={{ willChange: 'transform' }}>
        {children}
      </div>
    </div>
  )
}

export default Magnet
