import { useEffect, useRef } from 'react'
import { listenVessels, listenZones, pushViolationAlert, markViolationExit } from '../services/api'
import { db } from '../services/firebase'
import { ref, update } from 'firebase/database'

const NOTIF_INTERVAL_MS = 10 * 1000
const ALERT_INTERVAL_MS = 10 * 1000
const OFFLINE_MS        = 2 * 60 * 1000
const MIN_VALID_TS      = 1577836800000  // Jan 1 2020 — below this = millis() not Unix time

function getDistance(lat1, lon1, lat2, lon2) {
  const R    = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Loud alarm sound — maririnig kahit may background noise
function playBeep(type = 'warning') {
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)()
    const count = type === 'breach' ? 5 : 3
    const freq  = type === 'breach' ? 1200 : 900
    const dur   = type === 'breach' ? 0.3  : 0.25
    const gap   = type === 'breach' ? 0.15 : 0.2

    for (let i = 0; i < count; i++) {
      const osc   = ctx.createOscillator()
      const gain  = ctx.createGain()
      // Add distortion for louder perceived volume
      const dist  = ctx.createWaveShaper()
      const curve = new Float32Array(256)
      for (let j = 0; j < 256; j++) {
        const x = (j * 2) / 256 - 1
        curve[j] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x))
      }
      dist.curve = curve

      osc.connect(gain)
      gain.connect(dist)
      dist.connect(ctx.destination)

      osc.frequency.value = freq
      osc.type = 'square'  // square wave is louder than sine

      const t = ctx.currentTime + i * (dur + gap)
      gain.gain.setValueAtTime(1.0, t)  // max volume
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t)
      osc.stop(t + dur)
    }
  } catch { /* ignore */ }
}

// warning = 2 notifications, critical = 4 notifications
function showNotifications(title, body, count) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  for (let i = 0; i < count; i++) {
    setTimeout(() => new Notification(title, { body, icon: '/favicon.svg' }), i * 800)
  }
}

function setBuzzer(vesselId, active) {
  if (!vesselId) return
  update(ref(db, `vessels/${vesselId}`), { buzzer: active, buzzerSetAt: Date.now() }).catch(() => {})
}

export function useZoneMonitor({ onNewAlert } = {}) {
  const zonesRef        = useRef([])
  const zoneTimersRef   = useRef({})
  const inViolationRef  = useRef(false)
  const activeZonesRef  = useRef(new Set())

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const unsubZones = listenZones(zones => {
      zonesRef.current = zones.filter(z => z.active && z.lat && z.lng && z.radius)
    })
    const unsubTrack = listenVessels(vessels => {
      vessels.forEach(v => {
        const ts = v.lastSeenAt ?? v.updatedAt
        if (!ts || ts < MIN_VALID_TS || Date.now() - ts > OFFLINE_MS) return  // skip offline vessels
        const lat = parseFloat(v.latitude)
        const lng = parseFloat(v.longitude)
        if (!lat && !lng) return
        checkViolations({
          lat,
          lng,
          speed:      parseFloat(v.speed) || 0,
          vesselName: v.name,
          vesselId:   v.id,
        })
      })
    })
    return () => { unsubZones(); unsubTrack() }
  }, [])

  function checkViolations(tracking) {
    const { lat, lng, speed, vesselName, vesselId } = tracking
    const now = Date.now()
    let anyViolation = false

    zonesRef.current.forEach(zone => {
      const dist       = getDistance(lat, lng, parseFloat(zone.lat), parseFloat(zone.lng))
      const distToEdge = Math.max(0, dist - parseFloat(zone.radius))
      const isBreach   = distToEdge < 3
      const isWarning  = distToEdge >= 3 && distToEdge <= 20 && (speed ?? 0) <= 10

      const timerKey = `${vesselId}_${zone.id}`

      if (!isBreach && !isWarning) {
        delete zoneTimersRef.current[timerKey]
        return
      }

      anyViolation = true
      const notifCount = isBreach ? 4 : 2
      const title = isBreach ? `🚨 BREACH — ${zone.name}` : `⚠️ WARNING — ${zone.name}`
      const body  = isBreach
        ? `${vesselName} is INSIDE restricted zone "${zone.name}"!`
        : `${vesselName} is ${Math.round(distToEdge)}m from "${zone.name}" at low speed`

      if (!zoneTimersRef.current[timerKey]) {
        zoneTimersRef.current[timerKey] = { lastNotif: 0, lastAlert: 0 }
      }
      const timers = zoneTimersRef.current[timerKey]

      if (now - timers.lastNotif >= NOTIF_INTERVAL_MS) {
        timers.lastNotif = now
        playBeep(isBreach ? 'breach' : 'warning')
        showNotifications(title, body, notifCount)
        onNewAlert?.({ severity: isBreach ? 'critical' : 'warning', message: body })
      }

      if (now - timers.lastAlert >= ALERT_INTERVAL_MS) {
        timers.lastAlert = now
        pushViolationAlert(vesselName, zone.name, zone.type, lat, lng, distToEdge, isBreach ? 'BREACH' : 'WARNING')
      }
    })

    // Detect zones the vessel just LEFT — write exitedAt
    const nowActive = new Set(
      zonesRef.current
        .filter(zone => {
          const dist       = getDistance(lat, lng, parseFloat(zone.lat), parseFloat(zone.lng))
          const distToEdge = Math.max(0, dist - parseFloat(zone.radius))
          return distToEdge < 3 || (distToEdge <= 20 && (speed ?? 0) <= 10)
        })
        .map(z => z.id)
    )
    activeZonesRef.current.forEach(zoneId => {
      if (!nowActive.has(zoneId)) {
        const zone = zonesRef.current.find(z => z.id === zoneId)
        if (zone) markViolationExit(vesselName, zone.name, Date.now()).catch(() => {})
      }
    })
    activeZonesRef.current = nowActive

    // Buzzer ON only when there is a real violation
    // Buzzer OFF immediately when vessel is safe — no delay
    if (anyViolation && !inViolationRef.current) {
      inViolationRef.current = true
      setBuzzer(vesselId, true)
    } else if (!anyViolation && inViolationRef.current) {
      inViolationRef.current = false
      setBuzzer(tracking.vesselId, false)
    }
  }
}

// Export getDistance so MapView can use it
export { getDistance }
