import React, { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { listenVessels, listenZones, fetchWeather } from '../services/api'
import { getDistance } from '../hooks/useZoneMonitor'
// MapView.css removed — layout is now fully inline/responsive

const CALAPAN = [13.4115, 121.1803]

const ZONE_COLORS = {
  danger:    { stroke: '#ff4444', fill: '#ff4444' },
  warning:   { stroke: '#ffa500', fill: '#ffa500' },
  exclusion: { stroke: '#ff00ff', fill: '#ff00ff' },
}

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const OFFLINE_MS = 2 * 60 * 1000
function isOffline(v) {
  const ts = v.lastSeenAt ?? v.updatedAt
  if (!ts) return true
  return Date.now() - ts > OFFLINE_MS
}

function vesselIcon(heading = 0, color = '#00ff9d', offline = false) {
  const fill    = offline ? '#4b5563' : color
  const stroke  = offline ? '#9ca3af' : '#0a0f1e'
  const opacity = offline ? 0.5 : 1
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" opacity="${opacity}">
    <g transform="rotate(${heading},14,14)">
      <polygon points="14,2 20,24 14,20 8,24" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    </g></svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] })
}

function getVesselColor(v, activeZones) {
  if (isOffline(v)) return '#4b5563'
  if (!activeZones.length) return '#00ff9d'
  let closestDist = Infinity, closestZoneType = null, insideAny = false
  activeZones.forEach(z => {
    const dist       = getDistance(parseFloat(v.latitude), parseFloat(v.longitude), parseFloat(z.lat), parseFloat(z.lng))
    const distToEdge = Math.max(0, dist - parseFloat(z.radius))
    if (distToEdge < closestDist) { closestDist = distToEdge; closestZoneType = z.type }
    if (distToEdge < 1) insideAny = true
  })
  if (insideAny || closestDist <= 20) {
    if (closestZoneType === 'danger')    return '#ff4444'
    if (closestZoneType === 'warning')   return '#ffa500'
    if (closestZoneType === 'exclusion') return '#cc44ff'
  }
  return '#00ff9d'
}

function FitBounds({ vessels, done }) {
  const map = useMap()
  useEffect(() => {
    if (!done.current && vessels.length > 0) {
      const bounds = vessels
        .filter(v => parseFloat(v.latitude) !== 0 && parseFloat(v.longitude) !== 0)
        .map(v => [parseFloat(v.latitude), parseFloat(v.longitude)])
      if (bounds.length > 0) { map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 }); done.current = true }
    }
  }, [vessels, map, done])
  return null
}

const weatherEmoji = (c = '') => {
  c = c.toLowerCase()
  if (c.includes('thunder')) return '⛈️'
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️'
  if (c.includes('snow')) return '❄️'
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return '🌫️'
  if (c.includes('cloud')) return '☁️'
  return '☀️'
}

