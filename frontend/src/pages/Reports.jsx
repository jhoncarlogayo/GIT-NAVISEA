import { useEffect, useState } from 'react'
import { listenAlerts, listenVessels } from '../services/api'

const SEV       = { critical: '#dc2626', warning: '#d97706', info: '#2563eb' }
const SEV_BG    = { critical: '#fef2f2', warning: '#fffbeb', info: '#eff6ff' }

function fmt(ts) { return ts ? new Date(ts).toLocaleString() : '—' }
function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString() : '—' }

export default function Reports() {
  const [alerts,   setAlerts]   = useState([])
  const [vessels,  setVessels]  = useState([])
  const [ready,    setReady]    = useState(false)

  // Filters
  const [vessel,    setVessel]    = useState('all')
  const [severity,  setSeverity]  = useState('all')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [reportType, setReportType] = useState('violations') // violations | summary | vessel

  useEffect(() => {
    const u1 = listenAlerts(d  => { setAlerts(d); setReady(true) })
    const u2 = listenVessels(d => setVessels(d))
    return () => { u1(); u2() }
  }, [])

  const vesselNames = ['all', ...new Set(alerts.map(a => a.vesselName).filter(Boolean))]

  // Apply filters — include all alerts that have a vesselName
  const filtered = alerts.filter(a => {
    if (!a.vesselName) return false
    if (vessel   !== 'all' && a.vesselName !== vessel)   return false
    if (severity !== 'all' && a.severity   !== severity) return false
    if (dateFrom) {
      const from = new Date(dateFrom).setHours(0,0,0,0)
      if ((a.createdAt ?? 0) < from) return false
    }
    if (dateTo) {
      const to = new Date(dateTo).setHours(23,59,59,999)
      if ((a.createdAt ?? 0) > to) return false
    }
    return true
  })

  // Per-vessel summary for the summary report
  const vesselSummary = {}
  filtered.forEach(a => {
    const k = a.vesselName ?? 'Unknown'
    if (!vesselSummary[k]) vesselSummary[k] = { total: 0, critical: 0, warning: 0, zones: new Set() }
    vesselSummary[k].total++
    if (a.severity === 'critical') vesselSummary[k].critical++
    if (a.severity === 'warning')  vesselSummary[k].warning++
    if (a.zoneName) vesselSummary[k].zones.add(a.zoneName)
  })

  const handlePrint = () => {
    const isVesselReport = reportType === 'vessel' && vessel !== 'all'
    const isSummary      = reportType === 'summary'

    const summaryRows = Object.entries(vesselSummary).map(([name, d]) => `
      <tr>
        <td style="font-weight:700">${name}</td>
        <td style="text-align:center;font-weight:800;color:#dc2626">${d.total}</td>
        <td style="text-align:center;color:#dc2626">${d.critical}</td>
        <td style="text-align:center;color:#d97706">${d.warning}</td>
        <td>${[...d.zones].join(', ') || '—'}</td>
      </tr>`).join('')

    const detailRows = filtered.map(a => `
      <tr>
        <td>${fmt(a.createdAt)}</td>
        <td style="font-weight:700">${a.vesselName ?? '—'}</td>
        <td>${a.zoneName ?? '—'}</td>
        <td style="color:${SEV[a.severity]};font-weight:700">${(a.severity ?? '—').toUpperCase()}</td>
        <td>${a.distanceM != null ? (a.distanceM === 0 ? 'Inside zone' : `${a.distanceM}m from edge`) : '—'}</td>
        <td>${a.latitude ? `${parseFloat(a.latitude).toFixed(5)}, ${parseFloat(a.longitude).toFixed(5)}` : '—'}</td>
        <td>${a.message ?? '—'}</td>
        <td>${a.acknowledged ? 'Acknowledged' : 'Pending'}</td>
      </tr>`).join('')

    const dateRange = dateFrom || dateTo
      ? `${dateFrom || 'Start'} to ${dateTo || 'Present'}`
      : 'All dates'

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>NaviSea Report</title>
      <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'Segoe UI',sans-serif; padding:36px; color:#0f172a; font-size:13px; }
        .cover { border-bottom:3px solid #1e40af; padding-bottom:20px; margin-bottom:24px; }
        .cover-logo { font-size:1.6rem; font-weight:900; letter-spacing:2px; color:#1e40af; }
        .cover-logo span { color:#3b82f6; }
        .cover-sub { font-size:0.72rem; letter-spacing:2px; color:#94a3b8; margin-top:2px; }
        h2 { font-size:1.1rem; font-weight:700; margin:0 0 4px; }
        .meta { color:#64748b; font-size:0.78rem; margin-bottom:20px; }
        .stats { display:flex; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
        .stat { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 18px; min-width:100px; }
        .stat-num { font-size:1.5rem; font-weight:800; line-height:1; }
        .stat-lbl { font-size:0.68rem; color:#64748b; margin-top:3px; text-transform:uppercase; letter-spacing:0.4px; }
        table { width:100%; border-collapse:collapse; font-size:0.78rem; margin-top:8px; }
        th { background:#f1f5f9; padding:8px 10px; text-align:left; border-bottom:2px solid #e2e8f0; font-weight:700; color:#475569; text-transform:uppercase; font-size:0.68rem; letter-spacing:0.4px; }
        td { padding:7px 10px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
        tr:nth-child(even) td { background:#f8fafc; }
        .section-title { font-size:0.82rem; font-weight:700; color:#0f172a; margin:20px 0 8px; text-transform:uppercase; letter-spacing:0.5px; border-left:3px solid #2563eb; padding-left:8px; }
        .footer { margin-top:28px; font-size:0.7rem; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:10px; display:flex; justify-content:space-between; }
        @media print { body { padding:20px; } }
      </style></head><body>
      <div class="cover">
        <div class="cover-logo">NAVI<span>SEA</span></div>
        <div class="cover-sub">MARINE BORDER ALERT SYSTEM &nbsp;·&nbsp; CALAPAN CITY, ORIENTAL MINDORO</div>
        <div style="margin-top:14px">
          <h2>${isVesselReport ? `Vessel Report — ${vessel}` : isSummary ? 'Summary Report' : 'Violation Detail Report'}</h2>
          <div class="meta">
            Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp;
            Period: ${dateRange} &nbsp;|&nbsp;
            Vessel: ${vessel === 'all' ? 'All Vessels' : vessel} &nbsp;|&nbsp;
            Severity: ${severity === 'all' ? 'All' : severity.toUpperCase()}
          </div>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="stat-num" style="color:#0f172a">${filtered.length}</div><div class="stat-lbl">Total Records</div></div>
        <div class="stat"><div class="stat-num" style="color:#dc2626">${filtered.filter(a=>a.severity==='critical').length}</div><div class="stat-lbl">Critical Breaches</div></div>
        <div class="stat"><div class="stat-num" style="color:#d97706">${filtered.filter(a=>a.severity==='warning').length}</div><div class="stat-lbl">Warnings</div></div>
        <div class="stat"><div class="stat-num" style="color:#7c3aed">${filtered.filter(a=>!a.acknowledged).length}</div><div class="stat-lbl">Unacknowledged</div></div>
        <div class="stat"><div class="stat-num" style="color:#0f172a">${Object.keys(vesselSummary).length}</div><div class="stat-lbl">Vessels Involved</div></div>
      </div>

      ${!isVesselReport ? `
      <div class="section-title">Vessel Summary</div>
      <table>
        <thead><tr><th>Vessel</th><th>Total</th><th>Critical</th><th>Warning</th><th>Zones Entered</th></tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>` : ''}

      ${!isSummary ? `
      <div class="section-title">Violation Records</div>
      <table>
        <thead><tr><th>Date &amp; Time</th><th>Vessel</th><th>Zone</th><th>Severity</th><th>Distance</th><th>Coordinates</th><th>Message</th><th>Status</th></tr></thead>
        <tbody>${detailRows}</tbody>
      </table>` : ''}

      <div class="footer">
        <span>NaviSea IoT Marine Border Alert System — Official Report</span>
        <span>Printed: ${new Date().toLocaleString()}</span>
      </div>
      <script>window.onload = () => window.print()<\/script>
      </body></html>`)
    win.document.close()
  }

  if (!ready) return <div style={s.muted}>⏳ Loading data…</div>

  const criticalCount = filtered.filter(a => a.severity === 'critical').length
  const warningCount  = filtered.filter(a => a.severity === 'warning').length
  const unackedCount  = filtered.filter(a => !a.acknowledged).length

  return (
    <div style={{ overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Reports</h1>
          <span style={s.sub}>Generate and print client-facing violation reports</span>
        </div>
      </div>

      {/* Report builder panel */}
      <div style={s.builderCard}>
        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5, borderLeft: '3px solid #2563eb', paddingLeft: 8 }}>
          Report Builder
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>

          <div style={s.fg}>
            <label style={s.label}>Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)} style={s.select}>
              <option value="violations">Violation Detail</option>
              <option value="summary">Summary Only</option>
              <option value="vessel">Per Vessel</option>
            </select>
          </div>

          <div style={s.fg}>
            <label style={s.label}>Vessel</label>
            <select value={vessel} onChange={e => setVessel(e.target.value)} style={s.select}>
              {vesselNames.map(n => (
                <option key={n} value={n}>{n === 'all' ? 'All Vessels' : n}</option>
              ))}
            </select>
          </div>

          <div style={s.fg}>
            <label style={s.label}>Severity</label>
            <select value={severity} onChange={e => setSeverity(e.target.value)} style={s.select}>
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warning Only</option>
            </select>
          </div>

          <div style={s.fg}>
            <label style={s.label}>Date From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={s.select} />
          </div>

          <div style={s.fg}>
            <label style={s.label}>Date To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={s.select} />
          </div>

        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setVessel('all'); setSeverity('all'); setDateFrom(''); setDateTo('') }}
              style={s.btnSecondary}>Clear Filters</button>
            <button onClick={handlePrint} disabled={filtered.length === 0} style={{ ...s.btnPrimary, opacity: filtered.length === 0 ? 0.5 : 1 }}>
              Print / Export Report
            </button>
          </div>
          <span style={{ color: '#8fa0b4', fontSize: '0.78rem' }}>
            {filtered.length} record{filtered.length !== 1 ? 's' : ''} match current filters
          </span>
        </div>
      </div>

      {/* Live preview stats */}
      <div style={s.statsRow}>
        {[
          { label: 'Records',    value: filtered.length,  color: '#0f172a' },
          { label: 'Critical',   value: criticalCount,    color: '#dc2626' },
          { label: 'Warning',    value: warningCount,     color: '#d97706' },
          { label: 'Unacked',    value: unackedCount,     color: '#7c3aed' },
          { label: 'Vessels',    value: Object.keys(vesselSummary).length, color: '#2563eb' },
        ].map(({ label, value, color }) => (
          <div key={label} style={s.statBox}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.7rem', color: '#8fa0b4', marginTop: 3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Preview table */}
      <div>
        {filtered.length === 0 ? (
          <div style={s.emptyBox}>No records match the selected filters.</div>
        ) : (
          <>
            {/* Vessel summary */}
            {Object.keys(vesselSummary).length > 1 && (
              <div style={{ marginBottom: 14 }}>
                <div style={s.sectionTitle}>Vessel Summary</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {Object.entries(vesselSummary).sort((a,b) => b[1].total - a[1].total).map(([name, d]) => (
                    <div key={name} style={s.vesselChip}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{name}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span style={{ ...s.pill, background: '#fef2f2', color: '#dc2626' }}>{d.critical} breach</span>
                        <span style={{ ...s.pill, background: '#fffbeb', color: '#d97706' }}>{d.warning} warn</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#8fa0b4', marginTop: 4 }}>{[...d.zones].join(', ') || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detail table */}
            <div style={s.sectionTitle}>Violation Records</div>
            <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f7fa' }}>
                    {['Date & Time', 'Vessel', 'Zone', 'Severity', 'Distance', 'Coordinates', 'Status'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.id} style={{
                      borderBottom: '1px solid #eef1f6',
                      borderLeft: `3px solid ${SEV[a.severity] ?? '#e2e8f0'}`,
                    }}>
                      <td style={{ ...s.td, color: '#8fa0b4', whiteSpace: 'nowrap' }}>{fmt(a.createdAt)}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: '#0f172a' }}>{a.vesselName ?? '—'}</td>
                      <td style={s.td}>{a.zoneName ?? '—'}</td>
                      <td style={s.td}>
                        <span style={{ background: SEV_BG[a.severity], color: SEV[a.severity], padding: '2px 9px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>
                          {a.severity?.toUpperCase() ?? '—'}
                        </span>
                      </td>
                      <td style={s.td}>
                        {a.distanceM != null
                          ? a.distanceM === 0
                            ? <span style={{ color: '#dc2626', fontWeight: 700 }}>Inside zone</span>
                            : `${a.distanceM}m from edge`
                          : '—'}
                      </td>
                      <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.76rem', color: '#52637a' }}>
                        {a.latitude ? `${parseFloat(a.latitude).toFixed(5)}, ${parseFloat(a.longitude).toFixed(5)}` : '—'}
                      </td>
                      <td style={s.td}>
                        {a.acknowledged
                          ? <span style={{ color: '#059669', fontSize: '0.76rem', fontWeight: 600 }}>✓ Acknowledged</span>
                          : <span style={{ color: '#d97706', fontSize: '0.76rem', fontWeight: 600 }}>Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  header:       { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  title:        { color: '#0f172a', fontSize: '1.45rem', fontWeight: 800, letterSpacing: -0.5 },
  sub:          { color: '#8fa0b4', fontSize: '0.78rem' },
  builderCard:  { background: '#fff', border: '1px solid #dde3ec', borderRadius: 12, padding: '18px 20px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  statsRow:     { display: 'flex', gap: 0, background: '#fff', border: '1px solid #dde3ec', borderRadius: 10, marginBottom: 14, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' },
  statBox:      { flex: 1, padding: '12px 16px', borderRight: '1px solid #eef1f6', textAlign: 'center' },
  fg:           { display: 'flex', flexDirection: 'column', gap: 5 },
  label:        { color: '#52637a', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 },
  select:       { background: '#f5f7fa', border: '1px solid #dde3ec', padding: '8px 10px', borderRadius: 7, fontSize: '0.84rem', color: '#0f172a', outline: 'none' },
  btnPrimary:   { background: '#2563eb', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' },
  btnSecondary: { background: '#f5f7fa', color: '#52637a', border: '1px solid #dde3ec', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: '0.84rem' },
  sectionTitle: { fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, borderLeft: '3px solid #2563eb', paddingLeft: 8 },
  vesselChip:   { background: '#fff', border: '1px solid #dde3ec', borderRadius: 10, padding: '10px 14px', minWidth: 160, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  pill:         { fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20 },
  th:           { padding: '9px 12px', borderBottom: '2px solid #dde3ec', color: '#8fa0b4', fontSize: '0.68rem', fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.4 },
  td:           { padding: '10px 12px', color: '#334155', fontSize: '0.82rem' },
  muted:        { color: '#8fa0b4', padding: 40, textAlign: 'center' },
  emptyBox:     { background: '#f5f7fa', border: '1px solid #dde3ec', borderRadius: 10, padding: 20, color: '#8fa0b4', fontWeight: 500, marginTop: 8, textAlign: 'center' },
}
