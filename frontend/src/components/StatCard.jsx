export default function StatCard({ label, value, color, icon, sub }) {
  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-xl overflow-hidden"
      style={{
        borderTop: `3px solid ${color}`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)`,
      }}>

      {/* Background glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 90, height: 90,
        background: `radial-gradient(circle at top right, ${color}20, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: color + '18',
            border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem',
            boxShadow: `0 4px 12px ${color}20`,
          }}>
            {icon}
          </div>
          {/* Live badge */}
          <span style={{
            fontSize: '0.6rem', fontWeight: 800, letterSpacing: 1.2,
            padding: '3px 8px', borderRadius: 20,
            background: color + '15', color, border: `1px solid ${color}30`,
          }}>LIVE</span>
        </div>

        {/* Value */}
        <div style={{
          fontSize: '2.2rem', fontWeight: 900, color,
          lineHeight: 1, letterSpacing: -1, marginBottom: 4,
        }}>{value}</div>

        {/* Label */}
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', letterSpacing: 0.2 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}
