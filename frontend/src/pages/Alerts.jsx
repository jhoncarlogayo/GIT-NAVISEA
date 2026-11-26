import { useEffect, useState } from 'react'
import { listenAlerts, assignAlert, acknowledgeAlert, archiveOldAlerts } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const SEV_COLOR = { critical: '#dc2626', warning: '#d97706', info: '#2563eb' }
const SEV_BG    = { critical: '#fef2f2', warning: '#fffbeb', info: '#eff6ff' }

const STATUS_LABEL = {
  active:       { label: 'Active',       color: '#dc2626', bg: '#fef2f2' },
  assigned:     { label: 'Assigned',     color: '#7c3aed', bg: '#f5f3ff' },
  acknowledged: { label: 'Acknowledged', color: '#059669', bg: '#f0fdf4' },
  archived:     { label: 'Archived',     color: '#94a3b8', bg: '#f8fafc' },
}

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Alerts() {
  const { user, role, users } = useAuth()
  const [alerts,  setAlerts]  = useState([])
  const [ready,   setReady]   = useState(false)
  const [tab,     setTab]     = useState('active')
  const [assigning, setAssigning] = useState(null) // alertId being assigned
  const navigate = useNavigate()

  useEffect(() => {
    archiveOldAlerts()
    const unsub = listenAlerts(data => { setAlerts(data); setReady(true) })
    return unsub
  }, [])

  const isAdmin = role === 'admin'

  // My assignments — alerts assigned to current user (staff/patrol)
  const myAssignments = alerts.filter(a =>
    a.assignedTo === user?.uid && a.status !== 'archived'
  )

  const filtered = alerts.filter(a => {
    if (tab === 'active')       return !a.status || a.status === 'active'
    if (tab === 'assigned')     return a.status === 'assigned'
    if (tab === 'acknowledged') return a.status === 'acknowledged'
    if (tab === 'archived')     return a.status === 'archived'
    return true
  })

  const tabCounts = {
    active:       alerts.filter(a => !a.status || a.status === 'active').length,
    assigned:     alerts.filter(a => a.status === 'assigned').length,
    acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
    archived:     alerts.filter(a => a.status === 'archived').length,
  }

  if (!ready) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">⏳ Loading alerts…</div>
  )

  return (
    <div className="flex flex-col gap-4">

      <div>
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">🚨 Border Alerts</h1>
        <span className="text-xs text-slate-400">🔴 Live — Firebase Realtime Database</span>
      </div>

      {/* My Assignments — visible to staff/patrol only */}
      {!isAdmin && myAssignments.length > 0 && (
        <div className="card p-4 border-l-4 border-purple-500">
          <div className="font-bold text-sm text-purple-700 dark:text-purple-300 mb-3">
            📋 My Assignments ({myAssignments.length})
          </div>
          <div className="flex flex-col gap-2">
            {myAssignments.map(a => (
              <AlertCard key={a.id} a={a} user={user} role={role} users={users}
                isAdmin={isAdmin} assigning={assigning} setAssigning={setAssigning}
                navigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {Object.entries(tabCounts).map(([key, count]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.72rem', transition: 'all 0.15s',
            background: tab === key ? '#fff' : 'transparent',
            color: tab === key ? STATUS_LABEL[key].color : '#94a3b8',
            boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            textTransform: 'capitalize',
          }}>
            {key} {count > 0 && <span style={{
              background: tab === key ? STATUS_LABEL[key].bg : 'rgba(0,0,0,0.06)',
              color: tab === key ? STATUS_LABEL[key].color : '#94a3b8',
              borderRadius: 10, padding: '1px 5px', fontSize: '0.65rem', marginLeft: 2,
            }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-green-700 font-medium text-sm">
          ✅ No {tab} alerts.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(a => (
            <AlertCard key={a.id} a={a} user={user} role={role} users={users}
              isAdmin={isAdmin} assigning={assigning} setAssigning={setAssigning}
              navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertCard({ a, user, role, users, isAdmin, assigning, setAssigning, navigate }) {
  const st = STATUS_LABEL[a.status ?? 'active']

  async function handleAssign(uid) {
    const u = users.find(x => x.uid === uid)
    if (!u) return
    await assignAlert(a.id, uid, u.email)
    setAssigning(null)
  }

  async function handleAcknowledge() {
    await acknowledgeAlert(a.id, user?.email)
  }

  // Staff/patrol can only acknowledge their own assignments
  const canAcknowledge = isAdmin
    ? a.status === 'assigned' || a.status === 'active'
    : a.assignedTo === user?.uid && a.status === 'assigned'

  return (
    <div className="card p-4" style={{ borderLeft: `4px solid ${SEV_COLOR[a.severity] ?? '#94a3b8'}` }}>

      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{a.vesselName ?? '—'}</div>
          <div className="text-xs text-slate-400 mt-0.5">{fmtTime(a.createdAt)}</div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: SEV_BG[a.severity] ?? '#f8fafc', color: SEV_COLOR[a.severity] ?? '#64748b' }}>
            {a.severity?.toUpperCase()}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: st.bg, color: st.color }}>
            {st.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2">
        <span>Type: <strong className="text-slate-600 dark:text-slate-300">{a.alertType?.replace('_', ' ') ?? '—'}</strong></span>
        {a.latitude && (
          <span>📍 <strong className="font-mono text-slate-600 dark:text-slate-300">{parseFloat(a.latitude).toFixed(4)}, {parseFloat(a.longitude).toFixed(4)}</strong></span>
        )}
      </div>
      {a.message && <div className="text-xs text-slate-400 mb-2 line-clamp-2">{a.message}</div>}

      {/* Assignment info */}
      {a.assignedToEmail && (
        <div className="text-xs text-purple-600 dark:text-purple-400 mb-2">
          👤 Assigned to: <strong>{a.assignedToEmail}</strong>
          {a.assignedAt && <span className="text-slate-400 ml-1">· {fmtTime(a.assignedAt)}</span>}
        </div>
      )}
      {a.acknowledgedBy && (
        <div className="text-xs text-green-600 mb-2">
          ✓ Acknowledged by: <strong>{a.acknowledgedBy}</strong>
          {a.acknowledgedAt && <span className="text-slate-400 ml-1">· {fmtTime(a.acknowledgedAt)}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-2">
        {/* View on map */}
        {a.latitude && (
          <button
            onClick={() => navigate(`/map?lat=${a.latitude}&lng=${a.longitude}&vessel=${encodeURIComponent(a.vesselName ?? '')}`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold w-full hover:bg-blue-700 transition-colors cursor-pointer"
          >
            📍 View Last Location
          </button>
        )}

        {/* Assign — admin only */}
        {isAdmin && a.status !== 'acknowledged' && a.status !== 'archived' && (
          assigning === a.id ? (
            <div className="flex flex-col gap-1">
              <select
                defaultValue=""
                onChange={e => e.target.value && handleAssign(e.target.value)}
                className="field w-full text-xs"
              >
                <option value="" disabled>Select personnel…</option>
                {users.filter(u => u.role !== 'admin').map(u => (
                  <option key={u.uid} value={u.uid}>{u.email} ({u.role})</option>
                ))}
              </select>
              <button onClick={() => setAssigning(null)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setAssigning(a.id)}
              className="text-white px-4 py-2 rounded-lg text-xs font-semibold w-full transition-colors cursor-pointer"
              style={{ background: '#7c3aed' }}>
              👤 {a.assignedTo ? 'Reassign' : 'Assign to Personnel'}
            </button>
          )
        )}

        {/* Acknowledge */}
        {canAcknowledge && (
          <button onClick={handleAcknowledge}
            className="text-white px-4 py-2 rounded-lg text-xs font-semibold w-full transition-colors cursor-pointer"
            style={{ background: '#059669' }}>
            ✓ Acknowledge
          </button>
        )}
      </div>
    </div>
  )
}
