import { useState, useEffect } from 'react'

// ── Data ──────────────────────────────────────────────────────────────────────

const RANKS = [
  { id: 'listener',   label: 'Listener',    min: 0,   max: 49,  color: '#9ca3af', glow: '#9ca3af44', icon: '🎧' },
  { id: 'vibe',       label: 'Vibe Seeker', min: 50,  max: 149, color: '#34d399', glow: '#34d39944', icon: '🌊' },
  { id: 'composer',   label: 'Composer',    min: 150, max: 299, color: '#60a5fa', glow: '#60a5fa44', icon: '🎹' },
  { id: 'artist',     label: 'Artist',      min: 300, max: 599, color: '#f59e0b', glow: '#f59e0b44', icon: '🎨' },
  { id: 'maestro',    label: 'Maestro',     min: 600, max: 999, color: '#f472b6', glow: '#f472b644', icon: '🏆' },
  { id: 'legend',     label: 'Legend',      min: 1000,max: Infinity, color: '#a855f7', glow: '#a855f744', icon: '⭐' },
]

const BADGES = [
  { id: 'first_mood',    emoji: '🌱', label: 'First Note',     desc: 'Share your first mood',           how: 'Share any mood',                 xpNeeded: 0,   songsNeeded: 0, streakNeeded: 0,  songs: 1,   special: false },
  { id: 'first_song',    emoji: '🎵', label: 'Born to Create', desc: 'Generated your first track',      how: 'Generate a song',                xpNeeded: 0,   songsNeeded: 1, streakNeeded: 0,  songs: 0,   special: false },
  { id: 'multilingual',  emoji: '🌍', label: 'Polyglot',       desc: 'Made songs in 3 languages',       how: 'Try 3 different language regions', xpNeeded: 0,  songsNeeded: 3, streakNeeded: 0,  songs: 3,   special: false },
  { id: 'streak_3',      emoji: '🔥', label: 'On Fire',        desc: '3-day check-in streak',           how: 'Check in 3 days in a row',        xpNeeded: 0,  songsNeeded: 0, streakNeeded: 3,  songs: 0,   special: false },
  { id: 'streak_7',      emoji: '⚡', label: 'Electric',       desc: '7-day streak — unstoppable',      how: 'Check in 7 days in a row',        xpNeeded: 0,  songsNeeded: 0, streakNeeded: 7,  songs: 0,   special: false },
  { id: 'composer_5',    emoji: '🎼', label: 'Prolific',       desc: 'Created 5 tracks',                how: 'Generate 5 songs total',          xpNeeded: 0,  songsNeeded: 5, streakNeeded: 0,  songs: 5,   special: false },
  { id: 'xp_300',        emoji: '💎', label: 'Diamond Mind',   desc: 'Reached 300 XP',                  how: 'Earn 300 XP',                    xpNeeded: 300, songsNeeded: 0, streakNeeded: 0, songs: 0,   special: false },
  { id: 'night_owl',     emoji: '🦉', label: 'Night Owl',      desc: 'Created a song after midnight',   how: 'Generate a song after midnight',  xpNeeded: 0,  songsNeeded: 0, streakNeeded: 0,  songs: 0,   special: true  },
  { id: 'streak_30',     emoji: '🌙', label: 'Moonwalker',     desc: '30-day streak — legendary',       how: 'Check in 30 days in a row',       xpNeeded: 0, songsNeeded: 0, streakNeeded: 30, songs: 0,   special: false },
  { id: 'xp_1000',       emoji: '⭐', label: 'Legend',         desc: 'Hit 1000 XP — you are the music', how: 'Earn 1000 XP',                   xpNeeded: 1000,songsNeeded: 0, streakNeeded: 0, songs: 0,   special: false },
]

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    icon: '🎧',
    color: '#9ca3af',
    glow: '#9ca3af22',
    border: '#9ca3af44',
    unlockLabel: 'Always free',
    unlockCondition: () => true,
    features: [
      '5 songs per day',
      'All 7 cultural regions',
      'Mood detection (voice + text)',
      'Basic artist styles',
      'Song history (last 20)',
    ],
    locked: [],
  },
  {
    id: 'groove',
    name: 'Groove',
    icon: '🌊',
    color: '#34d399',
    glow: '#34d39918',
    border: '#34d39966',
    unlockLabel: 'Unlock: 7-day streak OR 100 XP',
    unlockCondition: (xp, streak) => xp >= 100 || streak >= 7,
    features: [
      'Unlimited songs per day',
      'All artist styles unlocked',
      'Priority generation queue',
      'Full song history',
      'Mood analytics dashboard',
    ],
    locked: ['Requires 7-day streak or 100 XP'],
  },
  {
    id: 'studio',
    name: 'Studio',
    icon: '🎨',
    color: '#f59e0b',
    glow: '#f59e0b18',
    border: '#f59e0b66',
    unlockLabel: 'Unlock: 30-day streak OR 500 XP',
    unlockCondition: (xp, streak) => xp >= 500 || streak >= 30,
    features: [
      'Everything in Groove',
      'Download songs as MP3',
      'Custom lyric editing',
      'Co-write with AI',
      'Exclusive Maestro artists',
      'Monthly featured on Ekko',
    ],
    locked: ['Requires 30-day streak or 500 XP'],
  },
]

