import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { latinLabels, MAP_STYLE_URL } from '../utils/mapStyle'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(mapWorkerUrl)

/**
 * Small map with one pin for ExactLocationPicker: drag the pin, or tap the map, to put it on the exact door.
 * `point` is { lat, lng }; onMove gets the new { lat, lng } once the pin is let go.
 */
function ExactLocationMap({ point, onMove }) {
  const boxRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const onMoveRef = useRef(onMove)
  useEffect(() => { onMoveRef.current = onMove })

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return undefined
    const map = new MapLibreMap({
      container: boxRef.current,
      style: MAP_STYLE_URL,
      center: [point.lng, point.lat],
      zoom: 16,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.on('error', (event) => console.error('Map error', event?.error?.message || event))
    latinLabels(map)
    const el = document.createElement('div')
    el.className = 'xl-pin'
    el.setAttribute('aria-label', 'Tačna lokacija')
    const marker = new Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([point.lng, point.lat]).addTo(map)
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLngLat()
      onMoveRef.current?.({ lat, lng })
    })
    map.on('click', (event) => {
      marker.setLngLat(event.lngLat)
      onMoveRef.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng })
    })
    mapRef.current = map
    markerRef.current = marker
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a new point from outside (picked address, GPS): move the pin and the map there
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    const at = marker.getLngLat()
    if (Math.abs(at.lat - point.lat) < 1e-7 && Math.abs(at.lng - point.lng) < 1e-7) return
    marker.setLngLat([point.lng, point.lat])
    map.easeTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 16), duration: 500 })
  }, [point.lat, point.lng])

  return <div ref={boxRef} className="xl-map" data-testid="exact-location-map" />
}

export default ExactLocationMap
