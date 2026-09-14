import { useEffect, useState } from 'react'
import { listenVessels, listenAlerts, listenZones } from '../services/api'

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 gap-3">
      <span className="text-slate-400 text-xs font-medium flex-shrink-0">{label}</span>
      <span className="text-slate-700 dark:text-slate-200 text-xs font-semibold text-right">{value}</span>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        {title}
      </div>
      {children}
    </div>
  )
}

export default function Settings() {
  const [vessels, setVessels] = useState([])
  const [alerts,  setAlerts]  = useState([])
  const [zones,   setZones]   = useState([])
  const [ready,   setReady]   = useState(false)

  useEffect(() => {
    const u1 = listenVessels(d => { setVessels(d); setReady(true) })
    const u2 = listenAlerts(d  => setAlerts(d))
    const u3 = listenZones(d   => setZones(d))
    return () => { u1(); u2(); u3() }
  }, [])

  const activeVessels  = vessels.filter(v => v.status === 'active')
  const alertVessels   = vessels.filter(v => v.status === 'alert')
  const unackedAlerts  = alerts.filter(a => !a.acknowledged)
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const activeZones    = zones.filter(z => z.active)

  if (!ready) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">⏳ Loading system data…</div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">⚙️ System Overview</h1>
        <p className="text-slate-400 text-xs mt-0.5">Realtime system status — NaviSea Marine Border Alert System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        <Card title="🔥 Firebase Database">
          <InfoRow label="Project ID"    value="navi-c7e87" />
          <InfoRow label="Database"      value="asia-southeast1" />
          <InfoRow label="Connection"    value={ready ? '🟢 Connected' : '🔴 Disconnected'} />
          <InfoRow label="Realtime Sync" value="✅ Active" />
        </Card>

        <Card title="🚢 Vessel Summary">
          <InfoRow label="Total Registered" value={vessels.length} />
          <InfoRow label="Active (GPS live)" value={activeVessels.length} />
          <InfoRow label="In Alert Status"   value={alertVessels.length} />
          <InfoRow label="Inactive"          value={vessels.length - activeVessels.length - alertVessels.length} />
          {vessels.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {vessels.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs text-slate-700 dark:text-slate-200 truncate">{v.name || '—'}</div>
                    <div className="text-xs text-slate-400">{v.mmsi} · {v.type}</div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v.status === 'active' ? 'bg-green-100 text-green-700' : v.status === 'alert' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      ● {v.status}
                    </span>
                    <div className="text-xs text-slate-400 mt-0.5">{timeAgo(v.updatedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="🚨 Alert Summary">
          <InfoRow label="Total Alerts"    value={alerts.length} />
          <InfoRow label="Unacknowledged"  value={unackedAlerts.length} />
          <InfoRow label="Critical"        value={criticalAlerts.length} />
          <InfoRow label="Warning"         value={alerts.filter(a => a.severity === 'warning').length} />
          <InfoRow label="Zone Violations" value={alerts.filter(a => a.alertType === 'zone_violation').length} />
          {unackedAlerts.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {unackedAlerts.slice(0, 5).map(a => (
                <div key={a.id} className={`rounded-lg px-3 py-2.5 border-l-4 ${a.severity === 'critical' ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'}`}>
                  <div className="font-semibold text-xs text-slate-700 truncate">{a.vesselName ?? '—'} — {a.alertType?.replace('_', ' ')}</div>
                  <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{a.message}</div>
                  <div className="text-xs text-slate-300 mt-0.5">{timeAgo(a.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="🚫 Restricted Zones">
          <InfoRow label="Total Zones"  value={zones.length} />
          <InfoRow label="Active Zones" value={activeZones.length} />
          <InfoRow label="Inactive"     value={zones.length - activeZones.length} />
          <InfoRow label="Zone Monitor" value="🟢 Running (10s interval)" />
          {zones.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {zones.map(z => (
                <div key={z.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs text-slate-700 dark:text-slate-200 truncate">{z.name}</div>
                    <div className="text-xs text-slate-400">{z.type} · {z.radius}m radius</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${z.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {z.active ? '● Active' : '○ Off'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="📡 System Info">
          <InfoRow label="System"         value="NaviSea v1.0" />
          <InfoRow label="Location"       value="Calapan City, Or. Mindoro" />
          <InfoRow label="Coordinates"    value="13.4115°N, 121.1803°E" />
          <InfoRow label="Notification"   value="🟢 Browser Push Active" />
          <InfoRow label="Buzzer Trigger" value="🟢 Firebase → ESP32" />
          <InfoRow label="Zone Check"     value="Every 10 seconds" />
          <InfoRow label="Alert Cooldown" value="30 seconds per zone" />
          <InfoRow label="GPS Sync"       value="Every 2 seconds" />
        </Card>

        <Card title="🔧 Arduino Device Config">
          <InfoRow label="Board"         value="ESP32 Dev Module" />
          <InfoRow label="GPS Module"    value="NEO-6M (UART2)" />
          <InfoRow label="LoRa Module"   value="SX1278 433MHz" />
          <InfoRow label="Buzzer Pin"    value="GPIO 25" />
          <InfoRow label="GPS RX Pin"    value="GPIO 16" />
          <InfoRow label="GPS TX Pin"    value="GPIO 17" />
          <InfoRow label="LoRa SS"       value="GPIO 5" />
          <InfoRow label="LoRa RST"      value="GPIO 14" />
          <InfoRow label="LoRa DIO0"     value="GPIO 2" />
          <InfoRow label="Sync Interval" value="2 seconds" />
          <InfoRow label="Firebase DB"   value="asia-southeast1" />
        </Card>

      </div>
    </div>
  )
}
