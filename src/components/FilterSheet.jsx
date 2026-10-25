import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const EXIT_MS = 260

/**
 * A search filter as a bottom sheet on phones. It closes with a swipe down (on the handle, the
 * title, or the list once it is scrolled to the top), a tap or swipe on the dimmed page, the X or back.
 * The dimmed layer stays until the sheet has slid away, so the tap that closes it can never
 * land on a job underneath, and the page behind does not scroll while the sheet is open.
 */
function FilterSheet({ open, title, onClose, menuId, children }) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const closing = mounted && !open
  const sheetRef = useRef(null)
  const bodyRef = useRef(null)
  const backdropRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // open: mount and slide up; closed (by any route): slide down from wherever it is, then unmount
  useEffect(() => {
    if (open) {
      // reopened while still sliding away: come back up from there
      if (sheetRef.current) { sheetRef.current.style.transition = ''; sheetRef.current.style.transform = '' }
      if (backdropRef.current) { backdropRef.current.style.transition = ''; backdropRef.current.style.opacity = '' }
      return undefined
    }
    if (!mounted) return undefined
    const sheet = sheetRef.current
    if (sheet) {
      sheet.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
      sheet.style.transform = 'translateY(100%)'
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = `opacity ${EXIT_MS}ms ease`
      backdropRef.current.style.opacity = '0'
    }
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [open, mounted])

  // the page behind stays put while the sheet is up
  useEffect(() => {
    if (!mounted) return undefined
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [mounted])

  // swipe down to close; touch listeners are added by hand so a drag can stop the page scrolling
  useEffect(() => {
    const sheet = sheetRef.current
    if (!mounted || !sheet) return undefined
    let start = null
    let dragging = false
    let offset = 0

    const setOffset = (value, animate) => {
      offset = value
      sheet.style.transition = animate ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none'
      sheet.style.transform = value ? `translateY(${value}px)` : ''
      const backdrop = backdropRef.current
      if (backdrop) {
        backdrop.style.transition = animate ? 'opacity 0.3s ease' : 'none'
        backdrop.style.opacity = String(Math.max(0, 1 - value / (sheet.offsetHeight || 1)))
      }
    }
    const onStart = (event) => {
      if (event.touches.length !== 1) { start = null; return }
      const touch = event.touches[0]
      start = { x: touch.clientX, y: touch.clientY, firstY: touch.clientY, time: event.timeStamp, inBody: Boolean(bodyRef.current?.contains(event.target)) }
      dragging = false
    }
    const onMove = (event) => {
      if (!start) return
      const touch = event.touches[0]
      const dy = touch.clientY - start.y
      const dx = touch.clientX - start.x
      if (!dragging) {
        // sideways: leave it alone for the whole gesture
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(touch.clientY - start.firstY)) { start = null; return }
        // in the list a downward swipe scrolls it back up first; once it is at the top the
        // same swipe carries on pulling the sheet down
        const atTop = !start.inBody || bodyRef.current.scrollTop <= 0
        if (!atTop) { start = { ...start, y: touch.clientY }; return }
        if (dy < 6) return
        dragging = true
        start = { ...start, y: touch.clientY, time: event.timeStamp }
        document.activeElement?.blur?.()
      }
      if (event.cancelable) event.preventDefault()
      setOffset(Math.max(0, touch.clientY - start.y), false)
    }
    const onEnd = (event) => {
      if (!start) return
      const wasDragging = dragging
      const velocity = offset / Math.max(1, event.timeStamp - start.time)
      start = null
      dragging = false
      if (!wasDragging) return
      if (offset > Math.min(120, sheet.offsetHeight * 0.25) || (offset > 24 && velocity > 0.5)) onCloseRef.current()
      else setOffset(0, true)
    }

    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onEnd)
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
    }
  }, [mounted])

  if (!mounted) return null
  return createPortal(
    <>
      <div
        ref={backdropRef}
        className={`filter-sheet-backdrop ${closing ? 'is-closing' : ''}`}
        onClick={() => { if (!closing) onClose() }}
        // a swipe on the dimmed page never becomes a click, so it closes on release too
        onTouchEnd={() => { if (!closing) onClose() }}
        aria-hidden="true"
      />
      <div ref={sheetRef} className={`filter-popover filter-sheet ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={title} data-menu={menuId}>
        <div className="filter-sheet-head">
          <div className="filter-sheet-handle" aria-hidden="true" />
          <div className="filter-sheet-title">
            <h2>{title}</h2>
            <button type="button" className="filter-sheet-close" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
          </div>
        </div>
        <div ref={bodyRef} className="filter-sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  )
}

export default FilterSheet
