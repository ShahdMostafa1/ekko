import { useState, useEffect, useRef, useMemo } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { getTodayChallenge } from '../utils/dailyChallenges'
import {
  BADGES,
  computeBadgeStats,
  isBadgeEarned,
  getNewlyEarnedBadges,
  markBadgeAnnounced,
} from '../utils/badges'

// ── Data ──────────────────────────────────────────────────────────────────────
const RANKS = [
  { id: 'listener',  label: 'Listener',    min: 0,    max: 49,       color: '#9ca3af', glow: '#9ca3af44', icon: '🎧' },
  { id: 'vibe',      label: 'Vibe Seeker', min: 50,   max: 149,      color: '#34d399', glow: '#34d39944', icon: '🌊' },
  { id: 'composer',  label: 'Composer',    min: 150,  max: 299,      color: '#60a5fa', glow: '#60a5fa44', icon: '🎹' },
  { id: 'artist',    label: 'Artist',      min: 300,  max: 599,      color: '#f59e0b', glow: '#f59e0b44', icon: '🎨' },
  { id: 'maestro',   label: 'Maestro',     min: 600,  max: 999,      color: '#f472b6', glow: '#f472b644', icon: '🏆' },
  { id: 'legend',    label: 'Legend',      min: 1000, max: Infinity, color: '#a855f7', glow: '#a855f744', icon: '⭐' },
]

