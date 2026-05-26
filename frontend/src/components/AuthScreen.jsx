import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PASSWORD_RULES = [
  { key: 'lower',   label: 'One lowercase letter (a–z)',   test: p => /[a-z]/.test(p) },
  { key: 'upper',   label: 'One uppercase letter (A–Z)',   test: p => /[A-Z]/.test(p) },
  { key: 'number',  label: 'One number (0–9)',             test: p => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character (!@#…)', test: p => /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/.test(p) },
  { key: 'length',  label: 'At least 8 characters',       test: p => p.length >= 8 },
]

export default function AuthScreen({ onAuth }) {
  const [mode, setMode]           = useState('login')
  const [email, setEmail]         = useState('')
  const [fullName, setFullName]   = useState('')
  const [password, setPass]       = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [pwFocused, setPwFocused] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent]       = useState(false)

  // Forgot password states
  const [resetSent, setResetSent] = useState(false)

  const checks    = PASSWORD_RULES.map(r => ({ ...r, ok: r.test(password) }))
  const allPassed = checks.every(c => c.ok)

  // ── Listen for OAuth + email confirmation redirects ───────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (
          (event === 'SIGNED_IN' || event === 'USER_UPDATED') &&
          session?.user?.email_confirmed_at &&
          session?.user
        ) {
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
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        })
        if (signUpError) throw signUpError

        // Save full_name to profiles table if user created immediately
        if (data.user && fullName.trim()) {
          await supabase
            .from('profiles')
            .upsert({ id: data.user.id, full_name: fullName.trim() }, { onConflict: 'id' })
        }

        if (data.user && !data.user.email_confirmed_at) {
          setAwaitingConfirm(true)
        } else if (data.user && data.session) {
          const { data: profile } = await supabase
            .from('profiles').select('*').eq('id', data.user.id).single()
          onAuth({ user: data.user, session: data.session, profile })
        }

      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          if (signInError.message?.toLowerCase().includes('email not confirmed')) {
            setAwaitingConfirm(true)
            return
          }
          throw signInError
        }
        const { data: profile } = await supabase
          .from('profiles').select('*').eq('id', data.user.id).single()
        onAuth({ user: data.user, session: data.session, profile })
      }

    } catch (err) {
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

  const handleResend = async () => {
    setResending(true)
    setResent(false)
    try {
      await supabase.auth.resend({ type: 'signup', email })
      setResent(true)
    } catch (e) {
      console.error('Resend failed:', e)
    } finally {
      setResending(false)
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}?reset=true`,
      })
      if (resetError) throw resetError
      setResetSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const goBackToLogin = () => {
    setMode('login')
    setResetSent(false)
    setError(null)
    setPass('')
    setPwFocused(false)
  }

  const showRules = mode === 'register' && (pwFocused || password.length > 0)

  // ── Check your email screen ───────────────────────────────────────────
  if (awaitingConfirm) {
    return (
      <div style={{
        minHeight: '100vh', width: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', boxSizing: 'border-box', maxWidth: 420, margin: '0 auto',
      }}>
        <div className="auth-card" style={{ textAlign: 'center', gap: 20, maxWidth: 400 }}>
          <div style={{ fontSize: 52, lineHeight: 1 }}>✉️</div>

          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
              Check your email
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
              We sent a confirmation link to
            </p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple-l)', marginTop: 4 }}>
              {email}
            </p>
          </div>

          <div style={{
            background: 'rgba(124,92,231,0.06)',
            border: '1px solid rgba(124,92,231,0.15)',
            borderRadius: 12, padding: '14px 16px',
            fontSize: 13, color: 'var(--text3)', lineHeight: 1.7,
            textAlign: 'left',
          }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text2)' }}>What to do:</p>
            <p style={{ margin: 0 }}>
              1. Open the email from Ekko<br />
              2. Click the <strong style={{ color: 'var(--purple-l)' }}>Confirm your email</strong> link<br />
              3. Come back here and sign in
            </p>
          </div>

          {resent && (
            <p style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, margin: 0 }}>
              ✓ Confirmation email resent!
            </p>
          )}

          <button
            className="auth-cta"
            onClick={handleResend}
            disabled={resending}
            style={{ opacity: resending ? 0.6 : 1 }}
          >
            {resending ? 'Sending…' : 'Resend confirmation email'}
          </button>

          <button
            onClick={() => {
              setAwaitingConfirm(false)
              setMode('login')
              setPass('')
              setError(null)
            }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text3)', fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  // ── Forgot password screen ────────────────────────────────────────────
  if (mode === 'forgotPassword') {
    return (
      <div style={{
        minHeight: '100vh', width: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', boxSizing: 'border-box', maxWidth: 420, margin: '0 auto',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}></div>
        <div className="auth-logo">EKKO</div>

        <div className="auth-card" style={{ textAlign: 'center', gap: 20, maxWidth: 400 }}>

          {resetSent ? (
            <>
              <div style={{ fontSize: 52, lineHeight: 1 }}>📬</div>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
                  Reset link sent!
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>
                  We sent a password reset link to
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple-l)', marginTop: 4 }}>
                  {email}
                </p>
              </div>

              <div style={{
                background: 'rgba(124,92,231,0.06)',
                border: '1px solid rgba(124,92,231,0.15)',
                borderRadius: 12, padding: '14px 16px',
                fontSize: 13, color: 'var(--text3)', lineHeight: 1.7,
                textAlign: 'left',
              }}>
                <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text2)' }}>What to do:</p>
                <p style={{ margin: 0 }}>
                  1. Open the email from Ekko<br />
                  2. Click the <strong style={{ color: 'var(--purple-l)' }}>Reset password</strong> link<br />
                  3. Choose a new password and sign in
                </p>
              </div>

              <button className="auth-cta" onClick={goBackToLogin}>
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 52, lineHeight: 1 }}>🔑</div>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
                  Forgot your password?
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6, margin: 0 }}>
                  No worries — enter your email and we'll send you a reset link.
                </p>
              </div>

              <input
                className="auth-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />

              {error && <p className="auth-error">{error}</p>}

              <button
                className="auth-cta"
                onClick={handleForgotPassword}
                disabled={loading || !email}
                style={{ opacity: loading || !email ? 0.6 : 1 }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>

              <button
                onClick={goBackToLogin}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text3)', fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Normal login / register screen ────────────────────────────────────
  const canSubmit = email && password && (mode === 'login' || (allPassed && fullName.trim().length > 0))

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', boxSizing: 'border-box', maxWidth: 420, margin: '0 auto',
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

        {/* Full name — register only */}
        {mode === 'register' && (
          <input
            className="auth-input"
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        )}

        <input
          className="auth-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {/* Password field with show/hide */}
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

        {/* Forgot password link — only on login mode */}
        {mode === 'login' && (
          <div style={{ width: '100%', textAlign: 'right', marginTop: -4 }}>
            <button
              onClick={() => {
                setMode('forgotPassword')
                setError(null)
                setResetSent(false)
              }}
              style={{
                background: 'none', border: 'none',
                color: 'var(--purple-l)', fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
                textDecoration: 'none', fontWeight: 500,
                padding: 0,
              }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* Password strength checklist */}
        {showRules && (
          <div style={{
            width: '100%',
            background: 'rgba(124,92,231,0.06)',
            border: '1px solid rgba(124,92,231,0.15)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: '7px',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: '#8b7eb8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password requirements
            </p>
            {checks.map(c => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '18px', height: '18px', borderRadius: '5px',
                  border: c.ok ? '2px solid #7c5ce7' : '2px solid #d4caf0',
                  background: c.ok ? '#7c5ce7' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.2s ease',
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
          disabled={loading || !canSubmit}
          style={{ opacity: loading || !canSubmit ? 0.6 : 1 }}
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <p className="auth-toggle">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
            setPass('')
            setFullName('')
            setPwFocused(false)
          }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  )
}