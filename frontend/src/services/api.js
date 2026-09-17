// All Firebase Realtime Database operations for NaviSea
import { db } from './firebase'
import {
  ref, set, push, update, remove, get,
  onValue, off, serverTimestamp
} from 'firebase/database'

// ── VESSELS ──────────────────────────────────────────────────────────────

// Listen to all vessels in realtime (calls callback on every change)
const vesselLastSeen = {}  // track last time each vessel's coords changed
export function listenVessels(callback) {
  const r = ref(db, 'vessels')
  onValue(r, snap => {
    const data = snap.val() ?? {}
    const now = Date.now()
    const MIN_VALID_TS = 1577836800000
    const list = Object.entries(data).map(([id, v]) => {
      const ts = v.lastSeenAt
      const isValidTs = ts && ts >= MIN_VALID_TS

      if (isValidTs) {
        // Arduino has valid NTP — update web-side tracker too
        vesselLastSeen[id] = { key: `${v.latitude},${v.longitude}`, ts }
      } else {
        // Arduino timestamp is bad (millis) — track coord changes on web side
        const coordKey = `${v.latitude},${v.longitude}`
        if (!vesselLastSeen[id] || vesselLastSeen[id].key !== coordKey) {
          vesselLastSeen[id] = { key: coordKey, ts: now }
        }
      }

      return { id, ...v, lastSeenAt: vesselLastSeen[id]?.ts ?? null }
    })
    callback(list)
  })
  return () => off(r)
}

