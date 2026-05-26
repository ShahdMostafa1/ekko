import { useEffect } from 'react'

const NAV_ITEMS = [
  { id: 'mood',    icon: '🎙', label: 'Create'   },
  { id: 'history', icon: '🎵', label: 'Songs'    },
  { id: 'rewards', icon: '🏅', label: 'Rewards'  },
  { id: 'plans',   icon: '✨', label: 'Plans'    },
  { id: 'billing', icon: '💳', label: 'Billing'  },
]

export default function Sidebar({ open, onClose, screen, onNavigate, onBilling, onSignOut, userName, userEmail, xp, userPlan }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Navigate FIRST, then close after — order matters
  const handleNav = (id) => {
    if (id === 'billing') {
      onBilling?.()
    } else {
      onNavigate(id)
    }
    setTimeout(onClose, 0)
  }

  // Derive display name from full name or email prefix
  const displayName = userName?.trim()
    ? userName.trim()
    : userEmail
      ? userEmail.split('@')[0]
      : 'Music Lover'

  return (
    <>
      {/* Backdrop — only rendered when open, never steals nav clicks because nav buttons stopPropagation */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,.55)',
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Sidebar panel */}
      <div style={{
        position:   'fixed', top: 0, left: 0, bottom: 0,
        width:      270, zIndex: 201,
        background: 'linear-gradient(180deg, #0f0a24 0%, #130d2e 60%, #0a0718 100%)',
        borderRight: '1px solid rgba(124,92,231,.2)',
        boxShadow:  open ? '4px 0 48px rgba(0,0,0,.7)' : 'none',
        transform:  open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        display:    'flex', flexDirection: 'column',
        overflowY:  'auto',
      }}>

        {/* Top bar: Ekko logo + close — matches header height so nothing is cut off */}
        <div style={{
          height:         56,
          minHeight:      56,
          padding:        '0 16px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          borderBottom:   '1px solid rgba(255,255,255,.07)',
          flexShrink:     0,
        }}>
          <span style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20,
            background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Ekko</span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 8, color: '#8b7eb8', fontSize: 16,
              width: 32, height: 32, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Hello greeting card */}
        <div style={{
          margin: '16px 14px 4px',
          background: 'linear-gradient(135deg, rgba(124,92,231,.15), rgba(168,85,247,.08))',
          border: '1px solid rgba(124,92,231,.25)',
          borderRadius: 16, padding: '14px 16px',
          flexShrink: 0,
        }}>
          <p style={{
            margin: '0 0 2px', fontSize: 12, color: '#7c5ce7',
            fontWeight: 700, letterSpacing: '.06em',
            fontFamily: "'Syne', sans-serif", textTransform: 'uppercase',
          }}>
            Hello 👋
          </p>
          <p style={{
            margin: '0 0 10px', fontSize: 19, fontWeight: 800,
            color: '#e0d8ff', fontFamily: "'Syne', sans-serif", lineHeight: 1.2,
            wordBreak: 'break-word',
          }}>
            {displayName}
          </p>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <div style={{
              background: 'rgba(124,92,231,.2)', border: '1px solid rgba(124,92,231,.35)',
              borderRadius: 20, padding: '3px 10px',
              fontSize: 12, fontWeight: 700, color: '#a78bfa',
            }}>
              ⚡ {xp ?? 0} XP
            </div>
            <div style={{
              background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.3)',
              borderRadius: 20, padding: '3px 10px',
              fontSize: 12, fontWeight: 700, color: '#34d399',
            }}>
              {userPlan === 'groove' ? '🌊 Groove'
               : userPlan === 'studio' ? '🎨 Studio'
               : '🎧 Free'}
            </div>
          </div>

          {userEmail && (
            <p style={{
              margin: '8px 0 0', fontSize: 11, color: '#4b4570',
              wordBreak: 'break-all', lineHeight: 1.4,
            }}>
              {userEmail}
            </p>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          <p style={{
            margin: '0 0 8px 8px', fontSize: 10, fontWeight: 700,
            color: '#4b4570', textTransform: 'uppercase', letterSpacing: '.1em',
            fontFamily: "'Syne', sans-serif",
          }}>
            Navigate
          </p>

          {NAV_ITEMS.map(item => {
            const isActive = screen === item.id
            return (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); handleNav(item.id) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 13px', marginBottom: 3,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(124,92,231,.25), rgba(168,85,247,.15))'
                    : 'transparent',
                  border: isActive
                    ? '1px solid rgba(124,92,231,.4)'
                    : '1px solid transparent',
                  borderRadius: 12, cursor: 'pointer',
                  transition: 'all .18s', textAlign: 'left',
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,.05)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: 19, width: 26, textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#e0d8ff' : '#8b7eb8',
                  transition: 'color .18s',
                }}>
                  {item.label}
                </span>
                {isActive && (
                  <div style={{
                    marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                    background: '#a855f7', boxShadow: '0 0 8px #a855f7',
                  }} />
                )}
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '10px 10px 24px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onSignOut?.(); onClose() }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 13px',
              background: 'transparent',
              border: '1px solid rgba(248,113,113,.2)',
              borderRadius: 12, cursor: 'pointer',
              color: '#f87171', fontSize: 14, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all .18s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(248,113,113,.08)'
              e.currentTarget.style.borderColor = 'rgba(248,113,113,.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(248,113,113,.2)'
            }}
          >
            <span style={{ fontSize: 18 }}>👋</span>
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}