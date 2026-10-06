import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl, LngLatBounds, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { LocateFixed } from 'lucide-react'

setWorkerUrl(mapWorkerUrl)

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

const pin = (className, label) => {
  const el = document.createElement('div')
  el.className = className
  el.setAttribute('aria-label', label)
  return el
}

/**
 * Map for „Izvođač je na putu“: the job's place and the provider's last point, moving live.
 * Same file on desktop, phone browser and the app; only the CSS adapts (LiveTracking styles in App.css).
 */
function LiveTrackingMap({ destination, provider }) {
  const boxRef = useRef(null)
  const mapRef = useRef(null)
  const providerMarker = useRef(null)
  const followRef = useRef(true)   // stop auto-framing once the person pans the map themselves
  const pointsRef = useRef({ destination, provider })
  useEffect(() => { pointsRef.current = { destination, provider } })

  const frame = (animate = true) => {
    const map = mapRef.current
    const { destination: d, provider: p } = pointsRef.current
    if (!map) return
    const pts = [d, p].filter((pt) => pt?.lat != null && pt?.lng != null)
    if (!pts.length) return
    if (pts.length === 1) { map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 14, duration: animate ? 600 : 0 }); return }
    const bounds = new LngLatBounds()
    pts.forEach((pt) => bounds.extend([pt.lng, pt.lat]))
    map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: animate ? 600 : 0 })
  }

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return undefined
    const start = pointsRef.current.provider || pointsRef.current.destination
    const map = new MapLibreMap({
      container: boxRef.current,
      style: STYLE_URL,
      center: start ? [start.lng, start.lat] : [17.8, 44.1],
      zoom: start ? 13 : 6.4,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.on('dragstart', () => { followRef.current = false })
    map.on('error', (event) => console.error('Map error', event?.error?.message || event))
    mapRef.current = map
    const { destination: d } = pointsRef.current
    if (d?.lat != null) new Marker({ element: pin('live-pin live-pin-job', 'Mjesto posla') }).setLngLat([d.lng, d.lat]).addTo(map)
    map.on('load', () => frame(false))
    return () => { map.remove(); mapRef.current = null; providerMarker.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!provider) { providerMarker.current?.remove(); providerMarker.current = null; return }
    if (!providerMarker.current) {
      providerMarker.current = new Marker({ element: pin('live-pin live-pin-provider', 'Izvođač') }).setLngLat([provider.lng, provider.lat]).addTo(map)
    } else {
      providerMarker.current.setLngLat([provider.lng, provider.lat])
    }
    if (followRef.current) frame()
  }, [provider?.lat, provider?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="live-map">
      <div ref={boxRef} className="live-map-canvas" data-testid="live-map" />
      <button type="button" className="live-map-recenter" aria-label="Prikaži oboje na mapi" title="Prikaži oboje na mapi"
        onClick={() => { followRef.current = true; frame() }}>
        <LocateFixed size={20} />
      </button>
    </div>
  )
}

export default LiveTrackingMap
