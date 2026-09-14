import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { listenZones, addZone, deleteZone, updateZone } from '../services/api'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const ZONE_COLORS = {
  danger:    { stroke: '#ef4444', fill: '#ef4444' },
  warning:   { stroke: '#f97316', fill: '#f97316' },
  exclusion: { stroke: '#a855f7', fill: '#a855f7' },
}

const EMPTY = { name: '', type: 'danger', radius: 500, lat: '', lng: '', loraNodeId: '', active: true }

function MapClickHandler({ onMapClick, picking }) {
  useMapEvents({ click(e) { if (picking) onMapClick(e.latlng) } })
  return null
}

export default function RestrictedZone() {
  const [zones,     setZones]     = useState([])
  const [ready,     setReady]     = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(EMPTY)
  const [picking,   setPicking]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState(null)
  const [editId,    setEditId]    = useState(null)
  const [isMobile,  setIsMobile]  = useState(() => window.innerWidth < 768)
  const mapRef = useRef(null)

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  useEffect(() => {
    const unsub = listenZones(data => { setZones(data); setReady(true) })
    return unsub
  }, [])

  const handleChange = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    if (name === 'lat' || name === 'lng') {
      const nf = { ...form, [name]: value }
      const lat = parseFloat(nf.lat), lng = parseFloat(nf.lng)
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)
        mapRef.current?.setView([lat, lng], 14)
    }
  }

  const handleMapClick = ({ lat, lng }) => { setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) })); setPicking(false) }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim())    { setFormError('Zone name is required.'); return }
    if (!form.lat || !form.lng) { setFormError('Coordinates are required.'); return }
    const lat = parseFloat(form.lat), lng = parseFloat(form.lng)
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) { setFormError('Invalid coordinates.'); return }
    if (!form.radius || form.radius <= 0) { setFormError('Radius must be at least 1 meter.'); return }
    setSaving(true); setFormError(null)
    const payload = { name: form.name, type: form.type, radius: parseFloat(form.radius), lat, lng, loraNodeId: form.loraNodeId.trim().toUpperCase(), active: form.active }
    try {
      if (editId) { await updateZone(editId, payload); setEditId(null) }
      else        { await addZone(payload) }
      setForm(EMPTY); setShowForm(false)
    } catch { setFormError('Failed to save. Check Firebase config.') }
    finally { setSaving(false) }
  }

  const handleEdit = z => {
    setForm({ name: z.name, type: z.type, radius: z.radius, lat: z.lat, lng: z.lng, loraNodeId: z.loraNodeId ?? '', active: z.active ?? true })
    setEditId(z.id); setShowForm(true); setFormError(null)
    mapRef.current?.setView([z.lat, z.lng], 14)
  }

  const handleDelete = async (id, name) => { if (!confirm(`Delete zone "${name}"?`)) return; await deleteZone(id) }
  const handleToggle = z => updateZone(z.id, { active: !z.active })
  const handleCancel = () => { setShowForm(false); setForm(EMPTY); setEditId(null); setFormError(null); setPicking(false) }

  if (!ready) return <div style={{ color: '#94a3b8', padding: 40, textAlign: 'center' }}>⏳ Connecting to Firebase…</div>

  // ── Form ──────────────────────────────────────────────────────────────
  const formPanel = showForm && (
    <div className="card p-4" style={{ flexShrink: 0 }}>
      <div className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        {editId ? '✏️ Edit Zone' : '➕ New Restricted Zone'}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Zone Name *</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Marine Protected Area" className="field" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Zone Type</label>
            <select name="type" value={form.type} onChange={handleChange} className="field">
              <option value="danger">🔴 Danger</option>
              <option value="warning">🟠 Warning</option>
              <option value="exclusion">🟣 Exclusion</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Radius (meters)</label>
            <input name="radius" type="number" min="1" value={form.radius} onChange={handleChange} className="field" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Latitude *</label>
            <input name="lat" value={form.lat} onChange={handleChange} placeholder="e.g. 13.411500" className="field" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Longitude *</label>
            <input name="lng" value={form.lng} onChange={handleChange} placeholder="e.g. 121.180300" className="field" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">LoRa Node ID <span className="text-slate-300 font-normal normal-case">(optional)</span></label>
            <input name="loraNodeId" value={form.loraNodeId} onChange={handleChange} placeholder="e.g. LORA_01" className="field" style={{ textTransform: 'uppercase' }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" onClick={() => setPicking(p => !p)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border cursor-pointer transition-colors ${picking ? 'bg-blue-50 text-blue-600 border-blue-400' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
            {picking ? '🎯 Click on the map…' : '📍 Pick on Map'}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
            Zone Active
          </label>
        </div>

        {formError && <div className="text-red-500 text-xs">{formError}</div>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : editId ? '💾 Update Zone' : '💾 Save Zone'}
          </button>
          <button type="button" onClick={handleCancel} className="btn-secondary flex-1">Cancel</button>
        </div>
      </form>
    </div>
  )

  // ── Map content ───────────────────────────────────────────────────────
  const mapContent = (
    <MapContainer ref={mapRef} center={[13.4115, 121.1803]} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      <MapClickHandler onMapClick={handleMapClick} picking={picking} />

      {form.lat && form.lng && (
        <Circle center={[parseFloat(form.lat), parseFloat(form.lng)]} radius={parseFloat(form.radius) || 500}
          pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.1, dashArray: '6 4', weight: 2 }} />
      )}

      {zones.map(z => {
        const col = ZONE_COLORS[z.type] ?? ZONE_COLORS.danger
        return (
          <Circle key={z.id} center={[parseFloat(z.lat), parseFloat(z.lng)]} radius={parseFloat(z.radius)}
            pathOptions={{ color: col.stroke, fillColor: col.fill, fillOpacity: z.active ? 0.15 : 0.04, dashArray: z.active ? undefined : '6 4', weight: z.active ? 2 : 1, opacity: z.active ? 1 : 0.4 }}>
            <Popup>
              <div style={{ minWidth: 150, fontFamily: 'Segoe UI', fontSize: 12 }}>
                <strong>{z.name}</strong><br />
                <span style={{ color: col.stroke, fontWeight: 600 }}>{z.type.toUpperCase()}</span><br />
                Radius: {z.radius}m<br />
                <span style={{ color: z.active ? '#16a34a' : '#94a3b8' }}>{z.active ? '● Active' : '○ Inactive'}</span>
              </div>
            </Popup>
          </Circle>
        )
      })}

      {zones.map(z => (
        <Marker key={`m-${z.id}`} position={[parseFloat(z.lat), parseFloat(z.lng)]}>
          <Popup><strong>{z.name}</strong><br />{parseFloat(z.lat).toFixed(5)}, {parseFloat(z.lng).toFixed(5)}</Popup>
        </Marker>
      ))}
    </MapContainer>
  )

  // ── Zone list ─────────────────────────────────────────────────────────
  const zoneList = (
    <>
      <div className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-2">Zones ({zones.length})</div>
      {zones.length === 0 && (
        <div className="text-slate-400 text-sm">No zones yet. Click + Add Zone.</div>
      )}
      {zones.map(z => {
        const col      = ZONE_COLORS[z.type] ?? ZONE_COLORS.danger
        const secAgo   = z.lastSeen ? Math.floor((Date.now() - z.lastSeen) / 1000) : null
        const isOnline = z.loraNodeId && secAgo !== null && secAgo < 30
        return (
          <div key={z.id} className="card p-3 mb-2" style={{ borderLeft: `4px solid ${col.stroke}`, opacity: z.active ? 1 : 0.6 }}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate flex-1">{z.name}</div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${z.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                {z.active ? 'Active' : 'Off'}
              </span>
            </div>
            <div className="text-xs font-semibold mb-1" style={{ color: col.stroke }}>{z.type.toUpperCase()}</div>
            <div className="text-xs text-slate-400 mb-2">⭕ {z.radius}m · 📍 {parseFloat(z.lat).toFixed(4)}, {parseFloat(z.lng).toFixed(4)}</div>

            {z.loraNodeId && (
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {isOnline ? '📡 Online' : '📡 Offline'}
                </span>
                <span className="text-xs text-slate-400">{z.loraNodeId}{secAgo !== null ? ` · ${secAgo < 60 ? secAgo + 's' : Math.floor(secAgo/60) + 'm'} ago` : ' · never'}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => handleToggle(z)} className="btn-secondary text-xs px-2.5 py-1">{z.active ? '⏸ Disable' : '▶ Enable'}</button>
              <button onClick={() => handleEdit(z)} className="btn-secondary text-xs px-2.5 py-1">✏️ Edit</button>
              <button onClick={() => handleDelete(z.id, z.name)} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer transition-colors">🗑</button>
            </div>
          </div>
        )
      })}
    </>
  )

  // ── DESKTOP layout ────────────────────────────────────────────────────
  if (!isMobile) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">🚫 Restricted Zones</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Vessel within <strong>20m</strong> of zone edge → ⚠️ Warning &nbsp;|&nbsp; Inside zone → 🚨 Breach
          </p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm(EMPTY); setFormError(null) }} className="btn-primary">
          {showForm && !editId ? '✕ Cancel' : '+ Add Zone'}
        </button>
      </div>

      {formPanel}

      {/* Map + side panel */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {mapContent}
          {picking && (
            <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#2563ebee', color: '#fff', padding: '6px 18px', borderRadius: 20, fontWeight: 700, fontSize: '0.85rem', pointerEvents: 'none' }}>
              🎯 Click anywhere on the map to set zone center
            </div>
          )}
        </div>
        <div style={{ width: 260, flexShrink: 0, overflowY: 'auto', minHeight: 0 }}>
          {zoneList}
        </div>
      </div>
    </div>
  )

  // ── MOBILE layout ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">🚫 Zones</h1>
          <p className="text-xs text-slate-400 mt-0.5">20m warning · Inside = breach</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm(EMPTY); setFormError(null) }} className="btn-primary">
          {showForm && !editId ? '✕' : '+ Add'}
        </button>
      </div>

      {formPanel}

      {/* Map — 55vh */}
      <div style={{ width: '100%', height: '55vh', minHeight: 260, borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {mapContent}
        {picking && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#2563ebee', color: '#fff', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: '0.8rem', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            🎯 Tap on map to set center
          </div>
        )}
      </div>

      {/* Zone list below map */}
      <div>{zoneList}</div>
    </div>
  )
}
