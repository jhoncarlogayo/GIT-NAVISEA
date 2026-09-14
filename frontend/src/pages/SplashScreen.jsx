import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SplashScreen() {
  const navigate = useNavigate()
  const [fade, setFade] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 2800)
    const t2 = setTimeout(() => navigate('/', { replace: true }), 3400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [navigate])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #0f172a 0%, #1e3a8a 55%, #1e40af 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fade ? 0 : 1,
      transition: 'opacity 0.6s ease',
      userSelect: 'none',
    }}>

      {/* Animated wave rings */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 200 + i * 120, height: 200 + i * 120,
            borderRadius: '50%',
            border: `1px solid rgba(96,165,250,${0.18 - i * 0.04})`,
            animation: `pulse-ring ${1.8 + i * 0.4}s ease-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }} />
        ))}
      </div>

      {/* Logo mark */}
      <svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ marginBottom: 24, filter: 'drop-shadow(0 0 24px rgba(96,165,250,0.5))' }}>
        <circle cx="45" cy="45" r="44" fill="rgba(255,255,255,0.07)" stroke="rgba(96,165,250,0.4)" strokeWidth="1.5"/>
        {/* Anchor */}
        <line x1="45" y1="22" x2="45" y2="68" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="28" y1="34" x2="62" y2="34" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
        <circle cx="45" cy="22" r="5" fill="none" stroke="white" strokeWidth="3"/>
        <path d="M28 58 Q22 70 30 72 Q38 74 45 68" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <path d="M62 58 Q68 70 60 72 Q52 74 45 68" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
        {/* Wave */}
        <path d="M18 80 Q24 74 30 80 Q36 86 42 80 Q48 74 54 80 Q60 86 66 80 Q72 74 78 80"
          stroke="#60a5fa" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </svg>

      {/* Brand name */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{
          fontSize: '2.8rem', fontWeight: 900, letterSpacing: 6,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          color: '#ffffff',
          textShadow: '0 0 30px rgba(96,165,250,0.6)',
        }}>
          NAVI<span style={{ color: '#60a5fa' }}>SEA</span>
        </div>
        <div style={{
          fontSize: '0.72rem', letterSpacing: 4, fontWeight: 600,
          color: 'rgba(148,163,184,0.9)', marginTop: 4,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
          MARINE BORDER ALERT SYSTEM
        </div>
      </div>

      {/* Divider */}
      <div style={{
        width: 60, height: 2, borderRadius: 2,
        background: 'linear-gradient(90deg, transparent, #60a5fa, transparent)',
        margin: '18px 0',
      }} />

      {/* Tagline */}
      <div style={{
        fontSize: '0.78rem', color: 'rgba(148,163,184,0.75)',
        letterSpacing: 1.5, fontWeight: 500,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        Calapan City · Oriental Mindoro
      </div>

      {/* Loading dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 48 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#60a5fa',
            animation: 'dot-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: translate(-50%,-50%) scale(0.85); opacity: 0.6; }
          100% { transform: translate(-50%,-50%) scale(1.15); opacity: 0; }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
