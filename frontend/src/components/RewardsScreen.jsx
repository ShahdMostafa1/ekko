import { useState, useEffect, useRef } from 'react'

// ── Data ──────────────────────────────────────────────────────────────────────
const RANKS = [
  { id: 'listener',  label: 'Listener',    min: 0,    max: 49,       color: '#9ca3af', glow: '#9ca3af44', icon: '🎧' },
  { id: 'vibe',      label: 'Vibe Seeker', min: 50,   max: 149,      color: '#34d399', glow: '#34d39944', icon: '🌊' },
  { id: 'composer',  label: 'Composer',    min: 150,  max: 299,      color: '#60a5fa', glow: '#60a5fa44', icon: '🎹' },
  { id: 'artist',    label: 'Artist',      min: 300,  max: 599,      color: '#f59e0b', glow: '#f59e0b44', icon: '🎨' },
  { id: 'maestro',   label: 'Maestro',     min: 600,  max: 999,      color: '#f472b6', glow: '#f472b644', icon: '🏆' },
  { id: 'legend',    label: 'Legend',      min: 1000, max: Infinity, color: '#a855f7', glow: '#a855f744', icon: '⭐' },
]

const BADGES = [
  { id: 'first_mood',   emoji: '🌱', label: 'First Note',     desc: 'Share your first mood',            how: 'Share any mood',                  why: 'You shared your very first mood — the journey begins!',      xpNeeded: 0,    songsNeeded: 0, streakNeeded: 0,  special: false },
  { id: 'first_song',   emoji: '🎵', label: 'Born to Create', desc: 'Generated your first track',       how: 'Generate a song',                 why: 'You generated your first AI song — a creator is born!',      xpNeeded: 0,    songsNeeded: 1, streakNeeded: 0,  special: false },
  { id: 'multilingual', emoji: '🌍', label: 'Polyglot',       desc: 'Made songs in 3 languages',        how: 'Try 3 different language regions', why: 'You explored 3 different cultural regions — truly global!',  xpNeeded: 0,    songsNeeded: 3, streakNeeded: 0,  special: false },
  { id: 'streak_3',     emoji: '🔥', label: 'On Fire',        desc: '3-day check-in streak',            how: 'Check in 3 days in a row',        why: 'You checked in 3 days in a row — you\'re on fire!',          xpNeeded: 0,    songsNeeded: 0, streakNeeded: 3,  special: false },
  { id: 'streak_7',     emoji: '⚡', label: 'Electric',       desc: '7-day streak — unstoppable',       how: 'Check in 7 days in a row',        why: 'A full week of check-ins — absolutely electric!',            xpNeeded: 0,    songsNeeded: 0, streakNeeded: 7,  special: false },
  { id: 'composer_5',   emoji: '🎼', label: 'Prolific',       desc: 'Created 5 tracks',                 how: 'Generate 5 songs total',          why: 'Five songs made — you\'re a prolific creator!',              xpNeeded: 0,    songsNeeded: 5, streakNeeded: 0,  special: false },
  { id: 'xp_300',       emoji: '💎', label: 'Diamond Mind',   desc: 'Reached 300 XP',                   how: 'Earn 300 XP',                     why: 'You hit 300 XP — a Diamond Mind has been forged!',           xpNeeded: 300,  songsNeeded: 0, streakNeeded: 0,  special: false },
  { id: 'night_owl',    emoji: '🦉', label: 'Night Owl',      desc: 'Created a song after midnight',    how: 'Generate a song after midnight',  why: 'A midnight creation — only Night Owls dare this!',           xpNeeded: 0,    songsNeeded: 0, streakNeeded: 0,  special: true  },
  { id: 'streak_30',    emoji: '🌙', label: 'Moonwalker',     desc: '30-day streak — legendary',        how: 'Check in 30 days in a row',       why: '30 days straight — you\'re a true Moonwalker!',             xpNeeded: 0,    songsNeeded: 0, streakNeeded: 30, special: false },
  { id: 'xp_1000',      emoji: '⭐', label: 'Legend',         desc: 'Hit 1000 XP — you are the music', how: 'Earn 1000 XP',                    why: '1000 XP reached — you ARE the music. Legend status!',        xpNeeded: 1000, songsNeeded: 0, streakNeeded: 0,  special: false },
]

