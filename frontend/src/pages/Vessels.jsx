import { useEffect, useState } from 'react'
import { listenVessels, addVessel, updateVessel, deleteVessel } from '../services/api'

const OFFLINE_MS = 2 * 60 * 1000
const getStatus = v => {
  if (!v.lastSeenAt || Date.now() - v.lastSeenAt > OFFLINE_MS) return 'offline'
  return 'active'
}
const STATUS_STYLE = {
  active:  { bg: '#dcfce7', color: '#15803d' },
  offline: { bg: '#f1f5f9', color: '#94a3b8' },
  alert:   { bg: '#fee2e2', color: '#dc2626' },
  inactive:{ bg: '#f1f5f9', color: '#64748b' },
}
const EMPTY = { name: '', mmsi: '', type: 'fishing' }

export default function Vessels() {
  const [vessels,   setVessels]   = useState([])
  const [ready,     setReady]     = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState(EMPTY)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    const unsub = listenVessels(data => { setVessels(data); setReady(true) })
    return unsub
  }, [])

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const openAdd = () => { setEditId(null); setForm(EMPTY); setFormError(null); setShowForm(true) }
  const openEdit = (v) => {
    setEditId(v.id)
    setForm({ name: v.name || '', mmsi: v.mmsi || '', type: v.type || 'fishing' })
    setFormError(null); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleCancel = () => { setShowForm(false); setEditId(null); setForm(EMPTY); setFormError(null) }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim() || !form.mmsi.trim()) { setFormError('Vessel Name and MMSI are required.'); return }
    setSaving(true); setFormError(null)
    try {
      if (editId) {
        await updateVessel(editId, { name: form.name, mmsi: form.mmsi, type: form.type, updatedAt: Date.now() })
      } else {
        await addVessel({ ...form, latitude: 0, longitude: 0, speed: 0, heading: 0, updatedAt: Date.now() })
      }
      handleCancel()
    } catch { setFormError('Failed to save. Check Firebase config.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete vessel "${name || 'Unknown'}"?`)) return
    await deleteVessel(id)
  }

  if (!ready) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">⏳ Connecting to Firebase…</div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">🚢 Vessels</h1>
          <span className="text-xs text-slate-400">🔴 Live — Firebase Realtime Database</span>
        </div>
        {!showForm && (
          <button onClick={openAdd} className="btn-primary">+ Add</button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 text-sm">
            {editId ? '✏️ Edit Vessel' : '➕ Register New Vessel'}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Vessel Name *</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. MV Coastal Star"
                className="field w-full" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">MMSI Number *</label>
              <input name="mmsi" value={form.mmsi} onChange={handleChange} placeholder="e.g. 419000001"
                className="field w-full" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Vessel Type</label>
              <select name="type" value={form.type} onChange={handleChange} className="field w-full">
                {['fishing','cargo','patrol','unknown'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
                ))}
              </select>
            </div>
            {formError && <div className="text-red-500 text-xs">{formError}</div>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : editId ? '💾 Update' : '💾 Save'}
              </button>
              <button type="button" onClick={handleCancel} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Vessel cards */}
      {vessels.length === 0 && !showForm && (
        <div className="text-slate-400 text-sm text-center py-8">No vessels registered yet.</div>
      )}
      <div className="flex flex-col gap-3">
        {vessels.map(v => {
          const s = getStatus(v)
          const st = STATUS_STYLE[s] ?? STATUS_STYLE.inactive
          const ts = v.lastSeenAt ?? v.updatedAt
          return (
            <div key={v.id} className={`card p-4 ${editId === v.id ? 'ring-2 ring-blue-400' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{v.name || <span className="text-slate-300 italic">No Name</span>}</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">{v.mmsi || '—'} · <span className="capitalize">{v.type || 'unknown'}</span></div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: st.bg, color: st.color }}>
                  {s === 'offline' ? '⚫ Offline' : '🟢 Live'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <div className="text-xs text-slate-400 mb-0.5">Latitude</div>
                  <div className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">{v.latitude ? parseFloat(v.latitude).toFixed(5) : '0.00000'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <div className="text-xs text-slate-400 mb-0.5">Longitude</div>
                  <div className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">{v.longitude ? parseFloat(v.longitude).toFixed(5) : '0.00000'}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {v.lastSeenAt ? `Last seen ${new Date(v.lastSeenAt).toLocaleTimeString()}` : 'Never seen'}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(v)}
                    className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(v.id, v.name)}
                    className="bg-red-50 text-red-500 border border-red-200 px-3 py-1.5 rounded-lg text-xs hover:bg-red-100 transition-colors cursor-pointer">
                    🗑
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
