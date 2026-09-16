import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, NavigationControl, LngLatBounds, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const BIH_CENTER = [17.8, 44.1]
const NAVY = '#0d2a52'
const GOLD = '#f5b400'

const toGeoJSON = (listings) => ({
  type: 'FeatureCollection',
  features: listings
    .filter((item) => item.lat != null && item.lng != null)
    .map((item) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
      properties: {
        id: item.id,
        title: item.title,
        price: item.price == null ? 'Po dogovoru' : `${Number(item.price).toLocaleString('bs-BA')} KM`,
        location: item.location || '',
      },
    })),
})

function TaskMap({ listings, activeId, onSelect, focus }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const readyRef = useRef(false)
  const popupRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: BIH_CENTER,
      zoom: 6.4,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map
    map.on('error', (event) => console.error('Map error', event?.error?.message || event))

    map.on('load', () => {
      map.addSource('tasks', {
        type: 'geojson',
        data: toGeoJSON([]),
        promoteId: 'id',
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 12,
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'tasks',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': NAVY,
          'circle-radius': ['step', ['get', 'point_count'], 18, 5, 22, 20, 28],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'tasks',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['Noto Sans Bold'] },
        paint: { 'text-color': '#ffffff' },
      })
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'tasks',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['case', ['boolean', ['feature-state', 'active'], false], GOLD, NAVY],
          'circle-radius': ['case', ['boolean', ['feature-state', 'active'], false], 11, 8],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      })

      map.on('click', 'clusters', (event) => {
        const feature = event.features?.[0]
        if (!feature) return
        map.getSource('tasks').getClusterExpansionZoom(feature.properties.cluster_id).then((zoom) => {
          map.easeTo({ center: feature.geometry.coordinates, zoom })
        })
      })
      map.on('click', 'points', (event) => {
        const feature = event.features?.[0]
        if (feature) onSelectRef.current?.(feature.properties.id)
      })
      map.on('mouseenter', 'points', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'points', () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })

      readyRef.current = true
      map.fire('tasks-ready')
    })

    // The container starts hidden on mobile (list view), so re-measure
    // whenever it changes size or becomes visible.
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
  }, [])

  // Push data + fit bounds whenever the result set changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return undefined
    const apply = () => {
      const data = toGeoJSON(listings)
      map.getSource('tasks')?.setData(data)
      if (data.features.length === 0) return
      const bounds = new LngLatBounds()
      data.features.forEach((f) => bounds.extend(f.geometry.coordinates))
      if (data.features.length === 1) {
        map.easeTo({ center: data.features[0].geometry.coordinates, zoom: 10, duration: 600 })
      } else {
        map.fitBounds(bounds, { padding: 60, maxZoom: 11, duration: 600 })
      }
    }
    if (readyRef.current) apply()
    else map.once('tasks-ready', apply)
    return undefined
  }, [listings])

  // Recenter when the user picks a city + radius.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    const go = () => map.easeTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 9, duration: 700 })
    if (readyRef.current) go()
    else map.once('tasks-ready', go)
  }, [focus])

  // Highlight the hovered/selected card's pin and show a popup.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return undefined
    const source = map.getSource('tasks')
    if (!source) return undefined

    popupRef.current?.remove()
    popupRef.current = null

    const active = listings.find((item) => item.id === activeId && item.lat != null)
    listings.forEach((item) => {
      if (item.lat == null) return
      map.setFeatureState({ source: 'tasks', id: item.id }, { active: item.id === activeId })
    })
    if (active) {
      popupRef.current = new Popup({ closeButton: false, offset: 14, className: 'task-popup' })
        .setLngLat([active.lng, active.lat])
        .setHTML(`<strong>${escapeHtml(active.title)}</strong><span>${escapeHtml(active.location || '')}</span>`)
        .addTo(map)
    }
    return () => { popupRef.current?.remove() }
  }, [activeId, listings])

  return <div ref={containerRef} className="task-map" aria-label="Mapa oglasa" />
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export default TaskMap
