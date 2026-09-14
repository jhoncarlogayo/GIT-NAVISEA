import { useEffect, useRef } from 'react'
import { addAlert } from '../services/api'
import axios from 'axios'

const PHP_API = 'http://localhost/navicap/backend/api/alerts.php'

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Save to MySQL via PHP
function saveToMySQL(vessel, zone, severity) {
  axios.post(PHP_API, {
    vessel_id:  vessel.mysqlId ?? null,
    alert_type: 'border_breach',
    severity,
    latitude:   parseFloat(vessel.latitude),
    longitude:  parseFloat(vessel.longitude),
    message:    `${vessel.name} breached restricted zone "${zone.name}"`,
  }).catch(() => {}) // silent fail if MySQL is down
}

export function useAlertDetector({ vessels, zones, onNewAlert }) {
  // Track which vessel+zone combos already fired to avoid duplicate alerts
  const fired = useRef(new Set())

  useEffect(() => {
    if (!vessels.length || !zones.length) return

    zones.forEach(zone => {
      if (!zone.active) return
      const zLat = parseFloat(zone.lat)
      const zLng = parseFloat(zone.lng)
      const zRad = parseFloat(zone.radius)
      if (isNaN(zLat) || isNaN(zLng) || isNaN(zRad)) return

      vessels.forEach(vessel => {
        const vLat = parseFloat(vessel.latitude)
        const vLng = parseFloat(vessel.longitude)
        if (isNaN(vLat) || isNaN(vLng)) return

        const dist = haversineMeters(vLat, vLng, zLat, zLng)
        const key  = `${vessel.id}_${zone.id}`
        const inside = dist <= zRad

        if (inside && !fired.current.has(key)) {
          fired.current.add(key)

          const severity = zone.type === 'danger' ? 'critical' : zone.type === 'warning' ? 'warning' : 'info'
          const alertData = {
            vesselName: vessel.name,
            alertType:  'border_breach',
            severity,
            latitude:   vLat,
            longitude:  vLng,
            message:    `${vessel.name} breached restricted zone "${zone.name}" (${Math.round(dist)}m from center)`,
          }

          // Save to Firebase
          addAlert(alertData)

          // Save to MySQL
          saveToMySQL(vessel, zone, severity)

          // Notify parent
          onNewAlert?.({ ...alertData, zoneName: zone.name })

        } else if (!inside) {
          // Reset so it can fire again if vessel re-enters
          fired.current.delete(key)
        }
      })
    })
  }, [vessels, zones, onNewAlert])
}
