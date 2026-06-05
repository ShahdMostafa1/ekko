import { useEffect } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'

const NAV_ITEMS = [
  { id: 'mood',    icon: '🎙', labelKey: 'nav.create'   },
  { id: 'history', icon: '🎵', labelKey: 'nav.songs'    },
  { id: 'journey', icon: '📈', labelKey: 'nav.journey'  },
  { id: 'rewards', icon: '🏅', labelKey: 'nav.rewards'  },
  { id: 'survey',  icon: '📋', labelKey: 'nav.study'    },
  { id: 'plans',   icon: '✨', labelKey: 'nav.plans'    },
  { id: 'billing', icon: '💳', labelKey: 'nav.billing'  },
]

export default function Sidebar({ open, onClose, screen, onNavigate, onBilling, onSignOut, userName, userEmail, xp, userPlan, surveyLocked = false, surveyPhase = 'pre' }) {
  const { t, locale, setLocale, isRtl } = useI18n()
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

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
      : t('nav.musicLover')

  const planLabel = userPlan === 'groove' ? t('nav.planGroove')
    : userPlan === 'studio' ? t('nav.planStudio')
    : t('nav.planFree')

  const panelSide = isRtl
    ? { left: 'auto', right: 0, paddingLeft: 0, paddingRight: 'env(safe-area-inset-right)', borderRight: 'none', borderLeft: '1px solid rgba(124,92,231,.2)', boxShadow: open ? '-4px 0 48px rgba(0,0,0,.7)' : 'none', transform: open ? 'translateX(0)' : 'translateX(100%)' }
    : { left: 0, right: 'auto', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 0, borderRight: '1px solid rgba(124,92,231,.2)', borderLeft: 'none', boxShadow: open ? '4px 0 48px rgba(0,0,0,.7)' : 'none', transform: open ? 'translateX(0)' : 'translateX(-100%)' }

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
        position:   'fixed', top: 0, bottom: 0,
        width:      'min(270px, 85vw)', zIndex: 201,
        background: 'linear-gradient(180deg, #0f0a24 0%, #130d2e 60%, #0a0718 100%)',
        transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        display:    'flex', flexDirection: 'column',
        overflowY:  'auto',
        ...panelSide,
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
            fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 25,
            background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Ekko</span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 8, color: '#8b7eb8', fontSize: 21,
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
            margin: '0 0 2px', fontSize: 17, color: '#7c5ce7',
            fontWeight: 700, letterSpacing: '.06em',
            fontFamily: "'Syne', sans-serif", textTransform: 'uppercase',
          }}>
            {t('nav.hello')}
          </p>
          <p style={{
            margin: '0 0 10px', fontSize: 24, fontWeight: 800,
            color: '#e0d8ff', fontFamily: "'Syne', sans-serif", lineHeight: 1.2,
            wordBreak: 'break-word',
          }}>
            {displayName}
          </p>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <div style={{
              background: 'rgba(124,92,231,.2)', border: '1px solid rgba(124,92,231,.35)',
              borderRadius: 20, padding: '3px 10px',
              fontSize: 17, fontWeight: 700, color: '#a78bfa',
            }}>
              ⚡ {xp ?? 0} XP
            </div>
            <div style={{
              background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.3)',
              borderRadius: 20, padding: '3px 10px',
              fontSize: 17, fontWeight: 700, color: '#34d399',
            }}>
              {planLabel}
            </div>
          </div>

          {userEmail && (
            <p style={{
              margin: '8px 0 0', fontSize: 16, color: '#4b4570',
              wordBreak: 'break-all', lineHeight: 1.4,
            }}>
              {userEmail}
            </p>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          <p style={{
            margin: '0 0 8px 8px', fontSize: 15, fontWeight: 700,
            color: '#4b4570', textTransform: 'uppercase', letterSpacing: '.1em',
            fontFamily: "'Syne', sans-serif",
          }}>
            {t('nav.navigate')}
          </p>

          {NAV_ITEMS.map(item => {
            const isActive = screen === item.id
            const navBlocked = surveyLocked && item.id !== 'survey'
            return (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); handleNav(item.id) }}
                title={navBlocked ? (surveyPhase === 'post' ? t('survey.gatePost') : t('survey.gatePre')) : undefined}
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
                  transition: 'all .18s', textAlign: isRtl ? 'right' : 'left',
                  fontFamily: "'DM Sans', sans-serif",
                  opacity: navBlocked ? 0.55 : 1,
                  cursor: navBlocked ? 'not-allowed' : 'pointer',
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
                <span style={{ fontSize: 24, width: 26, textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span style={{
                  fontSize: 19, fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#e0d8ff' : '#8b7eb8',
                  transition: 'color .18s',
                }}>
                  {t(item.labelKey)}
                </span>
                {isActive && (
                  <div style={{
                    marginInlineStart: 'auto', width: 6, height: 6, borderRadius: '50%',
                    background: '#a855f7', boxShadow: '0 0 8px #a855f7',
                  }} />
                )}
              </button>
            )
          })}
        </nav>

        {/* Language + sign out */}
        <div style={{ padding: '10px 10px 24px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          <p style={{
            margin: '0 0 8px 8px', fontSize: 15, fontWeight: 700,
            color: '#4b4570', textTransform: 'uppercase', letterSpacing: '.1em',
            fontFamily: "'Syne', sans-serif",
          }}>
            {t('lang.label')}
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, padding: '0 4px' }}>
            {(['en', 'ar']).map((code) => (
              <button
                key={code}
                type="button"
                onClick={(e) => { e.stopPropagation(); setLocale(code) }}
                style={{
                  flex: 1, padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700,
                  background: locale === code
                    ? 'linear-gradient(135deg, rgba(124,92,231,.35), rgba(168,85,247,.2))'
                    : 'rgba(255,255,255,.04)',
                  border: locale === code
                    ? '1px solid rgba(124,92,231,.45)'
                    : '1px solid rgba(255,255,255,.08)',
                  color: locale === code ? '#e0d8ff' : '#8b7eb8',
                }}
              >
                {t(`lang.${code}`)}
              </button>
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onSignOut?.(); onClose() }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 13px',
              background: 'transparent',
              border: '1px solid rgba(248,113,113,.2)',
              borderRadius: 12, cursor: 'pointer',
              color: '#f87171', fontSize: 19, fontWeight: 600,
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
            <span style={{ fontSize: 23 }}>👋</span>
            {t('nav.signOut')}
          </button>
        </div>
      </div>
    </>
  )
}