const DAILY_CHALLENGES = [
  { id: 'dc1', emoji: '🌅', label: 'Morning Mood',  desc: 'Share a mood before noon',  xp: 15 },
  { id: 'dc2', emoji: '🎭', label: 'Emotion Flip',  desc: 'Try a new region today',    xp: 20 },
  { id: 'dc3', emoji: '🌙', label: 'Night Session', desc: 'Create a song after 9 PM',  xp: 25 },
  { id: 'dc4', emoji: '🎲', label: 'Random Vibes',  desc: 'Use the quiz mood input',   xp: 15 },
  { id: 'dc5', emoji: '🔁', label: 'Double Down',   desc: 'Generate 2 songs today',    xp: 30 },
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
function isBadgeEarned(badge, xp, streak, totalSongs) {
  if (badge.special)                                              return false
  if (badge.xpNeeded     > 0 && xp        < badge.xpNeeded)     return false
  if (badge.streakNeeded > 0 && streak     < badge.streakNeeded) return false
  if (badge.songsNeeded  > 0 && totalSongs < badge.songsNeeded)  return false
  return true
}

// ── Badge Earned Popup ────────────────────────────────────────────────────────
function BadgeEarnedPopup({ badge, onClose }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 30)
    // Auto-dismiss after 5s
    const t2 = setTimeout(() => handleClose(), 5000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const handleClose = () => {
    setLeaving(true)
    setTimeout(onClose, 400)
  }

  return (
    <div
      style={{
        position:   'fixed',
        top:        '50%',
        left:       '50%',
        transform:  'translate(-50%, -50%)',
        zIndex:     2000,
        width:      '100%',
        maxWidth:   340,
        padding:    '0 20px',
        pointerEvents: 'none',
      }}
    >
      {/* Backdrop blur */}
      <div
        onClick={handleClose}
        style={{
          position:       'fixed',
          inset:          0,
          background:     leaving ? 'rgba(0,0,0,0)' : visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
          backdropFilter: visible && !leaving ? 'blur(4px)' : 'blur(0px)',
          transition:     'background .35s ease, backdrop-filter .35s ease',
          pointerEvents:  'all',
          zIndex:         -1,
        }}
      />

      {/* Card */}
      <div
        style={{
          pointerEvents:  'all',
          background:     'linear-gradient(145deg, #1a0f3a 0%, #2a1560 50%, #1a0f3a 100%)',
          border:         '1.5px solid rgba(168,85,247,0.6)',
          borderRadius:   28,
          padding:        '32px 24px 24px',
          textAlign:      'center',
          boxShadow:      '0 0 60px rgba(168,85,247,0.35), 0 24px 64px rgba(0,0,0,0.7)',
          opacity:        visible && !leaving ? 1 : 0,
          transform:      visible && !leaving
            ? 'translateY(0) scale(1)'
            : leaving
            ? 'translateY(-20px) scale(0.95)'
            : 'translateY(30px) scale(0.92)',
          transition:     'opacity .4s cubic-bezier(.34,1.56,.64,1), transform .4s cubic-bezier(.34,1.56,.64,1)',
          position:       'relative',
          overflow:       'hidden',
        }}
      >
        {/* Shimmer overlay */}
        <div style={{
          position:   'absolute',
          inset:      0,
          background: 'linear-gradient(135deg, transparent 40%, rgba(168,85,247,0.08) 50%, transparent 60%)',
          animation:  'badgeShimmer 2.5s ease-in-out infinite',
          pointerEvents: 'none',
          borderRadius:  'inherit',
        }} />

        {/* Confetti particles */}
        {visible && !leaving && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 'inherit' }}>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{
                position:   'absolute',
                left:       `${8 + i * 7.5}%`,
                top:        '-8px',
                width:      `${4 + (i % 3) * 2}px`,
                height:     `${4 + (i % 3) * 2}px`,
                borderRadius: i % 2 === 0 ? '50%' : '2px',
                background: ['#a855f7','#f59e0b','#34d399','#60a5fa','#f472b6','#fbbf24',
                             '#a855f7','#34d399','#f59e0b','#60a5fa','#f472b6','#a855f7'][i],
                animation:  `confettiFall ${1.2 + (i % 4) * 0.3}s ease-in ${i * 0.08}s forwards`,
              }} />
            ))}
          </div>
        )}

        {/* NEW BADGE label */}
        <div style={{
          display:      'inline-block',
          background:   'linear-gradient(90deg, #a855f7, #7c3aed)',
          borderRadius: 99,
          padding:      '4px 14px',
          fontSize:     10,
          fontWeight:   800,
          color:        '#fff',
          letterSpacing: '.1em',
          marginBottom: 16,
          fontFamily:   "'Syne', sans-serif",
          boxShadow:    '0 4px 16px rgba(168,85,247,0.4)',
        }}>
          🏅 NEW BADGE UNLOCKED
        </div>

        {/* Emoji with glow ring */}
        <div style={{
          width:          88,
          height:         88,
          borderRadius:   '50%',
          background:     'radial-gradient(circle at 38% 35%, rgba(168,85,247,0.35), rgba(124,92,231,0.1))',
          border:         '2px solid rgba(168,85,247,0.5)',
          boxShadow:      '0 0 32px rgba(168,85,247,0.5), inset 0 0 20px rgba(168,85,247,0.1)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       44,
          margin:         '0 auto 16px',
          animation:      'badgeGlow 2s ease-in-out infinite',
        }}>
          {badge.emoji}
        </div>

        {/* Badge name */}
        <h2 style={{
          margin:      '0 0 8px',
          fontSize:    22,
          fontWeight:  800,
          color:       '#e0d8ff',
          fontFamily:  "'Syne', sans-serif",
          lineHeight:  1.2,
        }}>
          {badge.label}
        </h2>

        {/* Why earned */}
        <p style={{
          margin:     '0 0 20px',
          fontSize:   14,
          color:      '#a78bfa',
          lineHeight: 1.55,
          fontWeight: 500,
        }}>
          {badge.why}
        </p>

        {/* Dismiss */}
        <button
          onClick={handleClose}
          style={{
            width:        '100%',
            padding:      '12px',
            background:   'rgba(168,85,247,0.15)',
            border:       '1.5px solid rgba(168,85,247,0.35)',
            borderRadius: 14,
            color:        '#c4b5f0',
            fontSize:     14,
            fontWeight:   700,
            cursor:       'pointer',
            fontFamily:   "'DM Sans', sans-serif",
            transition:   'background .2s',
          }}
        >
          Awesome! 🎉
        </button>
      </div>
    </div>
  )
}

