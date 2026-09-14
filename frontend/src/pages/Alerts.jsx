import { useEffect, useState } from 'react'
import { listenAlerts, acknowledgeAlert } from '../services/api'

const SEV_COLOR = { critical: '#dc2626', warning: '#d97706', info: '#2563eb' }
const SEV_BG    = { critical: '#fef2f2', warning: '#fffbeb', info: '#eff6ff' }

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [ready,  setReady]  = useState(false)

  useEffect(() => {
    const unsub = listenAlerts(data => { setAlerts(data); setReady(true) })
    return unsub
  }, [])

  if (!ready) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">⏳ Loading alerts…</div>
  )

  return (
    <div className="flex flex-col gap-4">

      <div>
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">🚨 Border Alerts</h1>
        <span className="text-xs text-slate-400">🔴 Live — Firebase Realtime Database</span>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-green-700 font-medium text-sm">
          ✅ No alerts. All vessels are within safe zones.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map(a => (
            <div key={a.id} className="card p-4"
              style={{ borderLeft: `4px solid ${SEV_COLOR[a.severity] ?? '#94a3b8'}` }}>
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{a.vesselName ?? '—'}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{fmtTime(a.createdAt)}</div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: SEV_BG[a.severity] ?? '#f8fafc', color: SEV_COLOR[a.severity] ?? '#64748b', border: `1px solid ${SEV_COLOR[a.severity] ?? '#e2e8f0'}30` }}>
                  {a.severity?.toUpperCase()}
                </span>
              </div>

              {/* Details */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
                <span>Type: <strong className="text-slate-600 dark:text-slate-300">{a.alertType?.replace('_', ' ') ?? '—'}</strong></span>
                {a.latitude && (
                  <span>📍 <strong className="font-mono text-slate-600 dark:text-slate-300">{parseFloat(a.latitude).toFixed(4)}, {parseFloat(a.longitude).toFixed(4)}</strong></span>
                )}
              </div>
              {a.message && <div className="text-xs text-slate-400 mb-3 line-clamp-2">{a.message}</div>}

              {/* Action */}
              {a.acknowledged
                ? <span className="text-green-600 text-xs font-semibold">✓ Acknowledged</span>
                : <button
                    onClick={() => acknowledgeAlert(a.id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold w-full hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    Acknowledge
                  </button>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
