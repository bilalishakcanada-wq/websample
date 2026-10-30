import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl, LngLatBounds, Popup, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { latinLabels, MAP_STYLE_URL } from '../utils/mapStyle'
// MapLibre 6 finds its worker next to its own module URL: after bundling that file no
// longer exists (blank map, no tiles). Let Vite bundle the worker and hand MapLibre the URL.
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(mapWorkerUrl)

const BIH_CENTER = [17.8, 44.1]
const NAVY = '#0a1f63'
const GOLD = '#1f5fff'

// Jobs in the same place (two posted as "Sarajevo", or the same ~1 km public point) would sit on one
// pin and hide each other: each gets its own spot on a small ring around that place (~350 m, always the
// same for the same job), so zoomed in every job has its own pin. The point stays a public, rounded one.
const SPREAD_KM = 0.35
const spreadPoints = (listings) => {
  const groups = new Map()
  listings.forEach((item) => {
    if (item.lat == null || item.lng == null) return
    const key = `${Number(item.lat).toFixed(3)},${Number(item.lng).toFixed(3)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  })
  const points = new Map()
  groups.forEach((items) => {
    if (items.length === 1) { points.set(items[0].id, [items[0].lng, items[0].lat]); return }
    const sorted = [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    sorted.forEach((item, index) => {
      const ring = Math.floor(index / 8)
      const onRing = Math.min(8, sorted.length - ring * 8)
      const angle = (2 * Math.PI * (index % 8)) / onRing + ring * 0.4
      const km = SPREAD_KM * (1 + ring * 0.7)
      const dLat = (km / 111.32) * Math.sin(angle)
      const dLng = (km / (111.32 * Math.max(Math.cos((item.lat * Math.PI) / 180), 0.01))) * Math.cos(angle)
      points.set(item.id, [item.lng + dLng, item.lat + dLat])
    })
  })
  return points
}

const priceText = (item) => (item.price == null ? 'Po dogovoru' : `${Number(item.price).toLocaleString('bs-BA')} KM`)

const toGeoJSON = (listings, activeId = null, points = spreadPoints(listings)) => ({
  type: 'FeatureCollection',
  features: listings
    .filter((item) => points.has(item.id))
    .map((item) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: points.get(item.id) },
      properties: {
        id: item.id,
        title: item.title,
        price: priceText(item),
        label: priceText(item),
        location: item.location || '',
        promo: item.promo || '',
        active: item.id === activeId,
      },
    })),
})

// The pins are pictures drawn here on a canvas, in the site's own font: a rounded price label with a small
// tail pointing at the place ("45 KM", a crown for VIP, a flame for Hitno), and a round badge with the count for a group. The
// map asks for each one the first time it needs it (setMissingStyleImageResolver), so they show even when the map's
// own font server is slow or unreachable.
const PIN_STYLES = {
  regular: { fill: '#ffffff', stroke: NAVY, text: NAVY },
  active: { fill: NAVY, stroke: '#ffffff', text: '#ffffff' },
  vip: { fill: GOLD, stroke: '#ffffff', text: '#ffffff' },
  urgent: { fill: '#fff4d6', stroke: '#c27c00', text: '#6b4500' },
}
// drawn at the screen's own pixel density (3 on most phones), so the text and edges stay sharp
const SCALE = Math.min(4, Math.max(2, Math.ceil(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)))
// lucide's crown and flame, the same icons the site uses for VIP and Hitno
const PIN_ICONS = {
  vip: ['M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z', 'M5 21h14'],
  urgent: ['M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4'],
}
const siteFont = () => {
  const family = typeof document !== 'undefined' ? getComputedStyle(document.body).fontFamily : ''
  return family || 'system-ui, sans-serif'
}
const roundedPath = (ctx, x, y, w, h, r, tail = 0) => {
  const mid = x + w / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  if (tail) {
    ctx.lineTo(mid + tail, y + h)
    ctx.lineTo(mid, y + h + tail * 1.2)
    ctx.lineTo(mid - tail, y + h)
  }
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}
const drawPin = (state, label) => {
  const style = PIN_STYLES[state] || PIN_STYLES.regular
  const icon = PIN_ICONS[state]
  const font = `700 ${13 * SCALE}px ${siteFont()}`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const pad = 11 * SCALE
  const iconSize = icon ? 14 * SCALE : 0
  const gap = icon ? 5 * SCALE : 0
  const bodyH = 28 * SCALE
  const tail = 6 * SCALE
  const blur = 5 * SCALE
  const textW = Math.ceil(probe.measureText(label).width)
  const w = textW + iconSize + gap + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = w + blur * 2
  canvas.height = bodyH + tail * 1.2 + blur * 2
  const ctx = canvas.getContext('2d')
  ctx.save()
  ctx.shadowColor = 'rgba(10, 31, 99, 0.22)'
  ctx.shadowBlur = blur
  ctx.shadowOffsetY = 1.5 * SCALE
  roundedPath(ctx, blur, blur, w, bodyH, bodyH / 2, tail)
  ctx.fillStyle = style.fill
  ctx.fill()
  ctx.restore()
  ctx.lineWidth = 1.5 * SCALE
  ctx.strokeStyle = style.stroke
  roundedPath(ctx, blur, blur, w, bodyH, bodyH / 2, tail)
  ctx.stroke()
  ctx.fillStyle = style.fill
  ctx.fill()
  const left = blur + pad
  const mid = blur + bodyH / 2
  if (icon) {
    ctx.save()
    ctx.translate(left, mid - iconSize / 2)
    ctx.scale(iconSize / 24, iconSize / 24)
    ctx.strokeStyle = style.text
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const d of icon) ctx.stroke(new Path2D(d))
    ctx.restore()
  }
  ctx.font = font
  ctx.fillStyle = style.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, left + iconSize + gap, mid + 0.5 * SCALE)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
const drawCluster = (count) => {
  const size = (Number(String(count).replace(/\D/g, '')) >= 20 ? 46 : Number(count) >= 5 ? 40 : 36) * SCALE
  const ring = 7 * SCALE
  const canvas = document.createElement('canvas')
  canvas.width = size + ring * 2
  canvas.height = size + ring * 2
  const ctx = canvas.getContext('2d')
  const c = canvas.width / 2
  ctx.fillStyle = 'rgba(10, 31, 99, 0.12)'
  ctx.beginPath(); ctx.arc(c, c, size / 2 + ring, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = NAVY
  ctx.beginPath(); ctx.arc(c, c, size / 2, 0, Math.PI * 2); ctx.fill()
  ctx.lineWidth = 2.5 * SCALE
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.font = `700 ${14 * SCALE}px ${siteFont()}`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(count), c, c + SCALE)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
const drawImage = (id) => {
  const [kind, state, ...rest] = id.split('|')
  if (kind === 'pin') return drawPin(state, rest.join('|'))
  if (kind === 'cluster') return drawCluster(state)
  return null
}
const resolveImage = (map) => (id) => {
  if (!id || map.hasImage(id)) return
  const image = drawImage(id)
  if (!image) return
  map.addImage(id, image, { pixelRatio: SCALE })
  // drawn before the site's font arrived: draw it again in that font (a new width, so replace it)
  const font = `700 13px ${siteFont()}`
  if (document.fonts && !document.fonts.check(font)) {
    document.fonts.load(font).then(() => {
      if (!map.hasImage(id)) return
      map.removeImage(id)
      map.addImage(id, drawImage(id), { pixelRatio: SCALE })
    }).catch(() => {})
  }
}
// the hovered / selected job's pin turns navy and comes to the front
const pinLayout = (state) => ({
  'icon-image': ['concat', 'pin|', ['case', ['get', 'active'], 'active', state], '|', ['get', 'label']],
  'icon-anchor': 'bottom',
  // the picture has room for its shadow under the tail: move it down so the tail's tip is on the place
  'icon-offset': [0, 4],
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  'symbol-sort-key': ['case', ['get', 'active'], 4, ['==', ['get', 'promo'], 'vip'], 3, ['==', ['get', 'promo'], ''], 1, 2],
})

// Hitno / VIP pins never hide inside a cluster: they get their own source, drawn on top
const splitPromoted = (listings) => [listings.filter((item) => !item.promo), listings.filter((item) => item.promo)]
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * origin ({ lat, lng }) is where the search measures distance from (a town, "Blizu mene" or a typed
 * address): it gets its own pin, which can be dragged, and onOriginMove gets the new { lat, lng }.
 */
function TaskMap({ listings, activeId, onSelect, focus, origin = null, originLabel = '', onOriginMove }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const readyRef = useRef(false)
  const popupRef = useRef(null)
  const vipCountRef = useRef(0)
  const onSelectRef = useRef(onSelect)
  const activeRef = useRef(activeId)
  useEffect(() => { activeRef.current = activeId }, [activeId])
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  const originRef = useRef(null)
  const onOriginMoveRef = useRef(onOriginMove)
  useEffect(() => { onOriginMoveRef.current = onOriginMove }, [onOriginMove])

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: BIH_CENTER,
      zoom: 6.4,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    let pulseFrame = 0
    mapRef.current = map
    latinLabels(map)
    map.setMissingStyleImageResolver(resolveImage(map))
    if (import.meta.env.DEV) window.__zadatakMap = map
    map.on('error', (event) => console.error('Map error', event?.error?.message || event))

    map.on('load', () => {
      // credits stay reachable behind the small ⓘ button (licence requires them), but start collapsed
      containerRef.current?.querySelectorAll('.maplibregl-ctrl-attrib').forEach((el) => {
        el.classList.remove('maplibregl-compact-show')
        el.removeAttribute('open')
      })
      map.addSource('tasks', {
        type: 'geojson',
        data: toGeoJSON([]),
        promoteId: 'id',
        cluster: true,
        clusterRadius: 50,
        // past this zoom every job has its own pin (jobs of one place are spread on a ring, above)
        clusterMaxZoom: 14,
      })

      // a group of jobs: a round badge with how many there are (a tap zooms in until they split)
      map.addLayer({
        id: 'clusters',
        type: 'symbol',
        source: 'tasks',
        filter: ['has', 'point_count'],
        layout: { 'icon-image': ['concat', 'cluster|', ['to-string', ['get', 'point_count_abbreviated']]], 'icon-allow-overlap': true },
      })
      // every single job: its price on a pin
      map.addLayer({
        id: 'points',
        type: 'symbol',
        source: 'tasks',
        filter: ['!', ['has', 'point_count']],
        layout: pinLayout('regular'),
      })

      // izdvojeni oglasi: VIP veći zlatni pin sa pulsirajućim prstenom, Hitno žuti pin
      map.addSource('promoted', { type: 'geojson', data: toGeoJSON([]), promoteId: 'id' })
      map.addLayer({
        id: 'promo-halo',
        type: 'circle',
        source: 'promoted',
        filter: ['==', ['get', 'promo'], 'vip'],
        paint: { 'circle-color': GOLD, 'circle-radius': 16, 'circle-opacity': 0.35, 'circle-stroke-width': 0 },
      })
      map.addLayer({
        id: 'promo-points',
        type: 'symbol',
        source: 'promoted',
        layout: pinLayout(['case', ['==', ['get', 'promo'], 'vip'], 'vip', 'urgent']),
      })
      if (!reducedMotion()) {
        const started = performance.now()
        const pulse = (now) => {
          if (mapRef.current !== map) return
          const t = ((now - started) % 1600) / 1600
          if (vipCountRef.current > 0 && map.getLayer('promo-halo')) {
            map.setPaintProperty('promo-halo', 'circle-radius', 4 + 14 * t)
            map.setPaintProperty('promo-halo', 'circle-opacity', 0.45 * (1 - t))
          }
          pulseFrame = window.requestAnimationFrame(pulse)
        }
        pulseFrame = window.requestAnimationFrame(pulse)
      }
      map.on('click', 'promo-points', (event) => {
        const feature = event.features?.[0]
        if (feature) onSelectRef.current?.(feature.properties.id)
      })
      map.on('mouseenter', 'promo-points', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'promo-points', () => { map.getCanvas().style.cursor = '' })

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
    const observer = new ResizeObserver(() => { map.resize(); map.triggerRepaint() })
    observer.observe(containerRef.current)

    // A WebGL canvas can lose its last frame when an ancestor finishes a CSS animation
    // (page fade-in) or the tab comes back to the foreground; MapLibre is idle then and
    // would stay blank, so ask for a fresh frame in those moments.
    // resize() (not just triggerRepaint), it re-applies the canvas size, which makes the
    // browser take a fresh frame from WebGL even when it had dropped the previous one
    const repaint = () => { if (mapRef.current === map) { map.resize(); map.triggerRepaint() } }
    const timers = [400, 1200, 2500].map((ms) => window.setTimeout(repaint, ms))
    map.once('idle', () => window.setTimeout(repaint, 50))
    const onVisible = () => { if (document.visibilityState === 'visible') repaint() }
    document.addEventListener('visibilitychange', onVisible)
    const onAnimationEnd = () => repaint()
    document.addEventListener('animationend', onAnimationEnd, true)

    return () => {
      window.cancelAnimationFrame(pulseFrame)
      timers.forEach((timer) => window.clearTimeout(timer))
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('animationend', onAnimationEnd, true)
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
      const [regular, promoted] = splitPromoted(listings)
      const points = spreadPoints(listings)
      map.getSource('tasks')?.setData(toGeoJSON(regular, activeRef.current, points))
      map.getSource('promoted')?.setData(toGeoJSON(promoted, activeRef.current, points))
      vipCountRef.current = promoted.filter((item) => item.promo === 'vip' && item.lat != null).length
      const data = toGeoJSON(listings)
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
    const promotedSource = map.getSource('promoted')

    popupRef.current?.remove()
    popupRef.current = null

    const active = listings.find((item) => item.id === activeId && item.lat != null)
    const [regular, promoted] = splitPromoted(listings)
    const points = spreadPoints(listings)
    source.setData(toGeoJSON(regular, activeId, points))
    promotedSource?.setData(toGeoJSON(promoted, activeId, points))
    if (active) {
      const at = points.get(active.id) || [active.lng, active.lat]
      popupRef.current = new Popup({ closeButton: false, offset: [0, -40], anchor: 'bottom', className: 'task-popup' })
        .setLngLat(at)
        .setHTML(`<strong>${escapeHtml(active.title)}</strong><span>${escapeHtml(active.location || '')}</span>`)
        .addTo(map)
    }
    return () => { popupRef.current?.remove() }
  }, [activeId, listings])

  // the search origin pin: follows the picked place, and a drag moves the search there
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!origin) { originRef.current?.remove(); originRef.current = null; return }
    if (!originRef.current) {
      const el = document.createElement('div')
      el.className = 'task-map-origin'
      el.setAttribute('role', 'img')
      const marker = new Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([origin.lng, origin.lat]).addTo(map)
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat()
        onOriginMoveRef.current?.({ lat, lng })
      })
      originRef.current = marker
    } else {
      originRef.current.setLngLat([origin.lng, origin.lat])
    }
    const el = originRef.current.getElement()
    const title = originLabel ? `${originLabel} · povuci iglu da promijeniš mjesto` : 'Povuci iglu da promijeniš mjesto'
    el.title = title
    el.setAttribute('aria-label', title)
  }, [origin, originLabel])
  useEffect(() => () => { originRef.current?.remove(); originRef.current = null }, [])

  return <div ref={containerRef} className="task-map" aria-label="Mapa oglasa" />
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export default TaskMap
