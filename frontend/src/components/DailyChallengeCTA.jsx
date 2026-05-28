import { useState, useEffect } from 'react'

const DAILY_CHALLENGES = [
  { id: 'dc1', emoji: '🌅', label: 'Morning Mood',  desc: 'Share a mood before noon',  xp: 15 },
  { id: 'dc2', emoji: '🎭', label: 'Emotion Flip',  desc: 'Try a new region today',    xp: 20 },
  { id: 'dc3', emoji: '🌙', label: 'Night Session', desc: 'Create a song after 9 PM',  xp: 25 },
  { id: 'dc4', emoji: '🎲', label: 'Random Vibes',  desc: 'Use the quiz mood input',   xp: 15 },
  { id: 'dc5', emoji: '🔁', label: 'Double Down',   desc: 'Generate 2 songs today',    xp: 30 },
]

export default function DailyChallengeCTA({ onAccept, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const today     = new Date()
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  const challenge = DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length]

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  const handleDismiss = () => {
    setLeaving(true)
    setTimeout(onDismiss, 350)
  }

  const handleAccept = () => {
    setLeaving(true)
    setTimeout(() => onAccept(challenge), 350)
  }

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     visible && !leaving ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0)',
      backdropFilter: visible && !leaving ? 'blur(10px)' : 'blur(0px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         1800,
      padding:        24,
      transition:     'background .35s ease, backdrop-filter .35s ease',
    }}>
      <div style={{
        background:    'linear-gradient(145deg, #120a2e 0%, #1e1248 60%, #120a2e 100%)',
        border:        '1.5px solid rgba(251,191,36,0.4)',
        borderRadius:  28,
        padding:       '36px 28px 28px',
        maxWidth:      360,
        width:         '100%',
        position:      'relative',
        overflow:      'hidden',
        boxShadow:     '0 0 60px rgba(251,191,36,0.15), 0 32px 80px rgba(0,0,0,0.7)',
        opacity:       visible && !leaving ? 1 : 0,
        transform:     visible && !leaving
          ? 'translateY(0) scale(1)'
          : leaving
          ? 'translateY(-16px) scale(0.96)'
          : 'translateY(24px) scale(0.94)',
        transition:    'opacity .38s cubic-bezier(.34,1.56,.64,1), transform .38s cubic-bezier(.34,1.56,.64,1)',
        textAlign:     'center',
      }}>
        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,231,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Pill label */}
        <div style={{ display: 'inline-block', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 99, padding: '5px 14px', fontSize: 10, fontWeight: 800, color: '#fbbf24', letterSpacing: '.1em', marginBottom: 20, fontFamily: "'Syne', sans-serif" }}>
          ✦ TODAY'S CHALLENGE
        </div>

        {/* Emoji */}
        <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.1))', border: '1.5px solid rgba(251,191,36,0.35)', boxShadow: '0 0 24px rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, margin: '0 auto 18px', animation: 'challengePulse 2.5s ease-in-out infinite' }}>
          {challenge.emoji}
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#fde68a', fontFamily: "'Syne', sans-serif", lineHeight: 1.2 }}>
          {challenge.label}
        </h2>
        <p style={{ margin: '0 0 6px', fontSize: 15, color: '#a78bfa', lineHeight: 1.5, fontWeight: 500 }}>
          {challenge.desc}
        </p>

        {/* XP reward */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '7px 16px', margin: '14px 0 24px', fontSize: 16, fontWeight: 800, color: '#fbbf24', fontFamily: "'Syne', sans-serif" }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          +{challenge.xp} XP on completion
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleAccept}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', border: 'none', borderRadius: 16, color: '#1a0f00', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 6px 24px rgba(251,191,36,0.35)', transition: 'transform .15s, box-shadow .15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(251,191,36,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(251,191,36,0.35)' }}
          >
            Let's do it! 🚀
          </button>
          <button
            onClick={handleDismiss}
            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#4b4570', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'color .2s, border-color .2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#8b7eb8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4b4570'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
          >
            Maybe later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes challengePulse {
          0%, 100% { box-shadow: 0 0 24px rgba(251,191,36,0.2); }
          50%       { box-shadow: 0 0 40px rgba(251,191,36,0.4); }
        }
      `}</style>
    </div>
  )
}