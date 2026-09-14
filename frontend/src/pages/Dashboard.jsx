import { useEffect, useState } from 'react'
import { listenVessels, listenAlerts, listenZones, listenTracking } from '../services/api'
import StatCard from '../components/StatCard'

const SEV_COLOR = { critical: '#dc2626', warning: '#d97706', info: '#2563eb' }
const SEV_BG    = { critical: '#fef2f2', warning: '#fffbeb', info: '#eff6ff' }
const STATUS_CLASS = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-500',
  alert:    'bg-red-100 text-red-600',
}
const TRACK_CLASS = {
  SAFE:    'bg-green-100 text-green-700',
  WARNING: 'bg-amber-100 text-amber-700',
  BREACH:  'bg-red-100 text-red-600',
}

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function Dashboard() {
  const [vessels,  setVessels]  = useState([])
  const [alerts,   setAlerts]   = useState([])
  const [zones,    setZones]    = useState([])
  const [tracking, setTracking] = useState(null)
  const [ready,    setReady]    = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    try {
      const u1 = listenVessels(d => { setVessels(d); setReady(true) })
      const u2 = listenAlerts(d  => setAlerts(d))
      const u3 = listenZones(d   => setZones(d))
      const u4 = listenTracking(d => setTracking(d && Object.keys(d).length ? d : null))
      return () => { u1(); u2(); u3(); u4() }
    } catch {
      setError('Firebase not configured. See src/services/firebase.js')
      setReady(true)
    }
  }, [])

  const totalVessels   = vessels.length
  const onlineVessels  = vessels.filter(v => v.status === 'active').length
  const totalAlerts    = alerts.length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length
  const recentAlerts   = alerts.slice(0, 5)
  const buoys          = zones.filter(z => z.loraNodeId)

  if (!ready) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">⏳ Connecting to Firebase…</div>
  )
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
      <div className="text-red-600 font-semibold mb-1">⚠️ Firebase Setup Required</div>
      <div className="text-slate-500 text-sm">{error}</div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">🔴 Live · Calapan City, Oriental Mindoro</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
          {new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Stat Cards — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Vessels"   value={totalVessels}   color="#2563eb" icon="🚢" />
        <StatCard label="Online Vessels"  value={onlineVessels}  color="#059669" icon="📡" />
        <StatCard label="Total Alerts"    value={totalAlerts}    color="#d97706" icon="🔔" />
        <StatCard label="Critical Alerts" value={criticalAlerts} color="#dc2626" icon="🚨" />
      </div>

      {/* Recent Alerts */}
      <div className="card p-4">
        <div className="section-title mb-3">Recent Alerts</div>
        {recentAlerts.length === 0
          ? <div className="text-slate-400 text-sm">No alerts recorded yet.</div>
          : <div className="flex flex-col gap-2">
              {recentAlerts.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: SEV_BG[a.severity] ?? '#f8fafc', borderLeft: `3px solid ${SEV_COLOR[a.severity] ?? '#94a3b8'}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{a.vesselName ?? '—'}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{a.alertType?.replace('_', ' ') ?? '—'} · {timeAgo(a.createdAt)}</div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0"
                    style={{ background: SEV_BG[a.severity], color: SEV_COLOR[a.severity], border: `1px solid ${SEV_COLOR[a.severity]}30` }}>
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Vessel Activity */}
      <div className="card p-4">
        <div className="section-title mb-3">Vessel Activity</div>
        {vessels.length === 0
          ? <div className="text-slate-400 text-sm">No vessels registered yet.</div>
          : <div className="flex flex-col gap-2">
              {vessels.map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{v.name ?? '—'}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {v.type ?? '—'} · {v.speed != null ? `${parseFloat(v.speed).toFixed(1)} kn` : '—'} · {timeAgo(v.updatedAt)}
                    </div>
                  </div>
                  <span className={`pill ml-2 flex-shrink-0 ${STATUS_CLASS[v.status] ?? 'bg-slate-100 text-slate-500'}`}>● {v.status}</span>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Live Tracking */}
      <div className="card p-4">
        <div className="section-title mb-3">Live Vessel Tracking</div>
        {!tracking
          ? <div className="text-slate-400 text-sm">No live data yet. Waiting for vessel ESP32.</div>
          : <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Vessel Device</span>
                <span className={`pill ${TRACK_CLASS[tracking.status] ?? 'bg-slate-100 text-slate-500'}`}>{tracking.status}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  ['Latitude',   tracking.lat     != null ? parseFloat(tracking.lat).toFixed(6)           : '—'],
                  ['Longitude',  tracking.lng     != null ? parseFloat(tracking.lng).toFixed(6)           : '—'],
                  ['Speed',      tracking.speed   != null ? `${parseFloat(tracking.speed).toFixed(1)} kn` : '—'],
                  ['Heading',    tracking.heading != null ? `${tracking.heading}°`                        : '—'],
                  ['Satellites', tracking.sats    != null ? tracking.sats                                 : '—'],
                  ['Updated',    tracking.ts      != null ? timeAgo(tracking.ts)                          : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{value}</div>
                  </div>
                ))}
              </div>
            </div>
        }
      </div>

      {/* Buoy Activity */}
      {buoys.length > 0 && (
        <div className="card p-4">
          <div className="section-title mb-3">Buoy Device Activity</div>
          <div className="flex flex-col gap-2">
            {buoys.map(z => {
              const lastMs   = z.lastBroadcast ? z.lastBroadcast * 1000 : null
              const secAgo   = lastMs ? Math.floor((Date.now() - lastMs) / 1000) : null
              const isOnline = secAgo !== null && secAgo < 60
              return (
                <div key={z.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{z.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Node: <code className="bg-slate-200 dark:bg-slate-700 text-blue-600 px-1 rounded">{z.loraNodeId}</code>
                      &nbsp;· {z.radius}m · {lastMs ? timeAgo(lastMs) : 'Never'}
                    </div>
                  </div>
                  <span className={`pill ml-2 flex-shrink-0 ${isOnline ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {isOnline ? '● Online' : '○ Offline'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