// ── Daily Challenge CTA Modal ─────────────────────────────────────────────────
function DailyChallengeModal({ challenge, onAccept, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

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
    setTimeout(onAccept, 350)
  }

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     visible && !leaving ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0)',
      backdropFilter: visible && !leaving ? 'blur(8px)' : 'blur(0px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         1500,
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
        {/* Decorative bg glow */}
        <div style={{
          position:     'absolute',
          top:          -40,
          right:        -40,
          width:        160,
          height:       160,
          borderRadius: '50%',
          background:   'radial-gradient(circle, rgba(251,191,36,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position:     'absolute',
          bottom:       -30,
          left:         -30,
          width:        120,
          height:       120,
          borderRadius: '50%',
          background:   'radial-gradient(circle, rgba(124,92,231,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Today's challenge pill */}
        <div style={{
          display:      'inline-block',
          background:   'rgba(251,191,36,0.12)',
          border:       '1px solid rgba(251,191,36,0.3)',
          borderRadius: 99,
          padding:      '5px 14px',
          fontSize:     10,
          fontWeight:   800,
          color:        '#fbbf24',
          letterSpacing: '.1em',
          marginBottom: 20,
          fontFamily:   "'Syne', sans-serif",
        }}>
          ✦ TODAY'S CHALLENGE
        </div>

        {/* Big emoji */}
        <div style={{
          width:          80,
          height:         80,
          borderRadius:   24,
          background:     'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.1))',
          border:         '1.5px solid rgba(251,191,36,0.35)',
          boxShadow:      '0 0 24px rgba(251,191,36,0.2)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       38,
          margin:         '0 auto 18px',
          animation:      'challengePulse 2.5s ease-in-out infinite',
        }}>
          {challenge.emoji}
        </div>

        {/* Challenge name */}
        <h2 style={{
          margin:     '0 0 8px',
          fontSize:   24,
          fontWeight: 800,
          color:      '#fde68a',
          fontFamily: "'Syne', sans-serif",
          lineHeight: 1.2,
        }}>
          {challenge.label}
        </h2>

        {/* Challenge description */}
        <p style={{
          margin:     '0 0 6px',
          fontSize:   15,
          color:      '#a78bfa',
          lineHeight: 1.5,
          fontWeight: 500,
        }}>
          {challenge.desc}
        </p>

        {/* XP reward */}
        <div style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          background:     'rgba(251,191,36,0.12)',
          border:         '1px solid rgba(251,191,36,0.25)',
          borderRadius:   12,
          padding:        '7px 16px',
          margin:         '14px 0 24px',
          fontSize:       16,
          fontWeight:     800,
          color:          '#fbbf24',
          fontFamily:     "'Syne', sans-serif",
        }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          +{challenge.xp} XP on completion
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleAccept}
            style={{
              width:        '100%',
              padding:      '14px',
              background:   'linear-gradient(135deg, #f59e0b, #fbbf24)',
              border:       'none',
              borderRadius: 16,
              color:        '#1a0f00',
              fontSize:     15,
              fontWeight:   800,
              cursor:       'pointer',
              fontFamily:   "'DM Sans', sans-serif",
              boxShadow:    '0 6px 24px rgba(251,191,36,0.35)',
              transition:   'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 28px rgba(251,191,36,0.45)' }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 6px 24px rgba(251,191,36,0.35)' }}
          >
            Let's do it! 🚀
          </button>
          <button
            onClick={handleDismiss}
            style={{
              width:        '100%',
              padding:      '12px',
              background:   'transparent',
              border:       '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              color:        '#4b4570',
              fontSize:     13,
              fontWeight:   600,
              cursor:       'pointer',
              fontFamily:   "'DM Sans', sans-serif",
              transition:   'color .2s, border-color .2s',
            }}
            onMouseEnter={e => { e.target.style.color = '#8b7eb8'; e.target.style.borderColor = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={e => { e.target.style.color = '#4b4570'; e.target.style.borderColor = 'rgba(255,255,255,0.08)' }}
          >
            Maybe later
          </button>
        </div>
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

function BadgeCard({ badge, xp, streak, totalSongs, onTap }) {
  const earned    = isBadgeEarned(badge, xp, streak, totalSongs)
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
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        filter: earned ? 'none' : 'grayscale(1) brightness(.4)',
        boxShadow: earned ? '0 0 12px rgba(168,85,247,.3)' : 'none', transition: 'all .3s',
      }}>{badge.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: earned ? '#e0d8ff' : '#4b4570', fontFamily: "'Syne', sans-serif" }}>
          {badge.label}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: earned ? '#8b7eb8' : '#3a3455', lineHeight: 1.4 }}>
          {earned ? badge.desc : badge.how}
        </p>
      </div>
      {earned
        ? <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: '#a855f7', boxShadow: '0 0 8px rgba(168,85,247,.8)' }} />
        : <div style={{ fontSize: 14, opacity: .35 }}>🔒</div>
      }
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RewardsScreen({ xp = 0, userId = '', onStartChallenge }) {
  const [byRegion,   setByRegion]   = useState({})
  const [totalSongs, setTotalSongs] = useState(0)
  const [moodLogs,   setMoodLogs]   = useState([])
  const [activeTab,  setActiveTab]  = useState('progress')
  const [tooltip,    setTooltip]    = useState(null)
  const [mounted,    setMounted]    = useState(false)

  // Badge popup queue — multiple badges can fire in sequence
  const [badgeQueue,    setBadgeQueue]    = useState([])
  const [currentBadge,  setCurrentBadge]  = useState(null)
  const prevEarnedRef = useRef(null)

  // Daily challenge CTA — shown once per session
  const [showChallenge,    setShowChallenge]    = useState(false)
  const challengeShownRef  = useRef(false)

  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  // Load song + mood history
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

  // ── Streak & calendar ─────────────────────────────────
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
    const d = new Date(today); d.setDate(today.getDate() - i)
    if (logDates.has(d.toDateString())) streak++; else break
  }

  const rank         = getRank(xp)
  const nextRank     = getNextRank(xp)
  const rankPct      = nextRank ? Math.min(100, Math.round(((xp - rank.min) / (nextRank.min - rank.min)) * 100)) : 100
  const dayOfYear    = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  const dailyChall   = DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length]
  const earnedBadges = BADGES.filter(b => isBadgeEarned(b, xp, streak, totalSongs)).length

  // ── Badge detection: fire popup for newly earned badges ──
  useEffect(() => {
    const nowEarned = BADGES.filter(b => isBadgeEarned(b, xp, streak, totalSongs)).map(b => b.id)

    if (prevEarnedRef.current === null) {
      // First render — just record baseline, don't fire popups
      prevEarnedRef.current = new Set(nowEarned)
      return
    }

    const prev = prevEarnedRef.current
    const newlyEarned = nowEarned.filter(id => !prev.has(id))

    if (newlyEarned.length > 0) {
      const newBadges = BADGES.filter(b => newlyEarned.includes(b.id))
      setBadgeQueue(q => [...q, ...newBadges])
    }

    prevEarnedRef.current = new Set(nowEarned)
  }, [xp, streak, totalSongs])

  // ── Drain the badge popup queue one at a time ──
  useEffect(() => {
    if (!currentBadge && badgeQueue.length > 0) {
      const [next, ...rest] = badgeQueue
      setCurrentBadge(next)
      setBadgeQueue(rest)
    }
  }, [badgeQueue, currentBadge])

  // ── Show daily challenge CTA once per session on mount ──
  useEffect(() => {
    if (!challengeShownRef.current && mounted) {
      const sessionKey = `ekko_challenge_shown_${new Date().toDateString()}`
      const alreadyShown = sessionStorage.getItem(sessionKey)
      if (!alreadyShown) {
        const t = setTimeout(() => {
          setShowChallenge(true)
          challengeShownRef.current = true
          sessionStorage.setItem(sessionKey, '1')
        }, 800)
        return () => clearTimeout(t)
      }
    }
  }, [mounted])

  const regions = Object.keys(byRegion)

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      maxWidth: 440, margin: '0 auto', paddingBottom: 48,
      opacity: mounted ? 1 : 0,
      transform: mounted ? 'translateY(0)' : 'translateY(12px)',
      transition: 'all .4s ease',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${rank.color}cc, ${rank.color}44)`,
          boxShadow: `0 0 32px ${rank.glow}, 0 0 64px ${rank.glow}`,
          margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, animation: 'rankFloat 3s ease-in-out infinite',
        }}>{rank.icon}</div>
        <p style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, color: rank.color, fontFamily: "'Syne', sans-serif", textShadow: `0 0 20px ${rank.glow}` }}>
          {rank.label}
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: '#8b7eb8' }}>
          {xp} XP · {streak} day streak 🔥 · {earnedBadges}/{BADGES.length} badges
        </p>
        {nextRank && (
          <p style={{ margin: 0, fontSize: 11, color: '#6b5f8a' }}>
            {nextRank.min - xp} XP until{' '}
            <span style={{ color: nextRank.color, fontWeight: 700 }}>{nextRank.label}</span> {nextRank.icon}
          </p>
        )}
      </div>

      {/* ── Rank progress bar ── */}
      <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#6b5f8a', fontWeight: 700 }}>RANK PROGRESS</span>
          <span style={{ fontSize: 11, color: rank.color, fontWeight: 700 }}>{rankPct}%</span>
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
          <span style={{ fontSize: 10, color: '#6b5f8a' }}>{rank.label}</span>
          {nextRank && <span style={{ fontSize: 10, color: nextRank.color }}>{nextRank.label}</span>}
        </div>
      </div>

      {/* ── Daily Challenge (inline card — always visible) ── */}
      <div
        onClick={() => setShowChallenge(true)}
        style={{
          background:    'linear-gradient(135deg, rgba(251,191,36,.08), rgba(245,158,11,.04))',
          border:        '1.5px solid rgba(251,191,36,.25)',
          borderRadius:  18,
          padding:       '16px 18px',
          marginBottom:  20,
          display:       'flex',
          alignItems:    'center',
          gap:           14,
          position:      'relative',
          overflow:      'hidden',
          cursor:        'pointer',
          transition:    'border-color .2s, background .2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(251,191,36,.5)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(251,191,36,.25)'}
      >
        <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(251,191,36,.06)', pointerEvents: 'none' }} />
        <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: 'rgba(251,191,36,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: '1px solid rgba(251,191,36,.3)' }}>
          {dailyChall.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', fontFamily: "'Syne', sans-serif", letterSpacing: '.08em' }}>DAILY CHALLENGE</span>
          <p style={{ margin: '2px 0', fontSize: 14, fontWeight: 700, color: '#fde68a' }}>{dailyChall.label}</p>
          <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>{dailyChall.desc}</p>
        </div>
        <div style={{ background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, padding: '6px 12px', flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#fbbf24', fontFamily: "'Syne', sans-serif" }}>
          +{dailyChall.xp} XP
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
            border: activeTab === tab.id
              ? '1px solid rgba(168,85,247,.4)'
              : '1px solid transparent',
            borderRadius: 10,
            color: activeTab === tab.id ? '#e0d8ff' : '#6b5f8a',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
            fontFamily: "'DM Sans', sans-serif",
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ══════════ PROGRESS TAB ══════════ */}
      {activeTab === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Section label={`This week · ${streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet'}`}>
            <div style={{ display: 'flex', gap: 6 }}>
              {days.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: '100%', aspectRatio: '1', borderRadius: 10,
                    background: d.today
                      ? 'linear-gradient(135deg, #7c5ce7, #a855f7)'
                      : d.active ? 'rgba(124,92,231,.25)' : 'rgba(255,255,255,.04)',
                    border: `1.5px solid ${d.today ? '#a855f7' : d.active ? 'rgba(124,92,231,.4)' : 'rgba(255,255,255,.07)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    boxShadow: d.today ? '0 0 14px rgba(124,92,231,.5)' : 'none',
                    opacity: d.future ? .3 : 1, transition: 'all .2s',
                  }}>{d.active || d.today ? '✓' : ''}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: d.today ? '#a855f7' : '#4b4570' }}>{d.label}</span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 10, padding: '10px 14px',
              background: streak >= 3 ? 'rgba(168,85,247,.06)' : 'rgba(251,191,36,.06)',
              border: `1px solid ${streak >= 3 ? 'rgba(168,85,247,.2)' : 'rgba(251,191,36,.2)'}`,
              borderRadius: 12, fontSize: 12, color: streak >= 3 ? '#b09ee0' : '#92400e',
            }}>
              {streak === 0 && '💡 Check in today to start your streak!'}
              {streak === 1 && '🌱 Day 1 — keep going tomorrow!'}
              {streak === 2 && '⚡ 2 days in a row! One more for the 🔥 badge!'}
              {streak >= 3  && streak < 7  && `🔥 ${streak} days strong! ${7  - streak} more for ⚡ Electric badge!`}
              {streak >= 7  && streak < 30 && `⚡ ${streak}-day streak! ${30 - streak} more days to Moonwalker!`}
              {streak >= 30 && '🌙 Legendary! 30-day streak achieved!'}
            </div>
          </Section>

          {regions.length > 0 && (
            <Section label={`Regions explored · ${regions.length} / ${Object.keys(REGION_META).length}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {regions.map(r => {
                  const m   = REGION_META[r] || REGION_META.global
                  const cnt = byRegion[r]?.length || 0
                  const pct = totalSongs ? Math.round((cnt / totalSongs) * 100) : 0
                  return (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#c4b5f0', width: 110, flexShrink: 0 }}>{m.emoji} {m.label}</span>
                      <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,.07)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: 4, boxShadow: `0 0 6px ${m.color}88`, transition: 'width .8s ease' }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#6b5f8a', fontWeight: 700, width: 24, textAlign: 'right' }}>{cnt}</span>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          <Section label="Stats">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Total XP',   value: xp,         icon: '⚡', color: '#a855f7' },
                { label: 'Songs made', value: totalSongs, icon: '🎵', color: '#34d399' },
                { label: 'Day streak', value: streak,     icon: '🔥', color: '#f59e0b' },
                { label: 'Badges',     value: `${earnedBadges}/${BADGES.length}`, icon: '🏅', color: '#60a5fa' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: '#6b5f8a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{stat.icon} {stat.label}</p>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: stat.color, fontFamily: "'Syne', sans-serif", textShadow: `0 0 16px ${stat.color}66` }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ══════════ BADGES TAB ══════════ */}
      {activeTab === 'badges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b5f8a' }}>
            Tap a badge to see details · {earnedBadges} earned
          </p>
          {BADGES.map(badge => (
            <BadgeCard
              key={badge.id} badge={badge}
              xp={xp} streak={streak} totalSongs={totalSongs}
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
            <div style={{ fontSize: 52, marginBottom: 12, filter: tooltip.earned ? 'none' : 'grayscale(1) brightness(.5)', animation: tooltip.earned ? 'badgeBounce .5s ease' : 'none' }}>
              {tooltip.badge.emoji}
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: tooltip.earned ? '#e0d8ff' : '#6b5f8a', fontFamily: "'Syne', sans-serif" }}>
              {tooltip.badge.label}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#8b7eb8', lineHeight: 1.6 }}>
              {tooltip.earned ? tooltip.badge.why : tooltip.badge.how}
            </p>
            {tooltip.earned
              ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(168,85,247,.15)', border: '1px solid rgba(168,85,247,.4)', borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 700, color: '#a855f7', marginBottom: 16 }}>✨ Badge earned!</div>
              : <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#6b5f8a', marginBottom: 16 }}>🔒 Keep going — you've got this!</div>
            }
            <button onClick={() => setTooltip(null)} style={{ display: 'block', width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '10px', color: '#8b7eb8', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Badge earned popup (fires automatically) ── */}
      {currentBadge && (
        <BadgeEarnedPopup
          key={currentBadge.id}
          badge={currentBadge}
          onClose={() => setCurrentBadge(null)}
        />
      )}

      {/* ── Daily challenge CTA modal ── */}
      {showChallenge && (
        <DailyChallengeModal
          challenge={dailyChall}
          onAccept={() => {
            setShowChallenge(false)
            onStartChallenge?.(dailyChall)
          }}
          onDismiss={() => setShowChallenge(false)}
        />
      )}

      <style>{CSS}</style>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#6b5f8a', textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: "'Syne', sans-serif" }}>
        {label}
      </p>
      {children}
    </div>
  )
}

const CSS = `
  @keyframes rankFloat     { 0%, 100% { transform: translateY(0);     } 50% { transform: translateY(-6px); } }
  @keyframes particleBurst { 0% { transform: scale(1) translate(0,0); opacity: 1; } 100% { transform: scale(0) translate(var(--tx,20px), var(--ty,-30px)); opacity: 0; } }
  @keyframes modalPop      { from { transform: scale(.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes badgeBounce   { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 70% { transform: scale(.95); } 100% { transform: scale(1); } }
  @keyframes badgeGlow     { 0%, 100% { box-shadow: 0 0 32px rgba(168,85,247,0.5), inset 0 0 20px rgba(168,85,247,0.1); } 50% { box-shadow: 0 0 48px rgba(168,85,247,0.75), inset 0 0 28px rgba(168,85,247,0.2); } }
  @keyframes badgeShimmer  { 0% { transform: translateX(-100%); } 60%, 100% { transform: translateX(100%); } }
  @keyframes confettiFall  { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(180px) rotate(540deg); opacity: 0; } }
  @keyframes challengePulse { 0%, 100% { box-shadow: 0 0 24px rgba(251,191,36,0.2); } 50% { box-shadow: 0 0 40px rgba(251,191,36,0.4); } }
`