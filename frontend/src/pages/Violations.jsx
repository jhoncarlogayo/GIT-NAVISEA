import { useEffect, useState } from 'react'
import { listenAlerts, listenVessels, acknowledgeAlert } from '../services/api'

const SEV_CLASS = {
  critical: 'bg-red-50 text-red-600 border border-red-200',
  warning:  'bg-amber-50 text-amber-600 border border-amber-200',
  info:     'bg-blue-50 text-blue-600 border border-blue-200',
}
const SEV_COLOR = { critical: '#dc2626', warning: '#d97706', info: '#2563eb' }

function getWeekLabel(ts) {
  const d     = new Date(ts)
  const day   = d.getDay()
  const diff  = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon   = new Date(d.setDate(diff))
  const sun   = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt   = dt => dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(mon)} – ${fmt(sun)}`
}

function getWeekKey(ts) {
  const d    = new Date(ts)
  const day  = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon  = new Date(new Date(ts).setDate(diff))
  return mon.toISOString().slice(0, 10)
}

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Violations() {
  const [alerts,  setAlerts]  = useState([])
  const [vessels, setVessels] = useState([])
  const [ready,   setReady]   = useState(false)
  const [search,  setSearch]  = useState('')
  const [weekFilter, setWeekFilter] = useState('all')

  useEffect(() => {
    const u1 = listenAlerts(d  => { setAlerts(d); setReady(true) })
    const u2 = listenVessels(d => setVessels(d))
    return () => { u1(); u2() }
  }, [])

  // Map vessel name → vessel info (mmsi, type)
  const vesselMap = {}
  vessels.forEach(v => { if (v.name) vesselMap[v.name] = v })

  // Group alerts by week
  const byWeek = {}
  alerts.filter(a => a.vesselName).forEach(a => {
    const key = getWeekKey(a.createdAt ?? Date.now())
    if (!byWeek[key]) byWeek[key] = []
    byWeek[key].push(a)
  })

  // Sort weeks newest first
  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a))

  const filteredWeeks = weekFilter === 'all' ? weeks : weeks.filter(w => w === weekFilter)

  // Per week — group by vessel
  function getWeekSummary(weekAlerts) {
    const byVessel = {}
    weekAlerts.forEach(a => {
      const name = a.vesselName ?? 'Unknown'
      if (!byVessel[name]) byVessel[name] = []
      byVessel[name].push(a)
    })
    return Object.entries(byVessel).map(([name, records]) => ({
      name,
      vessel:   vesselMap[name] ?? {},
      records:  records.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
      total:    records.length,
      critical: records.filter(r => r.severity === 'critical').length,
      warning:  records.filter(r => r.severity === 'warning').length,
      zones:    [...new Set(records.map(r => r.zoneName).filter(Boolean))],
      unacked:  records.filter(r => !r.acknowledged).length,
    })).sort((a, b) => b.total - a.total)
      .filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
  }

  const handlePrintWeek = (weekKey, weekAlerts) => {
    const summary  = getWeekSummary(weekAlerts)
    const weekLabel = getWeekLabel(new Date(weekKey).getTime() + 86400000)
    const totalViolations = weekAlerts.length
    const totalVessels    = summary.length

    const vesselRows = summary.map(v => {
      const vesselInfo = v.vessel
      const recordRows = v.records.map(a => `
        <tr>
          <td>${fmtTime(a.createdAt)}</td>
          <td>${a.zoneName ?? '—'}</td>
          <td>${a.alertType?.replace(/_/g, ' ') ?? '—'}</td>
          <td style="color:${SEV_COLOR[a.severity]};font-weight:700">${(a.severity ?? '—').toUpperCase()}</td>
          <td>${a.latitude ? `${parseFloat(a.latitude).toFixed(5)}, ${parseFloat(a.longitude).toFixed(5)}` : '—'}</td>
          <td style="color:${a.acknowledged ? '#059669' : '#dc2626'};font-weight:600">${a.acknowledged ? 'Acknowledged' : 'Pending'}</td>
        </tr>`).join('')

      return `
        <div class="vessel-block">
          <div class="vessel-header">
            <div>
              <div class="vessel-name">🚢 ${v.name}</div>
              <div class="vessel-meta">
                MMSI: ${vesselInfo.mmsi ?? '—'} &nbsp;·&nbsp;
                Type: ${vesselInfo.type ?? '—'} &nbsp;·&nbsp;
                Status: ${vesselInfo.status ?? '—'}
              </div>
            </div>
            <div class="vessel-stats">
              <span class="badge-red">${v.critical} Breach${v.critical !== 1 ? 'es' : ''}</span>
              <span class="badge-amber">${v.warning} Warning${v.warning !== 1 ? 's' : ''}</span>
              <span class="badge-total">${v.total} Total</span>
            </div>
          </div>
          <div class="zones-entered">Zones Entered: <strong>${v.zones.join(', ') || '—'}</strong></div>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Zone</th>
                <th>Violation Type</th>
                <th>Severity</th>
                <th>Coordinates</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${recordRows}</tbody>
          </table>
        </div>`
    }).join('')

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>NaviSea Weekly Violation Report — ${weekLabel}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; padding: 36px; color: #0f172a; font-size: 13px; }
        .report-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 20px; }
        .report-title { font-size: 1.4rem; font-weight: 800; color: #1e3a5f; }
        .report-sub { color: #64748b; font-size: 0.8rem; margin-top: 4px; }
        .logo-area { text-align: right; color: #64748b; font-size: 0.78rem; }
        .summary-bar { display: flex; gap: 12px; margin-bottom: 24px; }
        .summary-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; text-align: center; }
        .summary-num { font-size: 1.6rem; font-weight: 800; line-height: 1; }
        .summary-lbl { font-size: 0.68rem; color: #64748b; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
        .vessel-block { margin-bottom: 28px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
        .vessel-header { display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
        .vessel-name { font-size: 1rem; font-weight: 700; color: #0f172a; }
        .vessel-meta { font-size: 0.75rem; color: #64748b; margin-top: 3px; }
        .vessel-stats { display: flex; gap: 6px; }
        .badge-red   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; }
        .badge-amber { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; }
        .badge-total { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; }
        .zones-entered { padding: 8px 16px; font-size: 0.78rem; color: #475569; background: #fafafa; border-bottom: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; font-size: 0.76rem; }
        th { background: #f8fafc; padding: 8px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.5px; }
        td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) td { background: #f8fafc; }
        .footer { margin-top: 28px; font-size: 0.7rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; }
        @media print { body { padding: 20px; } .vessel-block { page-break-inside: avoid; } }
      </style>
    </head><body>
      <div class="report-header">
        <div>
          <div class="report-title">⚓ NaviSea — Weekly Violation Report</div>
          <div class="report-sub">Week of ${weekLabel}</div>
          <div class="report-sub">Generated: ${new Date().toLocaleString('en-PH')} &nbsp;·&nbsp; Calapan City, Oriental Mindoro</div>
        </div>
        <div class="logo-area">
          <div style="font-size:1.1rem;font-weight:800;color:#1e3a5f;">NaviSea</div>
          <div>IoT Marine Border Alert System</div>
          <div>v1.0.0</div>
        </div>
      </div>

      <div class="summary-bar">
        <div class="summary-box"><div class="summary-num" style="color:#0f172a">${totalVessels}</div><div class="summary-lbl">Vessels with Violations</div></div>
        <div class="summary-box"><div class="summary-num" style="color:#dc2626">${totalViolations}</div><div class="summary-lbl">Total Violations</div></div>
        <div class="summary-box"><div class="summary-num" style="color:#dc2626">${weekAlerts.filter(a => a.severity === 'critical').length}</div><div class="summary-lbl">Critical Breaches</div></div>
        <div class="summary-box"><div class="summary-num" style="color:#d97706">${weekAlerts.filter(a => a.severity === 'warning').length}</div><div class="summary-lbl">Warnings</div></div>
        <div class="summary-box"><div class="summary-num" style="color:#7c3aed">${weekAlerts.filter(a => !a.acknowledged).length}</div><div class="summary-lbl">Unacknowledged</div></div>
      </div>

      ${vesselRows}

      <div class="footer">
        <span>NaviSea IoT Marine Border Alert System — Confidential Weekly Report</span>
        <span>Week of ${weekLabel}</span>
      </div>
      <script>window.onload = () => window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  if (!ready) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">⏳ Loading records…</div>
  )

  const allAlerts = alerts.filter(a => a.vesselName)

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">⚠️ Weekly Violation Reports</h1>
        <span className="text-xs text-slate-400">{weeks.length} week{weeks.length !== 1 ? 's' : ''} of records · {allAlerts.length} total violations</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <input
          placeholder="Search vessel…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="field w-full"
        />
        <select
          value={weekFilter}
          onChange={e => setWeekFilter(e.target.value)}
          className="field w-full"
        >
          <option value="all">All Weeks</option>
          {weeks.map(w => (
            <option key={w} value={w}>{getWeekLabel(new Date(w).getTime() + 86400000)}</option>
          ))}
        </select>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Weeks',      value: weeks.length,                                        color: 'text-slate-700 dark:text-slate-200' },
          { label: 'Total Violations', value: allAlerts.length,                                    color: 'text-red-600' },
          { label: 'Critical Breaches',value: allAlerts.filter(a => a.severity === 'critical').length, color: 'text-red-600' },
          { label: 'Unacknowledged',   value: allAlerts.filter(a => !a.acknowledged).length,       color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center shadow-sm">
            <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Weekly report blocks */}
      {filteredWeeks.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-green-700 font-medium text-sm">
          ✅ No violation records found.
        </div>
      ) : (
        filteredWeeks.map(weekKey => {
          const weekAlerts  = byWeek[weekKey]
          const weekLabel   = getWeekLabel(new Date(weekKey).getTime() + 86400000)
          const weekSummary = getWeekSummary(weekAlerts)

          return (
            <div key={weekKey} className="card overflow-hidden">

              {/* Week header */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">📅 {weekLabel}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {weekSummary.length} vessel{weekSummary.length !== 1 ? 's' : ''} · {weekAlerts.length} violation{weekAlerts.length !== 1 ? 's' : ''} · {weekAlerts.filter(a => a.severity === 'critical').length} critical
                    </div>
                  </div>
                  <button
                    onClick={() => handlePrintWeek(weekKey, weekAlerts)}
                    className="btn-dark text-xs px-3 py-1.5 flex-shrink-0"
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>

              {/* Vessel violation cards */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {weekSummary.map(v => (
                  <div key={v.name} className="p-4">

                    {/* Vessel info */}
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm flex flex-wrap items-center gap-1.5">
                          🚢 {v.name}
                          {v.critical > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">{v.critical} Breach{v.critical !== 1 ? 'es' : ''}</span>}
                          {v.warning  > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">{v.warning} Warn</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          MMSI: <strong className="text-slate-600 dark:text-slate-300">{v.vessel.mmsi ?? '—'}</strong> · <span className="capitalize">{v.vessel.type ?? '—'}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Zones: <strong className="text-slate-600 dark:text-slate-300">{v.zones.join(', ') || '—'}</strong>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-extrabold text-red-600">{v.total}</div>
                        <div className="text-xs text-slate-400">violations</div>
                      </div>
                    </div>

                    {/* Violation cards (mobile-friendly, no table) */}
                    <div className="flex flex-col gap-2">
                      {v.records.map(a => (
                        <div key={a.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
                          style={{ borderLeft: `3px solid ${SEV_COLOR[a.severity] ?? '#94a3b8'}` }}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-slate-700 dark:text-slate-200">{a.zoneName ?? '—'}</div>
                              <div className="text-xs text-slate-400">{fmtTime(a.createdAt)}</div>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${SEV_CLASS[a.severity] ?? ''}`}>
                              {a.severity?.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 capitalize mb-2">{a.alertType?.replace(/_/g, ' ') ?? '—'}</div>
                          {a.latitude && (
                            <div className="text-xs font-mono text-slate-400 mb-2">📍 {parseFloat(a.latitude).toFixed(5)}, {parseFloat(a.longitude).toFixed(5)}</div>
                          )}
                          {a.acknowledged
                            ? <span className="text-green-600 text-xs font-semibold">✓ Acknowledged</span>
                            : <button onClick={() => acknowledgeAlert(a.id)}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold w-full hover:bg-blue-700 transition-colors cursor-pointer">
                                Acknowledge
                              </button>
                          }
                        </div>
                      ))}
                    </div>

                  </div>
                ))}
              </div>

            </div>
          )
        })
      )}
    </div>
  )
}