const REGION_META = {
  arabic:      { emoji: '🌙', label: 'Arabic',      color: '#c9a84c' },
  west_africa: { emoji: '🥁', label: 'West Africa', color: '#e07b39' },
  india:       { emoji: '🪔', label: 'India',       color: '#d4518a' },
  east_asia:   { emoji: '🌸', label: 'East Asia',   color: '#7eb8c9' },
  latin:       { emoji: '🎺', label: 'Latin',       color: '#e04f4f' },
  europe:      { emoji: '🎻', label: 'Europe',      color: '#6e8efb' },
  global:      { emoji: '🌍', label: 'Global Mix',  color: '#7c5ce7' },
}

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// ── Helpers ───────────────────────────────────────────────────────────────────
function getRank(xp)     { return RANKS.find(r => xp >= r.min && xp <= r.max) || RANKS[0] }
function getNextRank(xp) {
  const idx = RANKS.findIndex(r => xp >= r.min && xp <= r.max)
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null
}
// ── Badge Earned Popup ────────────────────────────────────────────────────────
function BadgeEarnedPopup({ badge, onClose }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 30)
    const t2 = setTimeout(() => handleClose(), 5000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const handleClose = () => {
    setLeaving(true)
    setTimeout(onClose, 400)
  }

  const isShowing = visible && !leaving

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: isShowing ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
      backdropFilter: isShowing ? 'blur(6px)' : 'blur(0px)',
      transition: 'background .35s ease, backdrop-filter .35s ease',
      pointerEvents: isShowing ? 'auto' : 'none',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1a0f3a 0%, #2a1560 50%, #1a0f3a 100%)',
        border: '1.5px solid rgba(168,85,247,0.6)',
        borderRadius: 28,
        padding: '36px 28px 28px',
        maxWidth: 340, width: '100%',
        textAlign: 'center',
        boxShadow: '0 0 60px rgba(168,85,247,0.35), 0 24px 64px rgba(0,0,0,0.7)',
        position: 'relative', overflow: 'hidden',
        opacity: isShowing ? 1 : 0,
        transform: isShowing
          ? 'translateY(0) scale(1)'
          : leaving
          ? 'translateY(-20px) scale(0.95)'
          : 'translateY(30px) scale(0.92)',
        transition: 'opacity .4s cubic-bezier(.34,1.56,.64,1), transform .4s cubic-bezier(.34,1.56,.64,1)',
        pointerEvents: isShowing ? 'auto' : 'none',
      }}>
        {/* Shimmer */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
          background: 'linear-gradient(135deg, transparent 40%, rgba(168,85,247,0.08) 50%, transparent 60%)',
          animation: 'badgeShimmer 2.5s ease-in-out infinite',
        }} />

        {/* Confetti */}
        {isShowing && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 'inherit' }}>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${8 + i * 7.5}%`, top: '-8px',
                width: `${4 + (i % 3) * 2}px`, height: `${4 + (i % 3) * 2}px`,
                borderRadius: i % 2 === 0 ? '50%' : '2px',
                background: ['#a855f7','#f59e0b','#34d399','#60a5fa','#f472b6','#fbbf24',
                             '#a855f7','#34d399','#f59e0b','#60a5fa','#f472b6','#a855f7'][i],
                animation: `confettiFall ${1.2 + (i % 4) * 0.3}s ease-in ${i * 0.08}s forwards`,
              }} />
            ))}
          </div>
        )}

        {/* NEW BADGE pill */}
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(90deg, #a855f7, #7c3aed)',
          borderRadius: 99, padding: '4px 14px',
          fontSize: 15, fontWeight: 800, color: '#fff',
          letterSpacing: '.1em', marginBottom: 20,
          fontFamily: "'Syne', sans-serif",
          boxShadow: '0 4px 16px rgba(168,85,247,0.4)',
        }}>
          🏅 NEW BADGE UNLOCKED
        </div>

        {/* Emoji with glow ring */}
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 35%, rgba(168,85,247,0.35), rgba(124,92,231,0.1))',
          border: '2px solid rgba(168,85,247,0.5)',
          boxShadow: '0 0 32px rgba(168,85,247,0.5), inset 0 0 20px rgba(168,85,247,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 49, margin: '0 auto 18px',
          animation: 'badgeGlow 2s ease-in-out infinite',
        }}>
          {badge.emoji}
        </div>

        <h2 style={{ margin: '0 0 10px', fontSize: 27, fontWeight: 800, color: '#e0d8ff', fontFamily: "'Syne', sans-serif", lineHeight: 1.2 }}>
          {badge.label}
        </h2>

        <p style={{ margin: '0 0 22px', fontSize: 19, color: '#a78bfa', lineHeight: 1.6, fontWeight: 500 }}>
          {badge.why}
        </p>

        <button
          onClick={handleClose}
          style={{
            width: '100%', padding: '13px',
            background: 'rgba(168,85,247,0.15)',
            border: '1.5px solid rgba(168,85,247,0.35)',
            borderRadius: 14, color: '#c4b5f0',
            fontSize: 19, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'background .2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(168,85,247,0.15)'}
        >
          Awesome! 🎉
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Particle({ x, y, color }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      width: 6, height: 6, borderRadius: '50%',
      background: color, pointerEvents: 'none',
      animation: 'particleBurst .7s ease-out forwards',
    }} />
  )
}

function BadgeCard({ badge, badgeStats, onTap }) {
  const earned = isBadgeEarned(badge, badgeStats)
  const [burst, setBurst] = useState(false)

  const handleTap = () => {
    if (earned) setBurst(true)
    onTap(badge, earned)
    setTimeout(() => setBurst(false), 700)
  }

  return (
    <div onClick={handleTap} style={{
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px',
      background: earned ? 'rgba(168,85,247,.08)' : 'rgba(255,255,255,.03)',
      border: `1.5px solid ${earned ? 'rgba(168,85,247,.35)' : 'rgba(255,255,255,.07)'}`,
      borderRadius: 16, cursor: 'pointer', transition: 'all .2s',
      transform: burst ? 'scale(1.02)' : 'scale(1)',
    }}>
      {burst && (
        <>{[...Array(6)].map((_, i) => (
          <Particle key={i}
            x={`${20 + i * 10}%`} y={`${30 + (i % 2) * 40}%`}
            color={['#a855f7','#f59e0b','#34d399','#60a5fa','#f472b6','#fff'][i]} />
        ))}</>
      )}
      <div style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        background: earned ? 'rgba(168,85,247,.15)' : 'rgba(255,255,255,.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27,
        filter: earned ? 'none' : 'grayscale(1) brightness(.4)',
        boxShadow: earned ? '0 0 12px rgba(168,85,247,.3)' : 'none', transition: 'all .3s',
      }}>{badge.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: 19, fontWeight: 700, color: earned ? '#e0d8ff' : '#4b4570', fontFamily: "'Syne', sans-serif" }}>
          {badge.label}
        </p>
        <p style={{ margin: 0, fontSize: 17, color: earned ? '#8b7eb8' : '#3a3455', lineHeight: 1.4 }}>
          {earned ? badge.desc : badge.how}
        </p>
      </div>
      {earned
        ? <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: '#a855f7', boxShadow: '0 0 8px rgba(168,85,247,.8)' }} />
        : <div style={{ fontSize: 19, opacity: .35 }}>🔒</div>
      }
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RewardsScreen({ xp = 0, userId = '', onStartChallenge, onViewJourney, badgeRefreshKey = 0 }) {
  const { t } = useI18n()
  const [byRegion,   setByRegion]   = useState({})
  const [songs,      setSongs]      = useState([])
  const [moodLogs,   setMoodLogs]   = useState([])
  const [activeTab,  setActiveTab]  = useState('progress')
  const [tooltip,    setTooltip]    = useState(null)
  const [mounted,    setMounted]    = useState(false)
  const [dailyDone,  setDailyDone]  = useState(false)

  // Badge popup queue
  const [badgeQueue,   setBadgeQueue]   = useState([])
  const [currentBadge, setCurrentBadge] = useState(null)
  const prevEarnedRef = useRef(null)

  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  // Load song + mood history
  useEffect(() => {
    if (!userId) return
    fetch(`${import.meta.env.VITE_API_URL}/music/history/${userId}`)
      .then(r => r.json())
      .then(data => {
        setByRegion(data.by_region || {})
        setSongs(data.songs || [])
      })
      .catch(() => {})
    fetch(`${import.meta.env.VITE_API_URL}/mood/history/${userId}`)
      .then(r => r.json())
      .then(data => setMoodLogs(data.logs || []))
      .catch(() => {})
    fetch(`${import.meta.env.VITE_API_URL}/rewards/daily-challenge/${userId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setDailyDone(!!data.completed) })
      .catch(() => {})
  }, [userId, badgeRefreshKey])

  const badgeStats = useMemo(
    () => computeBadgeStats({ songs, moodLogs, xp }),
    [songs, moodLogs, xp],
  )

  // ── Streak & calendar ─────────────────────────────────
  const logDates = new Set(moodLogs.map(l => new Date(l.created_at).toDateString()))
  const today    = new Date()
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1
  const days = WEEK_DAYS.map((label, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (todayIdx - i))
    return { label, active: logDates.has(d.toDateString()), today: i === todayIdx, future: i > todayIdx }
  })
  const { streak } = badgeStats

  const rank         = getRank(xp)
  const nextRank     = getNextRank(xp)
  const rankPct      = nextRank ? Math.min(100, Math.round(((xp - rank.min) / (nextRank.min - rank.min)) * 100)) : 100
  const dailyChall   = getTodayChallenge(today)
  const earnedBadges = BADGES.filter(b => isBadgeEarned(b, badgeStats)).length
  const regions      = Object.keys(byRegion)

  // ── Detect newly earned badges and queue popups ───────
  useEffect(() => {
    if (!userId) return

    const newlyEarned = getNewlyEarnedBadges(badgeStats, userId)

    if (prevEarnedRef.current === null) {
      // First load — mark all currently earned badges as announced (no retroactive popups)
      BADGES.filter(b => isBadgeEarned(b, badgeStats)).forEach(b => markBadgeAnnounced(userId, b.id))
      prevEarnedRef.current = true
      return
    }

    if (newlyEarned.length > 0) {
      newlyEarned.forEach(b => markBadgeAnnounced(userId, b.id))
      setBadgeQueue(q => [...q, ...newlyEarned])
    }
  }, [badgeStats, userId])

  // ── Drain queue one popup at a time ──────────────────
  useEffect(() => {
    if (!currentBadge && badgeQueue.length > 0) {
      const [next, ...rest] = badgeQueue
      setCurrentBadge(next)
      setBadgeQueue(rest)
    }
  }, [badgeQueue, currentBadge])

  return (
    <div
      className="rewards-screen"
      style={{
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all .4s ease',
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      <div className="rewards-hero-row">
      {/* ── Header ── */}
      <div className="rewards-hero">
        <div
          className="rewards-rank-orb"
          style={{
          width: 80, height: 80, borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${rank.color}cc, ${rank.color}44)`,
          boxShadow: `0 0 32px ${rank.glow}, 0 0 64px ${rank.glow}`,
          margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 41, animation: 'rankFloat 3s ease-in-out infinite',
        }}>{rank.icon}</div>
        <p style={{ margin: '0 0 2px', fontSize: 27, fontWeight: 800, color: rank.color, fontFamily: "'Syne', sans-serif", textShadow: `0 0 20px ${rank.glow}` }}>
          {rank.label}
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 18, color: '#8b7eb8' }}>
          {xp} XP · {streak} day streak 🔥 · {earnedBadges}/{BADGES.length} badges
        </p>
        {nextRank && (
          <p style={{ margin: 0, fontSize: 16, color: '#6b5f8a' }}>
            {nextRank.min - xp} XP until{' '}
            <span style={{ color: nextRank.color, fontWeight: 700 }}>{nextRank.label}</span> {nextRank.icon}
          </p>
        )}
      </div>

      {/* ── Rank progress bar ── */}
      <div className="rewards-section-card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 16, color: '#6b5f8a', fontWeight: 700 }}>RANK PROGRESS</span>
          <span style={{ fontSize: 16, color: rank.color, fontWeight: 700 }}>{rankPct}%</span>
        </div>
        <div style={{ height: 10, background: 'rgba(255,255,255,.07)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${rankPct}%`,
            background: `linear-gradient(90deg, ${rank.color}88, ${rank.color})`,
            borderRadius: 5, boxShadow: `0 0 10px ${rank.color}`,
            transition: 'width 1s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 15, color: '#6b5f8a' }}>{rank.label}</span>
          {nextRank && <span style={{ fontSize: 15, color: nextRank.color }}>{nextRank.label}</span>}
        </div>
      </div>
      </div>

      <div className="rewards-sidebar-stack">
      <div className="rewards-actions">
      {onViewJourney && (
        <button
          type="button"
          className="rh-journey-cta"
          onClick={() => onViewJourney()}
          style={{
            width: '100%', marginBottom: 0, padding: '14px 16px', borderRadius: 16,
            border: '1px solid rgba(168,85,247,0.35)', cursor: 'pointer', textAlign: 'left',
            background: 'linear-gradient(135deg, rgba(124,92,231,0.18), rgba(168,85,247,0.08))',
            display: 'flex', alignItems: 'center', gap: 14,
            transition: 'border-color .2s, transform .15s',
          }}
        >
          <span style={{ fontSize: 33, flexShrink: 0 }} aria-hidden="true">📈</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 19, fontWeight: 700, color: '#e0d8ff', fontFamily: "'Syne', sans-serif" }}>
              {t('rewards.viewJourney')}
            </span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 17, color: '#8b7eb8', lineHeight: 1.4 }}>
              {t('rewards.viewJourneySub')}
            </span>
          </span>
          <span style={{ fontSize: 23, color: '#a855f7', flexShrink: 0 }} aria-hidden="true">→</span>
        </button>
      )}

      {/* ── Daily Challenge ── */}
      <div
        className="rh-daily-challenge"
        onClick={() => onStartChallenge?.()}
        style={{
          background: 'linear-gradient(135deg, rgba(251,191,36,.08), rgba(245,158,11,.04))',
          border: '1.5px solid rgba(251,191,36,.25)', borderRadius: 18,
          padding: '16px 18px', marginBottom: 0,
          display: 'flex', alignItems: 'center', gap: 14,
          position: 'relative', overflow: 'hidden',
          cursor: onStartChallenge ? 'pointer' : 'default',
          transition: 'border-color .2s',
        }}
        onMouseEnter={e => { if (onStartChallenge) e.currentTarget.style.borderColor = 'rgba(251,191,36,.5)' }}
        onMouseLeave={e => { if (onStartChallenge) e.currentTarget.style.borderColor = 'rgba(251,191,36,.25)' }}
      >
        <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(251,191,36,.06)', pointerEvents: 'none' }} />
        <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: 'rgba(251,191,36,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 29, border: '1px solid rgba(251,191,36,.3)' }}>
          {dailyChall.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24', fontFamily: "'Syne', sans-serif", letterSpacing: '.08em' }}>DAILY CHALLENGE</span>
          <p style={{ margin: '2px 0', fontSize: 19, fontWeight: 700, color: '#fde68a' }}>{dailyChall.label}</p>
          <p style={{ margin: 0, fontSize: 17, color: '#92400e' }}>{dailyDone ? '✅ Completed today!' : dailyChall.desc}</p>
        </div>
        <div style={{ background: dailyDone ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,.15)', border: `1px solid ${dailyDone ? 'rgba(52,211,153,0.35)' : 'rgba(251,191,36,.3)'}`, borderRadius: 10, padding: '6px 12px', flexShrink: 0, fontSize: 18, fontWeight: 800, color: dailyDone ? '#6ee7b7' : '#fbbf24', fontFamily: "'Syne', sans-serif" }}>
          {dailyDone ? 'Done' : `+${dailyChall.xp} XP`}
        </div>
      </div>
      </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 4 }}>
        {[
          { id: 'progress', label: '📈 Progress' },
          { id: 'badges',   label: `🏅 Badges (${earnedBadges})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '9px 8px',
            background: activeTab === tab.id
              ? 'linear-gradient(135deg, rgba(124,92,231,.4), rgba(168,85,247,.3))'
              : 'transparent',
            border: activeTab === tab.id ? '1px solid rgba(168,85,247,.4)' : '1px solid transparent',
            borderRadius: 10,
            color: activeTab === tab.id ? '#e0d8ff' : '#6b5f8a',
            fontSize: 17, fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
            fontFamily: "'DM Sans', sans-serif",
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ══════════ PROGRESS TAB ══════════ */}
      {activeTab === 'progress' && (
        <div className="rewards-progress-body">
          <div className="rewards-progress-streak">
            <Section label={`This week · ${streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet'}`}>
              <div className="rewards-section-card">
                <div style={{ display: 'flex', gap: 6 }}>
                  {days.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: '100%', aspectRatio: '1', borderRadius: 10,
                        background: d.today ? 'linear-gradient(135deg, #7c5ce7, #a855f7)' : d.active ? 'rgba(124,92,231,.25)' : 'rgba(255,255,255,.04)',
                        border: `1.5px solid ${d.today ? '#a855f7' : d.active ? 'rgba(124,92,231,.4)' : 'rgba(255,255,255,.07)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
                        boxShadow: d.today ? '0 0 14px rgba(124,92,231,.5)' : 'none',
                        opacity: d.future ? .3 : 1, transition: 'all .2s',
                      }}>{d.active ? '✓' : ''}</div>
                      <span style={{ fontSize: 15, fontWeight: 700, color: d.today ? '#a855f7' : '#4b4570' }}>{d.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: 10, padding: '10px 14px',
                  background: streak >= 3 ? 'rgba(168,85,247,.06)' : 'rgba(251,191,36,.06)',
                  border: `1px solid ${streak >= 3 ? 'rgba(168,85,247,.2)' : 'rgba(251,191,36,.2)'}`,
                  borderRadius: 12, fontSize: 17, color: streak >= 3 ? '#b09ee0' : '#92400e',
                }}>
                  {streak === 0 && '💡 Check in today to start your streak!'}
                  {streak === 1 && '🌱 Day 1 — keep going tomorrow!'}
                  {streak === 2 && '⚡ 2 days in a row! One more for the 🔥 badge!'}
                  {streak >= 3  && streak < 7  && `🔥 ${streak} days strong! ${7  - streak} more for ⚡ Electric badge!`}
                  {streak >= 7  && streak < 30 && `⚡ ${streak}-day streak! ${30 - streak} more days to Moonwalker!`}
                  {streak >= 30 && '🌙 Legendary! 30-day streak achieved!'}
                </div>
              </div>
            </Section>
          </div>

          {regions.length > 0 && (
            <div className="rewards-progress-regions">
              <Section label={`Regions explored · ${regions.length} / ${Object.keys(REGION_META).length}`}>
                <div className="rewards-section-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {regions.map(r => {
                    const m   = REGION_META[r] || REGION_META.global
                    const cnt = byRegion[r]?.length || 0
                    const pct = badgeStats.totalSongs ? Math.round((cnt / badgeStats.totalSongs) * 100) : 0
                    return (
                      <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 17, fontWeight: 600, color: '#c4b5f0', width: 110, flexShrink: 0 }}>{m.emoji} {m.label}</span>
                        <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,.07)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: 4, boxShadow: `0 0 6px ${m.color}88`, transition: 'width .8s ease' }} />
                        </div>
                        <span style={{ fontSize: 17, color: '#6b5f8a', fontWeight: 700, width: 24, textAlign: 'right' }}>{cnt}</span>
                      </div>
                    )
                  })}
                </div>
              </Section>
            </div>
          )}

          <div className="rewards-progress-stats">
            <Section label="Stats">
              <div className="rewards-stats-grid">
                {[
                  { label: 'Total XP',   value: xp,         icon: '⚡', color: '#a855f7' },
                  { label: 'Songs made', value: badgeStats.totalSongs, icon: '🎵', color: '#34d399' },
                  { label: 'Day streak', value: streak,     icon: '🔥', color: '#f59e0b' },
                  { label: 'Badges',     value: `${earnedBadges}/${BADGES.length}`, icon: '🏅', color: '#60a5fa' },
                ].map(stat => (
                  <div key={stat.label} className="rewards-stat-card">
                    <p className="rewards-stat-label">{stat.icon} {stat.label}</p>
                    <p className="rewards-stat-value" style={{ color: stat.color, textShadow: `0 0 16px ${stat.color}66` }}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}

      {/* ══════════ BADGES TAB ══════════ */}
      {activeTab === 'badges' && (
        <div className="rewards-badges-grid">
          <p style={{ margin: '0 0 8px', fontSize: 17, color: '#6b5f8a' }}>
            Tap a badge to see details · {earnedBadges} earned
          </p>
          {BADGES.map(badge => (
            <BadgeCard
              key={badge.id} badge={badge}
              badgeStats={badgeStats}
              onTap={(b, earned) => setTooltip({ badge: b, earned })}
            />
          ))}
        </div>
      )}

      {/* ── Badge detail tooltip modal ── */}
      {tooltip && (
        <div
          onClick={() => setTooltip(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'linear-gradient(135deg, #1a1040, #2d1b69)', border: `1.5px solid ${tooltip.earned ? 'rgba(168,85,247,.5)' : 'rgba(255,255,255,.1)'}`, borderRadius: 24, padding: '28px 24px', maxWidth: 320, width: '100%', boxShadow: tooltip.earned ? '0 0 40px rgba(168,85,247,.3)' : '0 20px 60px rgba(0,0,0,.5)', textAlign: 'center', animation: 'modalPop .25s ease' }}
          >
            <div style={{ fontSize: 57, marginBottom: 12, filter: tooltip.earned ? 'none' : 'grayscale(1) brightness(.5)', animation: tooltip.earned ? 'badgeBounce .5s ease' : 'none' }}>
              {tooltip.badge.emoji}
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 25, fontWeight: 800, color: tooltip.earned ? '#e0d8ff' : '#6b5f8a', fontFamily: "'Syne', sans-serif" }}>
              {tooltip.badge.label}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 19, color: '#8b7eb8', lineHeight: 1.6 }}>
              {tooltip.earned ? tooltip.badge.why : tooltip.badge.how}
            </p>
            {tooltip.earned
              ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(168,85,247,.15)', border: '1px solid rgba(168,85,247,.4)', borderRadius: 20, padding: '8px 18px', fontSize: 18, fontWeight: 700, color: '#a855f7', marginBottom: 16 }}>✨ Badge earned!</div>
              : <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '12px 16px', fontSize: 18, color: '#6b5f8a', marginBottom: 16 }}>🔒 Keep going — you've got this!</div>
            }
            <button onClick={() => setTooltip(null)} style={{ display: 'block', width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '10px', color: '#8b7eb8', fontSize: 18, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Badge earned popup — fires automatically ── */}
      {currentBadge && (
        <BadgeEarnedPopup
          key={currentBadge.id}
          badge={currentBadge}
          onClose={() => setCurrentBadge(null)}
        />
      )}

      <style>{CSS}</style>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#6b5f8a', textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: "'Syne', sans-serif" }}>
        {label}
      </p>
      {children}
    </div>
  )
}

const CSS = `
  @keyframes rankFloat     { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes particleBurst { 0% { transform: scale(1) translate(0,0); opacity: 1; } 100% { transform: scale(0) translate(var(--tx,20px), var(--ty,-30px)); opacity: 0; } }
  @keyframes modalPop      { from { transform: scale(.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes badgeBounce   { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 70% { transform: scale(.95); } 100% { transform: scale(1); } }
  @keyframes badgeGlow     { 0%, 100% { box-shadow: 0 0 32px rgba(168,85,247,0.5), inset 0 0 20px rgba(168,85,247,0.1); } 50% { box-shadow: 0 0 48px rgba(168,85,247,0.75), inset 0 0 28px rgba(168,85,247,0.2); } }
  @keyframes badgeShimmer  { 0% { transform: translateX(-100%); } 60%, 100% { transform: translateX(100%); } }
  @keyframes confettiFall  { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(180px) rotate(540deg); opacity: 0; } }
  @media (max-width: 480px) {
    .rh-daily-challenge { flex-wrap: wrap !important; gap: 10px !important; padding: 14px !important; }
  }
`