const DAILY_CHALLENGES = [
  { id: 'dc1', emoji: '🌅', label: 'Morning Mood',   desc: 'Share a mood before noon',     xp: 15 },
  { id: 'dc2', emoji: '🎭', label: 'Emotion Flip',   desc: 'Try a new region today',       xp: 20 },
  { id: 'dc3', emoji: '🌙', label: 'Night Session',  desc: 'Create a song after 9 PM',     xp: 25 },
  { id: 'dc4', emoji: '🎲', label: 'Random Vibes',   desc: 'Use the quiz mood input',      xp: 15 },
  { id: 'dc5', emoji: '🔁', label: 'Double Down',    desc: 'Generate 2 songs today',       xp: 30 },
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

function getRank(xp) {
  return RANKS.find(r => xp >= r.min && xp <= r.max) || RANKS[0]
}

function getNextRank(xp) {
  const idx = RANKS.findIndex(r => xp >= r.min && xp <= r.max)
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null
}

function isBadgeEarned(badge, xp, streak, totalSongs) {
  if (badge.special) return false // special badges shown as locked always for now
  if (badge.xpNeeded > 0 && xp < badge.xpNeeded) return false
  if (badge.streakNeeded > 0 && streak < badge.streakNeeded) return false
  if (badge.songsNeeded > 0 && totalSongs < badge.songsNeeded) return false
  return true
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

function BadgeCard({ badge, xp, streak, totalSongs, onTap }) {
  const earned = isBadgeEarned(badge, xp, streak, totalSongs)
  const [burst, setBurst] = useState(false)

  const handleTap = () => {
    if (earned) setBurst(true)
    onTap(badge, earned)
    setTimeout(() => setBurst(false), 700)
  }

  return (
    <div
      onClick={handleTap}
      style={{
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        background: earned ? 'rgba(168,85,247,.08)' : 'rgba(255,255,255,.03)',
        border: `1.5px solid ${earned ? 'rgba(168,85,247,.35)' : 'rgba(255,255,255,.07)'}`,
        borderRadius: 16, cursor: 'pointer',
        transition: 'all .2s',
        transform: burst ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {burst && (
        <>
          {[...Array(6)].map((_, i) => (
            <Particle key={i}
              x={`${20 + i * 10}%`} y={`${30 + (i % 2) * 40}%`}
              color={['#a855f7','#f59e0b','#34d399','#60a5fa','#f472b6','#fff'][i]}
            />
          ))}
        </>
      )}

      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        background: earned ? 'rgba(168,85,247,.15)' : 'rgba(255,255,255,.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
        filter: earned ? 'none' : 'grayscale(1) brightness(.4)',
        boxShadow: earned ? '0 0 12px rgba(168,85,247,.3)' : 'none',
        transition: 'all .3s',
      }}>
        {badge.emoji}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: '0 0 2px', fontSize: 14, fontWeight: 700,
          color: earned ? '#e0d8ff' : '#4b4570',
          fontFamily: "'Syne', sans-serif",
        }}>{badge.label}</p>
        <p style={{ margin: 0, fontSize: 12, color: earned ? '#8b7eb8' : '#3a3455', lineHeight: 1.4 }}>
          {earned ? badge.desc : badge.how}
        </p>
      </div>

      {/* Status */}
      {earned ? (
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: '#a855f7', boxShadow: '0 0 8px rgba(168,85,247,.8)',
        }} />
      ) : (
        <div style={{ fontSize: 14, opacity: .35 }}>🔒</div>
      )}
    </div>
  )
}

