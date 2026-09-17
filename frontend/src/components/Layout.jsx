import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import { listenVessels, listenZones } from '../services/api'
import { useAlertDetector } from '../hooks/useAlertDetector'
import { useAlarmSound } from '../hooks/useAlarmSound'
import AlertToast from './AlertToast'

const navItems = [
  { to: '/',           label: 'Dashboard',  icon: '⊞', end: true },
  { to: '/map',        label: 'Live Map',   icon: '◎' },
  { to: '/alerts',     label: 'Alerts',     icon: '⚡' },
  { to: '/vessels',    label: 'Vessels',    icon: '⛵' },
  { to: '/zones',      label: 'Zones',      icon: '⬡' },
  { to: '/violations', label: 'Violations', icon: '⚑' },
  { to: '/reports',    label: 'Reports',    icon: '▤' },
  { to: '/weather',    label: 'Weather',    icon: '☁' },
  { to: '/settings',   label: 'Settings',   icon: '⚙' },
]

const PAGE_TITLES = {
  '/':           'Dashboard',
  '/map':        'Live Map',
  '/alerts':     'Alerts',
  '/vessels':    'Vessels',
  '/zones':      'Restricted Zones',
  '/violations': 'Violations',
  '/reports':    'Reports',
  '/weather':    'Weather',
  '/settings':   'Settings',
}

// Bottom tab items (most used on mobile)
const bottomTabs = [
  { to: '/',       label: 'Home',    icon: '⊞', end: true },
  { to: '/map',    label: 'Map',     icon: '◎' },
  { to: '/alerts', label: 'Alerts',  icon: '⚡' },
  { to: '/vessels',label: 'Vessels', icon: '⛵' },
]