// Add a new vessel
export function addVessel(vessel) {
  const r = push(ref(db, 'vessels'))
  return set(r, { ...vessel, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

// Update a vessel
export function updateVessel(id, data) {
  return update(ref(db, `vessels/${id}`), { ...data, updatedAt: serverTimestamp() })
}

// Delete a vessel
export function deleteVessel(id) {
  return remove(ref(db, `vessels/${id}`))
}

// Update vessel position (called by sensor data)
export function updateVesselPosition(id, data) {
  return update(ref(db, `vessels/${id}`), { ...data, updatedAt: serverTimestamp() })
}

// ── ALERTS ───────────────────────────────────────────────────────────────

// Listen to all alerts in realtime
export function listenAlerts(callback) {
  const r = ref(db, 'alerts')
  onValue(r, snap => {
    const data = snap.val() ?? {}
    const list = Object.entries(data)
      .map(([id, a]) => ({ id, ...a }))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    callback(list)
  })
  return () => off(r)
}

// Add a new alert
export function addAlert(alert) {
  return push(ref(db, 'alerts'), { ...alert, acknowledged: false, createdAt: serverTimestamp() })
}

// Acknowledge an alert
export function acknowledgeAlert(id) {
  return update(ref(db, `alerts/${id}`), { acknowledged: true })
}

// ── SENSOR DATA ──────────────────────────────────────────────────────────

// Push a new sensor reading (called by Arduino via PHP bridge or directly)
export function pushSensorData(vesselId, data) {
  const entry = { vesselId, ...data, recordedAt: serverTimestamp() }
  // Save to sensor_data log
  push(ref(db, `sensor_data/${vesselId}`), entry)
  // Update vessel live position
  return updateVesselPosition(vesselId, {
    latitude:     data.latitude,
    longitude:    data.longitude,
    speed:        data.speed,
    heading:      data.heading,
    temperature:  data.temperature,
    batteryLevel: data.battery_level,
    status:       'active',
    lastSeenAt:   Date.now(),
  })
}

// ── RESTRICTED ZONES ─────────────────────────────────────────────────────

export function listenZones(callback) {
  const r = ref(db, 'restricted_zones')
  onValue(r, snap => {
    const data = snap.val() ?? {}
    const list = Object.entries(data).map(([id, z]) => ({ id, ...z }))
    callback(list)
  })
  return () => off(r)
}

// Listen to live vessel tracking — reads directly from /vessels table
export function listenTracking(callback) {
  const r = ref(db, 'vessels')
  onValue(r, snap => {
    const data    = snap.val() ?? {}
    const vessels = Object.entries(data).map(([id, v]) => ({ id, ...v }))
    const vessel  = vessels.find(v => {
      const lat = parseFloat(v.latitude)
      const lng = parseFloat(v.longitude)
      return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)
    })
    if (vessel) {
      const lat  = parseFloat(vessel.latitude)
      const lng  = parseFloat(vessel.longitude)
      const name = vessel.name || vessel.vesselName || vessel.mmsi || `Vessel-${vessel.id?.slice(-4)}`
      callback({ lat, lng,
        speed:      parseFloat(vessel.speed) || 0,
        heading:    parseFloat(vessel.heading) || 0,
        status:     vessel.status ?? 'active',
        vesselName: name,
        vesselId:   vessel.id,
        ts:         vessel.updatedAt ?? Date.now(),
      })
    } else {
      callback(null)
    }
  })
  return () => off(r)
}

// Push a zone violation alert
export function pushViolationAlert(vesselName, zoneName, zoneType, lat, lng, distToEdge, status) {
  const isBreach = status === 'BREACH'
  return push(ref(db, 'alerts'), {
    vesselName,
    alertType:  'zone_violation',
    severity:   isBreach ? 'critical' : 'warning',
    zoneName,
    zoneType,
    latitude:   lat,
    longitude:  lng,
    distanceM:  Math.round(distToEdge),
    status,
    message:    isBreach
      ? `${vesselName} is INSIDE restricted zone "${zoneName}"!`
      : `${vesselName} is ${Math.round(distToEdge)}m from the edge of "${zoneName}" at low speed`,
    acknowledged: false,
    createdAt:    Date.now(),
  })
}

// Mark exit time on the most recent unexited alert for a vessel+zone
export async function markViolationExit(vesselName, zoneName, exitedAt) {
  const snap = await get(ref(db, 'alerts'))
  if (!snap.exists()) return
  const entries = Object.entries(snap.val())
    .filter(([, a]) =>
      a.vesselName === vesselName &&
      a.zoneName   === zoneName   &&
      !a.exitedAt
    )
    .sort((a, b) => (b[1].createdAt ?? 0) - (a[1].createdAt ?? 0))
  if (entries.length === 0) return
  const [latestId] = entries[0]
  return update(ref(db, `alerts/${latestId}`), { exitedAt })
}

export function addZone(zone) {
  return push(ref(db, 'restricted_zones'), { ...zone, createdAt: serverTimestamp() })
}

export function updateZone(id, data) {
  return update(ref(db, `restricted_zones/${id}`), data)
}

export function deleteZone(id) {
  return remove(ref(db, `restricted_zones/${id}`))
}

// ── WEATHER (direct OpenWeatherMap — no PHP proxy needed) ───────────────
import axios from 'axios'
const OWM_KEY = '093258366a1433573166053d28fb591e'
const owm = axios.create({ baseURL: 'https://api.openweathermap.org/data/2.5' })

export const fetchWeather = async (lat, lon) => {
  const { data: d } = await owm.get(`/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_KEY}`)
  return {
    temp:        round(d.main.temp),
    feels_like:  round(d.main.feels_like),
    temp_min:    round(d.main.temp_min),
    temp_max:    round(d.main.temp_max),
    humidity:    d.main.humidity,
    pressure:    d.main.pressure,
    wind_speed:  d.wind.speed,
    wind_deg:    d.wind.deg,
    wind_gust:   d.wind.gust ?? 0,
    visibility:  round((d.visibility ?? 0) / 1000, 1),
    condition:   d.weather[0].main,
    description: d.weather[0].description,
    icon:        d.weather[0].icon,
    clouds:      d.clouds.all,
    sunrise:     d.sys.sunrise,
    sunset:      d.sys.sunset,
    city:        d.name,
  }
}

function round(n, dec = 1) { return Math.round(n * 10 ** dec) / 10 ** dec }
