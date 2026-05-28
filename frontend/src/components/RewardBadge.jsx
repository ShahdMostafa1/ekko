import { useState, useEffect } from 'react'

const RANK_COLORS = {
  xp:      '#a855f7',
  badge:   '#f59e0b',
  streak:  '#f472b6',
  default: '#34d399',
}

function getAccent(sub = '') {
  if (sub.toLowerCase().includes('xp'))     return RANK_COLORS.xp
  if (sub.toLowerCase().includes('badge'))  return RANK_COLORS.badge
  if (sub.toLowerCase().includes('streak')) return RANK_COLORS.streak
  return RANK_COLORS.default
}

export default function RewardBadge({ label, sub }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 30)
    const t2 = setTimeout(() => setExiting(true), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const accent = getAccent(sub || label)

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet" />
      <div style={{
        position: 'fixed', bottom: 28, left: '50%',
        transform: `translateX(-50%) translateY(${visible && !exiting ? '0' : '90px'})`,
        opacity: visible && !exiting ? 1 : 0,
        transition: 'transform .4s cubic-bezier(.34,1.56,.64,1), opacity .35s ease',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'linear-gradient(135deg, rgba(20,12,50,.97), rgba(35,18,70,.97))',
        border: `1.5px solid ${accent}55`,
        borderRadius: 20,
        padding: '12px 20px',
        boxShadow: `0 8px 32px rgba(0,0,0,.5), 0 0 24px ${accent}33`,
        backdropFilter: 'blur(16px)',
        minWidth: 200, maxWidth: 320,
        pointerEvents: 'none',
      }}>
        {/* Animated accent dot */}
        <div style={{
          width: 36, height: 36, borderRadius: 11, flexShrink: 0,
          background: `${accent}22`,
          border: `1.5px solid ${accent}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'rbIconPulse 1.2s ease-in-out infinite',
          fontSize: 18,
        }}>
          {(sub || '').toLowerCase().includes('xp')     && '⚡'}
          {(sub || '').toLowerCase().includes('streak') && '🔥'}
          {(sub || '').toLowerCase().includes('badge')  && '🏅'}
          {(sub || '').toLowerCase().includes('region') && '🗺️'}
          {(sub || '').toLowerCase().includes('mood')   && '🎵'}
          {(sub || '').toLowerCase().includes('music')  && '🎼'}
          {!['xp','streak','badge','region','mood','music'].some(k => (sub||'').toLowerCase().includes(k)) && '✨'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: '0 0 1px',
            fontSize: 15, fontWeight: 800,
            color: accent,
            fontFamily: "'Syne', sans-serif",
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{label}</p>
          {sub && (
            <p style={{
              margin: 0, fontSize: 11, color: 'rgba(255,255,255,.45)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{sub}</p>
          )}
        </div>

        {/* Progress shrink line */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 3, borderRadius: '0 0 20px 20px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', background: accent,
            animation: 'rbShrink 3s linear forwards',
            transformOrigin: 'left',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes rbIconPulse {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 ${accent}44; }
          50%       { transform: scale(1.08); box-shadow: 0 0 0 6px transparent; }
        }
        @keyframes rbShrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </>
  )
}