export default function Layout() {
  const { dark, toggle } = useTheme()
  const location = useLocation()
  const [vessels,   setVessels]   = useState([])
  const [zones,     setZones]     = useState([])
  const [toasts,    setToasts]    = useState([])
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen,  setMoreOpen]  = useState(false)
  const [isMobile,  setIsMobile]  = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  const playAlarm = useAlarmSound()

  useEffect(() => {
    const u1 = listenVessels(setVessels)
    const u2 = listenZones(setZones)
    return () => { u1(); u2() }
  }, [])

  const handleNewAlert = useCallback((alert) => {
    playAlarm(alert.severity)
    setToasts(prev => [...prev, { ...alert, id: `${Date.now()}_${Math.random()}` }])
  }, [playAlarm])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useAlertDetector({ vessels, zones, onNewAlert: handleNewAlert })

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'NaviSea'
  const OFFLINE_MS = 2 * 60 * 1000
  const MIN_VALID_TS = 1577836800000
  const activeVessels = vessels.filter(v => {
    const ts = v.lastSeenAt ?? v.updatedAt
    return ts && ts >= MIN_VALID_TS && Date.now() - ts <= OFFLINE_MS
  }).length

  const statusPill = vessels.length > 0 ? (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: activeVessels > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(220,38,38,0.12)',
      border: `1px solid ${activeVessels > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(220,38,38,0.3)'}`,
      borderRadius: 20, padding: '4px 10px',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: activeVessels > 0 ? '#10b981' : '#ef4444',
        boxShadow: `0 0 6px ${activeVessels > 0 ? '#10b981' : '#ef4444'}`,
        animation: 'pulse 2s infinite', flexShrink: 0,
      }} />
      <span style={{ fontSize: '0.68rem', color: activeVessels > 0 ? '#6ee7b7' : '#fca5a5', fontWeight: 600, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
        {activeVessels > 0 ? `LIVE · ${activeVessels} vessel${activeVessels !== 1 ? 's' : ''} online` : 'NO VESSELS ONLINE'}
      </span>
    </div>
  ) : null

  return (
    <div className={`flex h-full ${dark ? 'dark' : ''}`} style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Desktop Sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex" style={{
        width: collapsed ? 64 : 220,
        flexShrink: 0,
        flexDirection: 'column',
        height: '100%',
        background: dark ? '#0d1117' : '#0f172a',
        transition: 'width 0.25s ease',
        position: 'relative',
        zIndex: 10,
        boxShadow: '4px 0 20px rgba(0,0,0,0.25)',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '20px 0' : '20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
          }}>⚓</div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: 1.5, color: '#fff', lineHeight: 1 }}>
                NAVI<span style={{ color: '#60a5fa' }}>SEA</span>
              </div>
              <div style={{ fontSize: '0.55rem', color: 'rgba(148,163,184,0.6)', letterSpacing: 2, marginTop: 2 }}>
                MARINE ALERT
              </div>
            </div>
          )}
        </div>

        {/* Status pill */}
        {!collapsed && vessels.length > 0 && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {statusPill}
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 8, textDecoration: 'none',
              fontWeight: isActive ? 700 : 500, fontSize: '0.84rem',
              color: isActive ? '#fff' : 'rgba(148,163,184,0.75)',
              background: isActive ? 'linear-gradient(90deg, rgba(37,99,235,0.5), rgba(37,99,235,0.2))' : 'transparent',
              borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
              transition: 'all 0.15s',
            })}>
              <span style={{ fontSize: '1rem', flexShrink: 0, opacity: 0.9 }}>{icon}</span>
              {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div onClick={toggle} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '8px 0' : '8px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 8, cursor: 'pointer',
            color: 'rgba(148,163,184,0.7)', fontSize: '0.82rem', fontWeight: 500,
          }}>
            <span style={{ fontSize: '1rem' }}>{dark ? '☀️' : '🌙'}</span>
            {!collapsed && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
          </div>
          <div onClick={() => setCollapsed(c => !c)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '8px 0' : '8px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 8, cursor: 'pointer',
            color: 'rgba(148,163,184,0.5)', fontSize: '0.75rem',
          }}>
            <span style={{ fontSize: '0.9rem' }}>{collapsed ? '▶' : '◀'}</span>
            {!collapsed && <span>Collapse</span>}
          </div>
        </div>
      </aside>

      {/* ── Right side ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', background: dark ? '#0f1117' : '#f0f4f8' }}>

        {/* Topbar */}
        <header style={{
          height: 54, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          background: dark ? 'linear-gradient(90deg, #1e293b, #0f172a)' : 'linear-gradient(90deg, #1e40af, #2563eb)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}>
          {/* Left: logo on mobile + page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mobile logo */}
            <div className="flex md:hidden" style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '0.95rem',
            }}>⚓</div>
            <div style={{ width: 3, height: 18, background: '#60a5fa', borderRadius: 2 }} />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', letterSpacing: 0.3 }}>
              {pageTitle}
            </span>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Status pill on mobile topbar */}
            <div className="flex md:hidden">
              {statusPill}
            </div>
            {/* Desktop info */}
            <div className="hidden md:flex" style={{ alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 6px #34d399' }} />
                Firebase Connected
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>Calapan City, Oriental Mindoro</div>
              <div style={{
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, padding: '3px 10px', color: '#fff', fontSize: '0.72rem', fontWeight: 600,
              }}>NaviSea v1.0</div>
            </div>
            {/* Dark mode on mobile */}
            <div className="flex md:hidden" onClick={toggle} style={{ cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}>
              {dark ? '☀️' : '🌙'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '16px',
          background: dark ? '#0f1117' : '#f0f4f8',
        }}
          className="mobile-main md:p-6"
        >
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      {isMobile && <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: dark ? '#0d1117' : '#0f172a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      }}>
        {bottomTabs.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '8px 4px 10px',
            textDecoration: 'none', gap: 3,
            color: isActive ? '#60a5fa' : 'rgba(148,163,184,0.6)',
            borderTop: isActive ? '2px solid #3b82f6' : '2px solid transparent',
            background: isActive ? 'rgba(37,99,235,0.1)' : 'transparent',
            transition: 'all 0.15s',
          })}>
            <span style={{ fontSize: '1.2rem' }}>{icon}</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
          </NavLink>
        ))}
        {/* More button */}
        <div
          onClick={() => setMoreOpen(o => !o)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '8px 4px 10px', gap: 3, cursor: 'pointer',
            color: moreOpen ? '#60a5fa' : 'rgba(148,163,184,0.6)',
            borderTop: moreOpen ? '2px solid #3b82f6' : '2px solid transparent',
            background: moreOpen ? 'rgba(37,99,235,0.1)' : 'transparent',
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>☰</span>
          <span style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: 0.3 }}>More</span>
        </div>
      </nav>}

      {/* ── Mobile More Drawer ── */}
      {isMobile && moreOpen && (
        <div style={{
          position: 'fixed', bottom: 60, left: 0, right: 0, zIndex: 49,
          background: dark ? '#0d1117' : '#0f172a',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.4)',
          flexDirection: 'column',
          display: 'flex',
          padding: '8px 0',
        }}>
          {navItems.filter(n => !bottomTabs.find(b => b.to === n.to)).map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              onClick={() => setMoreOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 24px', textDecoration: 'none',
                color: isActive ? '#fff' : 'rgba(148,163,184,0.8)',
                background: isActive ? 'rgba(37,99,235,0.2)' : 'transparent',
                fontWeight: isActive ? 700 : 500, fontSize: '0.9rem',
                borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
              })}>
              <span style={{ fontSize: '1.1rem' }}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
          {/* Dark mode row */}
          <div onClick={() => { toggle(); setMoreOpen(false) }} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '13px 24px', cursor: 'pointer',
            color: 'rgba(148,163,184,0.7)', fontSize: '0.9rem',
            borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4,
          }}>
            <span style={{ fontSize: '1.1rem' }}>{dark ? '☀️' : '🌙'}</span>
            <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
        </div>
      )}

      {/* Backdrop for more drawer */}
      {isMobile && moreOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 48,
          background: 'rgba(0,0,0,0.4)',
        }} onClick={() => setMoreOpen(false)} />
      )}

      <AlertToast alerts={toasts} onDismiss={dismissToast} />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        nav a:hover { background: rgba(255,255,255,0.06) !important; color: rgba(255,255,255,0.9) !important; }
      `}</style>
    </div>
  )
}
