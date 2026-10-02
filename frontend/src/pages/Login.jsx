import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8, boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontSize: '0.9rem', outline: 'none',
}
const labelStyle = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'rgba(148,163,184,0.9)', marginBottom: 6, letterSpacing: 0.5,
}

export default function Login() {
  const { user, login, register, loginWithGoogle, error, setError } = useAuth()
  const [tab,      setTab]      = useState('signin') // 'signin' | 'register'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)

  if (user) return <Navigate to="/" replace />

  function switchTab(t) { setTab(t); setError(''); setEmail(''); setPassword(''); setConfirm('') }

  async function handleSubmit(e) {
    e.preventDefault()
    if (tab === 'register' && password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    if (tab === 'signin') await login(email, password)
    else                  await register(email, password)
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    await loginWithGoogle()
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0f172a 0%, #1e3a8a 55%, #1e40af 100%)',
      fontFamily: "'Segoe UI', system-ui, sans-serif", padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: '36px 32px',
        backdropFilter: 'blur(12px)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', boxShadow: '0 8px 24px rgba(37,99,235,0.5)',
          }}>⚓</div>
          <div style={{ fontWeight: 900, fontSize: '1.5rem', letterSpacing: 3, color: '#fff' }}>
            NAVI<span style={{ color: '#60a5fa' }}>SEA</span>
          </div>
          <div style={{ fontSize: '0.65rem', letterSpacing: 3, color: 'rgba(148,163,184,0.7)', marginTop: 4 }}>
            MARINE BORDER ALERT SYSTEM
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.06)',
          borderRadius: 10, padding: 4, marginBottom: 22,
        }}>
          {[['signin', 'Sign In'], ['register', 'Create Account']].map(([key, label]) => (
            <button key={key} onClick={() => switchTab(key)} style={{
              flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.15s',
              background: tab === key ? 'linear-gradient(90deg, #2563eb, #1d4ed8)' : 'transparent',
              color: tab === key ? '#fff' : 'rgba(148,163,184,0.7)',
              boxShadow: tab === key ? '0 2px 8px rgba(37,99,235,0.4)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {/* Google button */}
        <button onClick={handleGoogle} disabled={loading} style={{
          width: '100%', padding: '10px', borderRadius: 8, marginBottom: 16,
          border: '1px solid rgba(255,255,255,0.15)', cursor: loading ? 'not-allowed' : 'pointer',
          background: 'rgba(255,255,255,0.08)', color: '#fff',
          fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 10, transition: 'all 0.15s',
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.5)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>EMAIL</label>
            <input type="email" required autoComplete="email"
              value={email} onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="you@example.com" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>PASSWORD</label>
            <input type="password" required autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              value={password} onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="••••••••" style={inputStyle} />
          </div>

          {tab === 'register' && (
            <div>
              <label style={labelStyle}>CONFIRM PASSWORD</label>
              <input type="password" required autoComplete="new-password"
                value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }}
                placeholder="••••••••" style={inputStyle} />
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 8, padding: '9px 12px', color: '#fca5a5', fontSize: '0.82rem',
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: 4, padding: '11px', borderRadius: 8, border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(37,99,235,0.5)' : 'linear-gradient(90deg, #2563eb, #1d4ed8)',
            color: '#fff', fontWeight: 700, fontSize: '0.9rem', letterSpacing: 0.5,
            boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.4)',
            transition: 'all 0.15s',
          }}>
            {loading ? 'Please wait...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.72rem', color: 'rgba(148,163,184,0.5)' }}>
          Access restricted to authorized personnel only
        </div>
      </div>
    </div>
  )
}