function PlanCard({ plan, xp, streak, activePlan, onSelect }) {
  const unlocked = plan.unlockCondition(xp, streak)
  const isActive = activePlan === plan.id

  return (
    <div
      onClick={() => unlocked && onSelect(plan.id)}
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${plan.glow}, rgba(255,255,255,.04))`
          : unlocked ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.2)',
        border: `1.5px solid ${isActive ? plan.color : unlocked ? plan.border : 'rgba(255,255,255,.06)'}`,
        borderRadius: 20, padding: '18px 16px',
        cursor: unlocked ? 'pointer' : 'default',
        transition: 'all .25s',
        position: 'relative', overflow: 'hidden',
        boxShadow: isActive ? `0 0 24px ${plan.glow}` : 'none',
        filter: unlocked ? 'none' : 'brightness(.6)',
      }}
    >
      {isActive && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          fontSize: 10, fontWeight: 800, color: plan.color,
          background: `${plan.glow}`,
          padding: '3px 8px', borderRadius: 20,
          border: `1px solid ${plan.border}`,
          fontFamily: "'Syne', sans-serif",
          letterSpacing: '.08em',
        }}>ACTIVE</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 26 }}>{plan.icon}</span>
        <div>
          <p style={{
            margin: 0, fontSize: 17, fontWeight: 800,
            color: unlocked ? plan.color : '#4b4570',
            fontFamily: "'Syne', sans-serif",
          }}>{plan.name}</p>
          <p style={{ margin: 0, fontSize: 10, color: '#6b5f8a', fontWeight: 600 }}>
            {plan.unlockLabel}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: unlocked ? plan.color : '#3a3455' }}>✓</span>
            <span style={{ fontSize: 12, color: unlocked ? '#c4b5f0' : '#3a3455' }}>{f}</span>
          </div>
        ))}
      </div>

      {!unlocked && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: 'rgba(255,255,255,.04)', borderRadius: 10,
          fontSize: 11, color: '#6b5f8a', textAlign: 'center',
        }}>
          🔒 {plan.locked[0]}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RewardsScreen({ xp = 0, userId = '' }) {
  const [byRegion, setByRegion]     = useState({})
  const [totalSongs, setTotalSongs] = useState(0)
  const [moodLogs, setMoodLogs]     = useState([])
  const [activeTab, setActiveTab]   = useState('progress')   // progress | badges | plans
  const [activePlan, setActivePlan] = useState('free')
  const [tooltip, setTooltip]       = useState(null)         // { badge, earned }
  const [mounted, setMounted]       = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  useEffect(() => {
    if (!userId) return
    fetch(`${import.meta.env.VITE_API_URL}/music/history/${userId}`)
      .then(r => r.json())
      .then(data => {
        setByRegion(data.by_region || {})
        setTotalSongs((data.songs || []).length)
      })
      .catch(() => {})

    fetch(`${import.meta.env.VITE_API_URL}/mood/history/${userId}`)
      .then(r => r.json())
      .then(data => setMoodLogs(data.logs || []))
      .catch(() => {})
  }, [userId])

  // ── Streak & calendar ─────────────────────────────────────────────────
  const logDates = new Set(moodLogs.map(l => new Date(l.created_at).toDateString()))
  const today    = new Date()
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1

  const days = WEEK_DAYS.map((label, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (todayIdx - i))
    return { label, active: logDates.has(d.toDateString()), today: i === todayIdx, future: i > todayIdx }
  })

  let streak = 0
  for (let i = 0; i < 60; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (logDates.has(d.toDateString())) streak++
    else break
  }

  // ── Rank & XP ────────────────────────────────────────────────────────
  const rank     = getRank(xp)
  const nextRank = getNextRank(xp)
  const rankPct  = nextRank
    ? Math.min(100, Math.round(((xp - rank.min) / (nextRank.min - rank.min)) * 100))
    : 100

  // ── Daily challenge (deterministic from date) ─────────────────────────
  const dayOfYear  = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  const dailyChall = DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length]

  // ── Unlocked plan ────────────────────────────────────────────────────
  useEffect(() => {
    if (xp >= 500 || streak >= 30) setActivePlan('studio')
    else if (xp >= 100 || streak >= 7) setActivePlan('groove')
    else setActivePlan('free')
  }, [xp, streak])

  const earnedBadges = BADGES.filter(b => isBadgeEarned(b, xp, streak, totalSongs)).length
  const regions      = Object.keys(byRegion)

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      maxWidth: 440, margin: '0 auto', paddingBottom: 48,
      opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)',
      transition: 'all .4s ease',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative' }}>
        {/* Rank orb */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${rank.color}cc, ${rank.color}44)`,
          boxShadow: `0 0 32px ${rank.glow}, 0 0 64px ${rank.glow}`,
          margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
          animation: 'rankFloat 3s ease-in-out infinite',
        }}>
          {rank.icon}
        </div>
        <p style={{
          margin: '0 0 2px', fontSize: 22, fontWeight: 800,
          color: rank.color, fontFamily: "'Syne', sans-serif",
          textShadow: `0 0 20px ${rank.glow}`,
        }}>{rank.label}</p>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: '#8b7eb8' }}>
          {xp} XP · {streak} day streak 🔥 · {earnedBadges}/{BADGES.length} badges
        </p>
        {nextRank && (
          <p style={{ margin: 0, fontSize: 11, color: '#6b5f8a' }}>
            {nextRank.min - xp} XP until <span style={{ color: nextRank.color, fontWeight: 700 }}>{nextRank.label}</span> {nextRank.icon}
          </p>
        )}
      </div>

      {/* ── Rank XP bar ── */}
      <div style={{
        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 16, padding: '14px 16px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#6b5f8a', fontWeight: 700 }}>RANK PROGRESS</span>
          <span style={{ fontSize: 11, color: rank.color, fontWeight: 700 }}>{rankPct}%</span>
        </div>
        <div style={{
          height: 10, background: 'rgba(255,255,255,.07)',
          borderRadius: 5, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${rankPct}%`,
            background: `linear-gradient(90deg, ${rank.color}88, ${rank.color})`,
            borderRadius: 5,
            boxShadow: `0 0 10px ${rank.color}`,
            transition: 'width 1s ease',
            animation: 'shimmer 2s linear infinite',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 10, color: '#6b5f8a' }}>{rank.label}</span>
          {nextRank && <span style={{ fontSize: 10, color: nextRank.color }}>{nextRank.label}</span>}
        </div>
      </div>

      {/* ── Daily Challenge ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,.08), rgba(245,158,11,.04))',
        border: '1.5px solid rgba(251,191,36,.25)',
        borderRadius: 18, padding: '16px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(251,191,36,.06)',
        }} />
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: 'rgba(251,191,36,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, border: '1px solid rgba(251,191,36,.3)',
        }}>
          {dailyChall.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, color: '#fbbf24',
              fontFamily: "'Syne', sans-serif", letterSpacing: '.08em',
            }}>DAILY CHALLENGE</span>
          </div>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#fde68a' }}>
            {dailyChall.label}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>{dailyChall.desc}</p>
        </div>
        <div style={{
          background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)',
          borderRadius: 10, padding: '6px 12px', flexShrink: 0,
          fontSize: 13, fontWeight: 800, color: '#fbbf24',
          fontFamily: "'Syne', sans-serif",
        }}>+{dailyChall.xp} XP</div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 20,
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 14, padding: 4,
      }}>
        {[
          { id: 'progress', label: '📈 Progress' },
          { id: 'badges',   label: `🏅 Badges (${earnedBadges})` },
          { id: 'plans',    label: '✨ Plans' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '9px 8px',
            background: activeTab === tab.id
              ? 'linear-gradient(135deg, rgba(124,92,231,.4), rgba(168,85,247,.3))'
              : 'transparent',
            border: activeTab === tab.id ? '1px solid rgba(168,85,247,.4)' : '1px solid transparent',
            borderRadius: 10, color: activeTab === tab.id ? '#e0d8ff' : '#6b5f8a',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ PROGRESS TAB ══════════════════ */}
      {activeTab === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Streak Calendar */}
          <Section label={`This week · ${streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet'}`}>
            <div style={{ display: 'flex', gap: 6 }}>
              {days.map((d, i) => (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6,
                }}>
                  <div style={{
                    width: '100%', aspectRatio: '1',
                    borderRadius: 10,
                    background: d.today
                      ? 'linear-gradient(135deg, #7c5ce7, #a855f7)'
                      : d.active
                        ? 'rgba(124,92,231,.25)'
                        : 'rgba(255,255,255,.04)',
                    border: `1.5px solid ${d.today ? '#a855f7' : d.active ? 'rgba(124,92,231,.4)' : 'rgba(255,255,255,.07)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                    boxShadow: d.today ? '0 0 14px rgba(124,92,231,.5)' : 'none',
                    opacity: d.future ? .3 : 1,
                    transition: 'all .2s',
                  }}>
                    {d.active || d.today ? '✓' : ''}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: d.today ? '#a855f7' : '#4b4570',
                  }}>{d.label}</span>
                </div>
              ))}
            </div>

            {/* Streak tip */}
            <div style={{
              marginTop: 10, padding: '10px 14px',
              background: streak >= 3 ? 'rgba(168,85,247,.06)' : 'rgba(251,191,36,.06)',
              border: `1px solid ${streak >= 3 ? 'rgba(168,85,247,.2)' : 'rgba(251,191,36,.2)'}`,
              borderRadius: 12, fontSize: 12,
              color: streak >= 3 ? '#b09ee0' : '#92400e',
            }}>
              {streak === 0 && '💡 Check in today to start your streak!'}
              {streak === 1 && '🌱 Day 1 — keep going tomorrow to build your streak!'}
              {streak === 2 && '⚡ 2 days in a row! One more for the 🔥 badge!'}
              {streak >= 3 && streak < 7 && `🔥 ${streak} days strong! ${7 - streak} more days for the ⚡ Electric badge!`}
              {streak >= 7 && streak < 30 && `⚡ Incredible ${streak}-day streak! Groove plan unlocked. ${30 - streak} days for Studio!`}
              {streak >= 30 && '🌙 Legendary! 30-day streak — Studio plan is yours!'}
            </div>
          </Section>

          {/* Region Stats */}
          {regions.length > 0 && (
            <Section label={`Regions explored · ${regions.length} / ${Object.keys(REGION_META).length}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {regions.map(r => {
                  const m   = REGION_META[r] || REGION_META.global
                  const cnt = byRegion[r]?.length || 0
                  const pct = totalSongs ? Math.round((cnt / totalSongs) * 100) : 0
                  return (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#c4b5f0', width: 110, flexShrink: 0 }}>
                        {m.emoji} {m.label}
                      </span>
                      <div style={{
                        flex: 1, height: 7,
                        background: 'rgba(255,255,255,.07)', borderRadius: 4, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: m.color, borderRadius: 4,
                          boxShadow: `0 0 6px ${m.color}88`,
                          transition: 'width .8s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#6b5f8a', fontWeight: 700, width: 24, textAlign: 'right' }}>
                        {cnt}
                      </span>
                    </div>
                  )
                })}
              </div>
              {regions.length < Object.keys(REGION_META).length && (
                <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b5f8a' }}>
                  🗺️ {Object.keys(REGION_META).length - regions.length} more region{Object.keys(REGION_META).length - regions.length !== 1 ? 's' : ''} to explore
                </p>
              )}
            </Section>
          )}

          {/* Stats grid */}
          <Section label="Stats">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Total XP',     value: xp,          icon: '⚡', color: '#a855f7' },
                { label: 'Songs made',   value: totalSongs,  icon: '🎵', color: '#34d399' },
                { label: 'Day streak',   value: streak,      icon: '🔥', color: '#f59e0b' },
                { label: 'Badges',       value: `${earnedBadges}/${BADGES.length}`, icon: '🏅', color: '#60a5fa' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 14, padding: '14px 16px',
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: '#6b5f8a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {stat.icon} {stat.label}
                  </p>
                  <p style={{
                    margin: 0, fontSize: 28, fontWeight: 800,
                    color: stat.color, fontFamily: "'Syne', sans-serif",
                    textShadow: `0 0 16px ${stat.color}66`,
                  }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ══════════════════ BADGES TAB ══════════════════ */}
      {activeTab === 'badges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b5f8a' }}>
            Tap a badge to see details · {earnedBadges} earned
          </p>
          {BADGES.map(badge => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              xp={xp}
              streak={streak}
              totalSongs={totalSongs}
              onTap={(b, earned) => setTooltip({ badge: b, earned })}
            />
          ))}
        </div>
      )}

      {/* ══════════════════ PLANS TAB ══════════════════ */}
      {activeTab === 'plans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b5f8a' }}>
            Unlock premium plans by earning XP or keeping a streak — no payment needed.
          </p>
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              xp={xp}
              streak={streak}
              activePlan={activePlan}
              onSelect={setActivePlan}
            />
          ))}

          {/* Progress toward next plan */}
          {activePlan !== 'studio' && (
            <div style={{
              marginTop: 8, padding: '14px 16px',
              background: 'rgba(52,211,153,.06)', border: '1px solid rgba(52,211,153,.2)',
              borderRadius: 14,
            }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#34d399' }}>
                🎯 How to unlock {activePlan === 'free' ? 'Groove' : 'Studio'}
              </p>
              {activePlan === 'free' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ProgressMini label="XP" current={xp} target={100} color="#a855f7" />
                  <ProgressMini label="Streak" current={streak} target={7} color="#f59e0b" suffix=" days" />
                  <p style={{ margin: 0, fontSize: 11, color: '#6b5f8a' }}>Reach either goal to unlock Groove</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ProgressMini label="XP" current={xp} target={500} color="#a855f7" />
                  <ProgressMini label="Streak" current={streak} target={30} color="#f59e0b" suffix=" days" />
                  <p style={{ margin: 0, fontSize: 11, color: '#6b5f8a' }}>Reach either goal to unlock Studio</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Badge tooltip modal ── */}
      {tooltip && (
        <div
          onClick={() => setTooltip(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #1a1040, #2d1b69)',
              border: `1.5px solid ${tooltip.earned ? 'rgba(168,85,247,.5)' : 'rgba(255,255,255,.1)'}`,
              borderRadius: 24, padding: '28px 24px',
              maxWidth: 320, width: '100%',
              boxShadow: tooltip.earned ? '0 0 40px rgba(168,85,247,.3)' : '0 20px 60px rgba(0,0,0,.5)',
              textAlign: 'center',
              animation: 'modalPop .25s ease',
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 12,
              filter: tooltip.earned ? 'none' : 'grayscale(1) brightness(.5)',
              animation: tooltip.earned ? 'badgeBounce .5s ease' : 'none',
            }}>
              {tooltip.badge.emoji}
            </div>
            <p style={{
              margin: '0 0 6px', fontSize: 20, fontWeight: 800,
              color: tooltip.earned ? '#e0d8ff' : '#6b5f8a',
              fontFamily: "'Syne', sans-serif",
            }}>{tooltip.badge.label}</p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#8b7eb8', lineHeight: 1.6 }}>
              {tooltip.earned ? tooltip.badge.desc : tooltip.badge.how}
            </p>
            {tooltip.earned ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(168,85,247,.15)', border: '1px solid rgba(168,85,247,.4)',
                borderRadius: 20, padding: '8px 18px',
                fontSize: 13, fontWeight: 700, color: '#a855f7',
              }}>
                ✨ Badge earned!
              </div>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '12px 16px',
                fontSize: 13, color: '#6b5f8a',
              }}>
                🔒 Keep going — you've got this!
              </div>
            )}
            <button
              onClick={() => setTooltip(null)}
              style={{
                display: 'block', width: '100%', marginTop: 16,
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 12, padding: '10px', color: '#8b7eb8',
                fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              }}
            >Close</button>
          </div>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Section({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{
        margin: 0, fontSize: 11, fontWeight: 700, color: '#6b5f8a',
        textTransform: 'uppercase', letterSpacing: '.07em',
        fontFamily: "'Syne', sans-serif",
      }}>{label}</p>
      {children}
    </div>
  )
}

function ProgressMini({ label, current, target, color, suffix = '' }) {
  const pct = Math.min(100, Math.round((current / target) * 100))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#8b7eb8' }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>
          {current}{suffix} / {target}{suffix}
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 3, boxShadow: `0 0 6px ${color}`,
          transition: 'width .8s ease',
        }} />
      </div>
    </div>
  )
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes rankFloat {
    0%, 100% { transform: translateY(0);    }
    50%       { transform: translateY(-6px); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes particleBurst {
    0%   { transform: scale(1) translate(0,0);       opacity: 1; }
    100% { transform: scale(0) translate(var(--tx, 20px), var(--ty, -30px)); opacity: 0; }
  }
  @keyframes modalPop {
    from { transform: scale(.9); opacity: 0; }
    to   { transform: scale(1);  opacity: 1; }
  }
  @keyframes badgeBounce {
    0%   { transform: scale(1);    }
    40%  { transform: scale(1.25); }
    70%  { transform: scale(.95);  }
    100% { transform: scale(1);    }
  }
`