const TILES = {
  street:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  nautical:  { url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', attr: '© OpenSeaMap' },
}

export default function MapView() {
  const [vessels,    setVessels]    = useState([])
  const [zones,      setZones]      = useState([])
  const [selected,   setSelected]   = useState(null)
  const [weather,    setWeather]    = useState(null)
  const [wLoading,   setWLoading]   = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [layer,      setLayer]      = useState('street')
  const [isMobile,   setIsMobile]   = useState(() => window.innerWidth < 768)
  const done = useRef(false)

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  useEffect(() => {
    const u1 = listenVessels(data => { setVessels(data); setLastUpdate(new Date().toLocaleTimeString()) })
    const u2 = listenZones(data => setZones(data))
    return () => { u1(); u2() }
  }, [])

  const selectVessel = async (v) => {
    setSelected(v); setWeather(null); setWLoading(true)
    try { setWeather(await fetchWeather(v.latitude, v.longitude)) }
    catch { setWeather({ error: 'Weather unavailable' }) }
    finally { setWLoading(false) }
  }

  const activeZones  = zones.filter(z => z.active)
  const alertVessels = vessels.filter(v => v.status === 'alert').length

  function vesselZoneDistances(v) {
    return activeZones
      .map(z => {
        const dist       = getDistance(parseFloat(v.latitude), parseFloat(v.longitude), parseFloat(z.lat), parseFloat(z.lng))
        const distToEdge = Math.max(0, dist - parseFloat(z.radius))
        return { name: z.name, distToEdge: Math.round(distToEdge), inside: distToEdge < 1 }
      })
      .sort((a, b) => a.distToEdge - b.distToEdge)
  }

  function getZoneState(z) {
    for (const v of vessels) {
      if (isOffline(v)) continue
      const lat = parseFloat(v.latitude), lng = parseFloat(v.longitude)
      if (!lat && !lng) continue
      const dist       = getDistance(lat, lng, parseFloat(z.lat), parseFloat(z.lng))
      const distToEdge = Math.max(0, dist - parseFloat(z.radius))
      if (distToEdge < 1)   return 'breach'
      if (distToEdge <= 20) return 'warning'
    }
    return 'safe'
  }

  // ── Shared map content ──────────────────────────────────────────────────
  const mapContent = (
    <MapContainer center={CALAPAN} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer key={layer} url={TILES[layer].url} attribution={TILES[layer].attr} />
      {layer === 'satellite' && <TileLayer url={TILES.nautical.url} attribution={TILES.nautical.attr} opacity={0.7} />}

      {zones.map(z => {
        const col   = ZONE_COLORS[z.type] ?? ZONE_COLORS.danger
        const state = z.active ? getZoneState(z) : 'safe'
        const innerFill    = state === 'breach' ? '#ff0000' : state === 'warning' ? '#ffaa00' : col.fill
        const innerOpacity = state === 'breach' ? 0.45 : state === 'warning' ? 0.30 : 0.15
        const innerWeight  = state === 'breach' ? 3 : state === 'warning' ? 2.5 : 2
        const outerColor   = state === 'breach' ? '#ff0000' : state === 'warning' ? '#ffaa00' : col.stroke
        const outerOpacity = state === 'safe' ? 0.35 : 0.7
        return (
          <React.Fragment key={z.id}>
            <Circle center={[parseFloat(z.lat), parseFloat(z.lng)]} radius={parseFloat(z.radius) + 20}
              pathOptions={{ color: outerColor, fillColor: 'transparent', fillOpacity: 0, dashArray: '6 5', weight: 1.5, opacity: z.active ? outerOpacity : 0.2 }} />
            <Circle center={[parseFloat(z.lat), parseFloat(z.lng)]} radius={parseFloat(z.radius)}
              pathOptions={{ color: innerFill, fillColor: innerFill, fillOpacity: z.active ? innerOpacity : 0.05, weight: z.active ? innerWeight : 1, opacity: z.active ? 1 : 0.35 }}>
              <Popup>
                <div style={{ minWidth: 150, fontFamily: 'Segoe UI', fontSize: 12 }}>
                  <strong>{z.name}</strong><br />
                  <span style={{ color: col.stroke, fontWeight: 600 }}>{z.type.toUpperCase()}</span><br />
                  Radius: {z.radius}m<br />
                  <span style={{ color: state === 'breach' ? '#dc2626' : state === 'warning' ? '#d97706' : '#16a34a', fontWeight: 700 }}>
                    {state === 'breach' ? '🚨 VESSEL INSIDE' : state === 'warning' ? '⚠️ VESSEL APPROACHING' : '✅ Clear'}
                  </span><br />
                  <span style={{ color: z.active ? '#007a4d' : '#888' }}>{z.active ? '● Active' : '○ Inactive'}</span>
                </div>
              </Popup>
            </Circle>
          </React.Fragment>
        )
      })}

      {vessels.map(v => {
        const offline = isOffline(v)
        return (
          <Marker key={v.id} position={[parseFloat(v.latitude), parseFloat(v.longitude)]}
            icon={vesselIcon(parseFloat(v.heading || 0), getVesselColor(v, activeZones), offline)}
            eventHandlers={{ click: () => selectVessel(v) }}>
            <Popup>
              <div style={{ fontFamily: 'Segoe UI', fontSize: 12, minWidth: 150, color: '#2d3748', lineHeight: 1.6 }}>
                <strong style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{v.name}</strong>
                <span style={{ display: 'inline-block', fontSize: 10, padding: '1px 8px', borderRadius: 10, marginBottom: 6, fontWeight: 600,
                  background: offline ? '#e5e7eb' : v.status === 'active' ? '#d1fae5' : '#fee2e2',
                  color: offline ? '#6b7280' : v.status === 'active' ? '#065f46' : '#991b1b' }}>
                  {offline ? '⚫ Offline' : v.status}
                </span>
                <div>Speed: {offline ? '—' : `${parseFloat(v.speed || 0).toFixed(1)} kn`} | Hdg: {offline ? '—' : `${v.heading || 0}°`}</div>
                <div>📍 {parseFloat(v.latitude).toFixed(5)}, {parseFloat(v.longitude).toFixed(5)}</div>
                {activeZones.length > 0 && (
                  <div style={{ marginTop: 6, borderTop: '1px solid #e2e8f0', paddingTop: 5 }}>
                    <div style={{ fontWeight: 600, fontSize: 11, color: '#64748b', marginBottom: 3 }}>🚫 Zone Distances</div>
                    {vesselZoneDistances(v).map(d => (
                      <div key={d.name} style={{ fontSize: 11, color: d.inside ? '#dc2626' : d.distToEdge <= 20 ? '#d97706' : '#16a34a', fontWeight: d.distToEdge <= 20 ? 700 : 400 }}>
                        {d.inside ? '🚨' : d.distToEdge <= 20 ? '⚠️' : '✅'} {d.name}: {d.inside ? 'INSIDE' : `${d.distToEdge}m`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}

      <FitBounds vessels={vessels} done={done} />
    </MapContainer>
  )

  // ── Map badge ───────────────────────────────────────────────────────────
  const onlineVessels = vessels.filter(v => !isOffline(v))
  const mapBadge = onlineVessels.length > 0 ? (
    <div style={{
      position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
      background: alertVessels > 0 ? 'rgba(220,38,38,0.92)' : 'rgba(255,255,255,0.95)',
      border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px',
      fontSize: '0.75rem', color: alertVessels > 0 ? '#fff' : '#64748b',
      pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', backdropFilter: 'blur(4px)',
    }}>
      🚢 {onlineVessels.length} vessel{onlineVessels.length !== 1 ? 's' : ''} online &nbsp;·&nbsp;
      {alertVessels > 0 && <><span>🔴 {alertVessels} alert</span> &nbsp;·&nbsp;</>}
      🚫 {activeZones.length} active zones
    </div>
  ) : null

  // ── Layer toggle ────────────────────────────────────────────────────────
  const layerToggle = (
    <div style={{ display: 'flex', gap: 4 }}>
      {Object.keys(TILES).map(l => (
        <button key={l} onClick={() => setLayer(l)} style={{
          padding: isMobile ? '4px 8px' : '5px 12px',
          fontSize: isMobile ? '0.7rem' : '0.78rem',
          fontWeight: 500, cursor: 'pointer', borderRadius: 6,
          border: '1px solid',
          borderColor: layer === l ? '#2563eb' : '#e2e8f0',
          background: layer === l ? '#eff6ff' : '#fff',
          color: layer === l ? '#2563eb' : '#64748b',
          transition: 'all 0.15s',
        }}>
          {l.charAt(0).toUpperCase() + l.slice(1)}
        </button>
      ))}
    </div>
  )

  // ── Side panel content ──────────────────────────────────────────────────
  const sidePanel = (
    <>
      {/* Vessels */}
      <div style={isMobile ? mob.panelCard : desk.panelSection}>
        <div style={isMobile ? mob.panelTitle : desk.panelTitle}>Vessels</div>
        {vessels.length === 0 && <div style={{ color: '#8aa0b8', fontSize: '0.82rem' }}>⏳ No vessels yet…</div>}
        {vessels.map(v => {
          const offline  = isOffline(v)
          const dists    = offline ? [] : vesselZoneDistances(v)
          const closest  = dists[0]
          const dotColor = getVesselColor(v, activeZones)
          return (
            <div key={v.id} onClick={() => selectVessel(v)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 6px', borderRadius: 6, cursor: 'pointer',
              background: selected?.id === v.id ? 'rgba(37,99,235,0.08)' : 'transparent',
              transition: 'background 0.12s',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: offline ? '#4b5563' : dotColor, flexShrink: 0, display: 'inline-block', opacity: offline ? 0.5 : 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: offline ? '#6b7280' : '#e0e6f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.name}
                  {offline && <span style={{ marginLeft: 5, fontSize: '0.62rem', background: '#374151', color: '#9ca3af', borderRadius: 3, padding: '1px 4px' }}>OFFLINE</span>}
                </div>
                <div style={{ fontSize: '0.73rem', color: '#8aa0b8' }}>{offline ? 'No signal' : `${parseFloat(v.speed || 0).toFixed(1)} kn · ${v.type}`}</div>
                {closest && (
                  <div style={{ fontSize: '0.7rem', marginTop: 2, fontWeight: 600, color: closest.inside ? '#ff4444' : closest.distToEdge <= 20 ? '#ffa500' : '#8aa0b8' }}>
                    {closest.inside ? `🚨 INSIDE ${closest.name}` : `🚫 ${closest.distToEdge}m from ${closest.name}`}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Zones legend */}
      <div style={isMobile ? mob.panelCard : desk.panelSection}>
        <div style={isMobile ? mob.panelTitle : desk.panelTitle}>🚫 Zones ({zones.length})</div>
        {zones.length === 0 && <div style={{ color: '#8aa0b8', fontSize: '0.78rem' }}>No zones configured.</div>}
        {zones.map(z => {
          const col = ZONE_COLORS[z.type] ?? ZONE_COLORS.danger
          return (
            <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.stroke, flexShrink: 0, opacity: z.active ? 1 : 0.4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', color: '#e0e6f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{z.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#8aa0b8' }}>{z.radius}m · {z.active ? 'Active' : 'Off'}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Weather */}
      {selected && (
        <div style={isMobile ? mob.panelCard : desk.panelSection}>
          <div style={isMobile ? mob.panelTitle : desk.panelTitle}>🌤️ {selected.name}</div>
          {wLoading && <div style={{ color: '#8aa0b8', fontSize: '0.82rem' }}>Fetching…</div>}
          {weather?.error && <div style={{ color: '#f87171', fontSize: '0.82rem' }}>{weather.error}</div>}
          {weather && !weather.error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
                <span style={{ fontSize: '1.6rem' }}>{weatherEmoji(weather.condition)}</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#60a5fa' }}>{weather.temp}°C</span>
                <span style={{ fontSize: '0.73rem', color: '#8aa0b8', textTransform: 'capitalize' }}>{weather.description}</span>
              </div>
              {[['💧 Humidity', `${weather.humidity}%`], ['💨 Wind', `${weather.wind_speed} m/s`], ['👁️ Visibility', `${weather.visibility} km`], ['🌡️ Feels like', `${weather.feels_like}°C`]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#e0e6f0' }}>
                  <span style={{ color: '#8aa0b8' }}>{k}</span><span>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 6, padding: '7px 10px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 600,
                background: weather.wind_speed > 10 || weather.condition === 'Thunderstorm' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.12)',
                color:      weather.wind_speed > 10 || weather.condition === 'Thunderstorm' ? '#fca5a5' : '#6ee7b7',
                border:     `1px solid ${weather.wind_speed > 10 || weather.condition === 'Thunderstorm' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
              }}>
                {weather.condition === 'Thunderstorm' ? '⚠️ DANGER — Thunderstorm. Return to port.'
                  : weather.wind_speed > 10 ? '⚠️ CAUTION — High winds at sea.'
                  : '✅ Safe conditions for navigation.'}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )

  // ── DESKTOP layout ──────────────────────────────────────────────────────
  if (!isMobile) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>🗺️ Live Marine Map — Calapan City, Oriental Mindoro</span>
          {lastUpdate && <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: 10 }}>Updated: {lastUpdate}</span>}
        </div>
        {layerToggle}
      </div>

      {/* Body: map + side panel */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        {/* Map — fills all remaining height */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {mapContent}
          {mapBadge}
        </div>
        {/* Side panel */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', minHeight: 0 }}>
          {sidePanel}
        </div>
      </div>
    </div>
  )

  // ── MOBILE layout ───────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>🗺️ Live Map</span>
        {layerToggle}
      </div>

      {/* Map — 55vh on mobile */}
      <div style={{ width: '100%', height: '55vh', minHeight: 260, borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {mapContent}
        {mapBadge}
      </div>

      {/* Side panel — stacked cards below map */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sidePanel}
      </div>
    </div>
  )
}

// ── Style tokens ────────────────────────────────────────────────────────────
const desk = {
  panelSection: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, flexShrink: 0 },
  panelTitle:   { color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
}
const mob = {
  panelCard:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  panelTitle: { color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
}
