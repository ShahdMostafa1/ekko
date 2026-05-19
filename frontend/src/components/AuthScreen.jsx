import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PASSWORD_RULES = [
  { key: 'lower',   label: 'One lowercase letter (a–z)',  test: p => /[a-z]/.test(p) },
  { key: 'upper',   label: 'One uppercase letter (A–Z)',  test: p => /[A-Z]/.test(p) },
  { key: 'number',  label: 'One number (0–9)',            test: p => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character (!@#…)',test: p => /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/.test(p) },
  { key: 'length',  label: 'At least 8 characters',      test: p => p.length >= 8 },
]

export default function AuthScreen({ onAuth }) {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPass]     = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [pwFocused, setPwFocused] = useState(false)

  const checks = PASSWORD_RULES.map(r => ({ ...r, ok: r.test(password) }))
  const allPassed = checks.every(c => c.ok)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const user = session.user
          const { data: profile } = await supabase
            .from('profiles').select('*').eq('id', user.id).single()
          onAuth({ user, session, profile })
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      let res
      if (mode === 'register') {
        res = await supabase.auth.signUp({ email, password })
      } else {
        res = await supabase.auth.signInWithPassword({ email, password })
      }
      if (res.error) throw res.error
      const user    = res.data.user
      const session = res.data.session
      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      onAuth({ user, session, profile })
    } catch (err) {
      // Suppress the raw Supabase password policy error
      const msg = err.message || ''
      if (msg.toLowerCase().includes('password should contain')) {
        setError('Please make sure your password meets all the requirements below.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const showRules = mode === 'register' && (pwFocused || password.length > 0)

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      boxSizing: 'border-box',
    }}>
      <div className="auth-logo">EKKO</div>
      <h1 className="auth-headline">
        <em>{mode === 'login' ? 'Welcome back' : 'Begin your journey'}</em>
      </h1>
      <p className="auth-sub">Musical Mood Journeys</p>

      <div className="auth-card">
        {/* Google */}
        <button className="auth-google" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36.5 24 36.5c-5.2 0-9.6-3.5-11.2-8.3l-6.5 5C9.5 39.4 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.2 5.2C41 34.9 44 29.9 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider"><span>or</span></div>

        <input
          className="auth-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {/* Password field */}
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            className="auth-input"
            type={showPass ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPass(e.target.value)}
            onFocus={() => setPwFocused(true)}
            onBlur={() => setPwFocused(false)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ paddingRight: '48px', width: '100%', boxSizing: 'border-box' }}
          />
          <button
            onClick={() => setShowPass(p => !p)}
            tabIndex={-1}
            aria-label={showPass ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute', right: '14px', top: '50%',
              transform: 'translateY(-50%)', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
              color: '#8b7eb8', display: 'flex', alignItems: 'center',
            }}
          >
            {showPass ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>

        {/* Password strength checklist — only on register when typing */}
        {showRules && (
          <div style={{
            width: '100%',
            background: 'rgba(124,92,231,0.06)',
            border: '1px solid rgba(124,92,231,0.15)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: '#8b7eb8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password requirements
            </p>
            {checks.map(c => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Animated checkbox */}
                <div style={{
                  width: '18px', height: '18px',
                  borderRadius: '5px',
                  border: c.ok ? '2px solid #7c5ce7' : '2px solid #d4caf0',
                  background: c.ok ? '#7c5ce7' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}>
                  {c.ok && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{
                  fontSize: '13px',
                  color: c.ok ? '#5c3fc7' : '#9e8fc0',
                  fontWeight: c.ok ? 600 : 400,
                  transition: 'all 0.2s ease',
                }}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}

        <button
          className="auth-cta"
          onClick={handleSubmit}
          disabled={loading || !email || !password || (mode === 'register' && !allPassed)}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <p className="auth-toggle">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setPass(''); setPwFocused(false) }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  )
}