import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MapView from './pages/MapView'
import Alerts from './pages/Alerts'
import Vessels from './pages/Vessels'
import Settings from './pages/Settings'
import RestrictedZone from './pages/RestrictedZone'
import WeatherPrediction from './pages/WeatherPrediction'
import Violations from './pages/Violations'
import Reports from './pages/Reports'
import AlertToast from './components/AlertToast'
import SplashScreen from './pages/SplashScreen'
import { useZoneMonitor } from './hooks/useZoneMonitor'
import { listenAlerts } from './services/api'

// Shared AudioContext — created once on first user interaction, reused after
let sharedCtx = null
function getAudioCtx() {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  // Resume if suspended (autoplay policy)  
  if (sharedCtx.state === 'suspended') sharedCtx.resume()
  return sharedCtx
}

// Unlock AudioContext on first user click anywhere
if (typeof window !== 'undefined') {
  const unlock = () => { getAudioCtx(); document.removeEventListener('click', unlock) }
  document.addEventListener('click', unlock)
}

function playBell() {
  try {
    const ctx   = getAudioCtx()
    const freqs = [880, 1100, 880]
    freqs.forEach((f, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = f; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.2
      gain.gain.setValueAtTime(0.5, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      osc.start(t); osc.stop(t + 0.18)
    })
  } catch { /* ignore */ }
}

export default function App() {
  const [showSplash,  setShowSplash]  = useState(() => !sessionStorage.getItem('navisea_launched'))
  const [toasts,      setToasts]      = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const knownIdsRef  = useRef(new Set())   // IDs seen on initial load
  const initializedRef = useRef(false)     // true after first Firebase snapshot
  const navigate     = useNavigate()

  useEffect(() => {
    const unsub = listenAlerts(alerts => {
      const unacked = alerts.filter(a => !a.acknowledged)
      setUnreadCount(unacked.length)

      if (!initializedRef.current) {
        // First snapshot — record all existing IDs, no bell
        initializedRef.current = true
        alerts.forEach(a => knownIdsRef.current.add(a.id))
        return
      }

      // Subsequent snapshots — find IDs we haven't seen yet
      const newAlerts = unacked.filter(a => !knownIdsRef.current.has(a.id))
      if (newAlerts.length > 0) {
        newAlerts.forEach(a => knownIdsRef.current.add(a.id))
        playBell()
        setToasts(t => [
          ...t,
          ...newAlerts.map(a => ({ id: a.id + '_t', severity: a.severity, message: a.message }))
        ])
      }
      // Track all IDs (including acknowledged) so we never re-ring
      alerts.forEach(a => knownIdsRef.current.add(a.id))
    })
    return unsub
  }, [])

  useZoneMonitor()

  if (showSplash) {
    // Hide splash after animation completes
    setTimeout(() => {
      sessionStorage.setItem('navisea_launched', '1')
      setShowSplash(false)
    }, 3400)
    return <SplashScreen />
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout unreadCount={unreadCount} onBellClick={() => navigate('/alerts')} />}>
          <Route index element={<Dashboard />} />
          <Route path="map" element={<MapView />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="vessels" element={<Vessels />} />
          <Route path="zones" element={<RestrictedZone />} />
          <Route path="weather" element={<WeatherPrediction />} />
          <Route path="violations" element={<Violations />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <AlertToast alerts={toasts} onDismiss={id => setToasts(t => t.filter(a => a.id !== id))} />
    </>
  )
}