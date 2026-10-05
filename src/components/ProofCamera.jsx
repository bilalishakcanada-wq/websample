import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, LocateFixed, X } from 'lucide-react'

/**
 * Foto dokaz na licu mjesta: slika se pravi kamerom u aplikaciji (galerija nije ponuđena),
 * a na nju se utisnu GPS koordinate i tačno vrijeme u UTC. Baza uz to zapisuje svoje
 * vrijeme prijema, udaljenost od posla i SHA-256 otisak (supabase/booking/04).
 *
 * onCapture({ blob, sha256, lat, lng, accuracy, capturedAt, source })
 */

const LABEL = { before: 'PRIJE POČETKA', after: 'POSLIJE ZAVRŠETKA' }
const MAX_SIDE = 1600
const GOOD_ACCURACY_M = 2000   // isto kao u bazi (add_work_proof)

const utc = (date) => `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`
const isPhone = () => window.matchMedia?.('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent)

async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Nacrta sliku i traku sa pečatom; vraća JPEG (bez EXIF-a originala). */
function stampedJpeg(source, width, height, { kind, title, fix, at }) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0, w, h)

  const size = Math.max(14, Math.round(w / 42))
  const lines = [
    `ZADATAK · ${LABEL[kind]}`,
    utc(at),
    `GPS ${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)} · ±${Math.round(fix.accuracy)} m`,
    title ? `Posao: ${title.slice(0, 60)}` : '',
  ].filter(Boolean)
  const pad = Math.round(size * 0.7)
  const band = lines.length * size * 1.35 + pad * 2
  ctx.fillStyle = 'rgba(8, 27, 56, 0.78)'
  ctx.fillRect(0, h - band, w, band)
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'top'
  lines.forEach((line, index) => {
    ctx.font = `${index === 0 ? 800 : 600} ${size}px Manrope, system-ui, sans-serif`
    ctx.fillText(line, pad, h - band + pad + index * size * 1.35)
  })
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Slika se nije mogla napraviti.'))), 'image/jpeg', 0.86))
}

function ProofCamera({ kind, title, onCapture, onClose }) {
  const videoRef = useRef(null)
  const fileRef = useRef(null)
  const streamRef = useRef(null)
  const [fix, setFix] = useState(null)
  const [gpsError, setGpsError] = useState(() => (navigator.geolocation ? '' : 'Ovaj uređaj ne daje lokaciju. Otvori posao na telefonu.'))
  const [camState, setCamState] = useState('starting')   // starting | live | fallback | none
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // lokacija: odmah, visoka tačnost, bez keširane pozicije
  useEffect(() => {
    if (!navigator.geolocation) return undefined
    const id = navigator.geolocation.watchPosition(
      (pos) => { setGpsError(''); setFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }) },
      (geoError) => setGpsError(geoError.code === 1
        ? 'Lokacija je blokirana. Dozvoli lokaciju za Zadatak u postavkama telefona pa pokušaj ponovo.'
        : 'Tražim lokaciju… Uključi GPS i izađi bliže prozoru ili na otvoreno.'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // kamera u aplikaciji: nema izbora galerije
  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-media')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
        setCamState('live')
      } catch (camError) {
        if (cancelled) return
        // telefon bez pristupa kameri iz stranice: sistemska kamera (capture), uz provjeru da je slika svježa
        setCamState(isPhone() ? 'fallback' : 'none')
        if (camError?.name === 'NotAllowedError') setError('Kamera je blokirana. Dozvoli kameru za Zadatak u postavkama.')
      }
    }
    start()
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((track) => track.stop()) }
  }, [])

  const finish = async (source, width, height, origin) => {
    const at = new Date()
    const blob = await stampedJpeg(source, width, height, { kind, title, fix, at })
    const sha256 = await sha256Hex(blob)
    await onCapture({ blob, sha256, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, capturedAt: at.toISOString(), source: origin })
  }

  const shoot = async () => {
    const video = videoRef.current
    if (!video?.videoWidth || !fix) return
    setBusy(true); setError('')
    try { await finish(video, video.videoWidth, video.videoHeight, 'camera') } catch (shotError) { setError(shotError.message) } finally { setBusy(false) }
  }

  const fromSystemCamera = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !fix) return
    // slika iz galerije je starija; sistemska kamera vraća upravo napravljenu
    if (!file.lastModified || Date.now() - file.lastModified > 3 * 60_000) {
      setError('Ova slika nije upravo napravljena. Slikaj ponovo kamerom.')
      return
    }
    setBusy(true); setError('')
    try {
      const bitmap = await createImageBitmap(file)
      await finish(bitmap, bitmap.width, bitmap.height, 'camera_file')
    } catch (shotError) { setError(shotError.message || 'Slika se nije mogla obraditi.') } finally { setBusy(false) }
  }

  const ready = fix && fix.accuracy <= GOOD_ACCURACY_M && !busy

  // portal: a transformed or animated ancestor (job cards) would otherwise make position:fixed relative to it
  return createPortal(
    <div className="proof-cam" role="dialog" aria-modal="true" aria-label={`Slikaj ${kind === 'before' ? 'prije početka' : 'urađen posao'}`}>
      <div className="proof-cam-top">
        <strong>{kind === 'before' ? 'Slikaj stanje prije početka' : 'Slikaj urađen posao'}</strong>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Zatvori"><X size={20} /></button>
      </div>

      <div className="proof-cam-view">
        <video ref={videoRef} playsInline muted autoPlay className={camState === 'live' ? '' : 'is-hidden'} />
        {camState === 'starting' && <p>Pokrećem kameru…</p>}
        {camState === 'fallback' && <p>Otvori kameru telefona i slikaj. Slike iz galerije se ne primaju.</p>}
        {camState === 'none' && <p>Ovaj uređaj nema kameru koju stranica može koristiti. Otvori posao u aplikaciji Zadatak ili na telefonu.</p>}
      </div>

      <div className="proof-cam-bottom">
        <span className={`proof-cam-gps ${fix ? 'ok' : ''}`} data-testid="proof-gps">
          <LocateFixed size={15} />
          {fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)} · ±${Math.round(fix.accuracy)} m` : (gpsError || 'Tražim lokaciju…')}
        </span>
        {fix && fix.accuracy > GOOD_ACCURACY_M && <span className="proof-cam-warn">Lokacija je još netačna — sačekaj par sekundi.</span>}
        {error && <span className="proof-cam-warn">{error}</span>}
        {camState === 'live' && (
          <button type="button" className="proof-cam-shutter" onClick={shoot} disabled={!ready} aria-label="Slikaj" data-testid="proof-shutter">
            <Camera size={26} />
          </button>
        )}
        {camState === 'fallback' && (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" data-camera-only="true" hidden onChange={fromSystemCamera} />
            <button type="button" className="primary-button" onClick={() => fileRef.current?.click()} disabled={!ready}>
              <Camera size={17} /> {busy ? 'Šaljem…' : 'Otvori kameru'}
            </button>
          </>
        )}
        <small>Na sliku se utisne lokacija i vrijeme (UTC). Klijent i Zadatak tim ih vide ako dođe do spora.</small>
      </div>
    </div>,
    document.body,
  )
}

export default ProofCamera
