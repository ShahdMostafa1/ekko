import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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
    id: 'free', name: 'Free', icon: '🎧', price: '$0', period: 'forever',
    color: '#9ca3af', glow: '#9ca3af22', border: '#9ca3af44',
    features: ['5 songs per day','All 7 cultural regions','Mood detection (voice + text)','Basic artist styles','Song history (last 20)'],
  },
  {
    id: 'groove', name: 'Groove', icon: '🌊', price: '$9', period: '/ month',
    color: '#34d399', glow: '#34d39918', border: '#34d39966',
    features: ['Unlimited songs per day','All artist styles unlocked','Priority generation queue','Full song history','Mood analytics dashboard'],
  },
  {
    id: 'studio', name: 'Studio', icon: '🎨', price: '$19', period: '/ month',
    color: '#f59e0b', glow: '#f59e0b18', border: '#f59e0b66',
    features: ['Everything in Groove','Download songs as MP3','Custom lyric editing','Co-write with AI','Exclusive Maestro artists','Monthly featured on Ekko'],
  },
]
const DAILY_CHALLENGES = [
  { id: 'dc1', emoji: '🌅', label: 'Morning Mood',  desc: 'Share a mood before noon',    xp: 15 },
  { id: 'dc2', emoji: '🎭', label: 'Emotion Flip',  desc: 'Try a new region today',      xp: 20 },
  { id: 'dc3', emoji: '🌙', label: 'Night Session', desc: 'Create a song after 9 PM',    xp: 25 },
  { id: 'dc4', emoji: '🎲', label: 'Random Vibes',  desc: 'Use the quiz mood input',     xp: 15 },
  { id: 'dc5', emoji: '🔁', label: 'Double Down',   desc: 'Generate 2 songs today',      xp: 30 },
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
function getRank(xp) { return RANKS.find(r => xp >= r.min && xp <= r.max) || RANKS[0] }
function getNextRank(xp) {
  const idx = RANKS.findIndex(r => xp >= r.min && xp <= r.max)
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null
}
function isBadgeEarned(badge, xp, streak, totalSongs) {
  if (badge.special) return false
  if (badge.xpNeeded   > 0 && xp         < badge.xpNeeded)   return false
  if (badge.streakNeeded > 0 && streak    < badge.streakNeeded) return false
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
          <Particle key={i} x={`${20 + i * 10}%`} y={`${30 + (i % 2) * 40}%`}
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
        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: earned ? '#e0d8ff' : '#4b4570', fontFamily: "'Syne', sans-serif" }}>{badge.label}</p>
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

// ── PlanCard — fixed URLs + cancelling state ──────────────────────────────────
function PlanCard({ plan, subStatus, userId, userEmail, onPortalOpen }) {
  const { plan: activePlan, status, cancel_at_period_end } = subStatus

  // "current" only if actively paying and NOT cancelling
  const isFullyActive = activePlan === plan.id && status === 'active' && !cancel_at_period_end
  // cancelling = still active until period end but user cancelled
  const isCancelling  = activePlan === plan.id && (status === 'cancelling' || cancel_at_period_end)
  const isFree        = plan.id === 'free'
  const isCurrentFree = isFree && (activePlan === 'free' || activePlan === undefined)

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const handleUpgrade = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      // Fixed URL: /stripe/checkout (not /stripe/create-checkout)
      const res = await fetch(`${import.meta.env.VITE_API_URL}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, email: userEmail, plan: plan.id }),
      })
      const data = await res.json()
      if (res.status === 409) {
        // Already subscribed
        setError('You already have an active subscription for this plan.')
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.detail || 'Could not start checkout.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: isFullyActive
        ? `linear-gradient(135deg, ${plan.glow}, rgba(255,255,255,.04))`
        : 'rgba(255,255,255,.04)',
      border: `1.5px solid ${isFullyActive ? plan.color : isCancelling ? '#f59e0b66' : plan.border}`,
      borderRadius: 20, padding: '18px 16px',
      position: 'relative', overflow: 'hidden',
      boxShadow: isFullyActive ? `0 0 24px ${plan.glow}` : 'none',
      transition: 'all .25s',
      opacity: isCancelling ? 0.85 : 1,
    }}>
      {/* Active badge */}
      {isFullyActive && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          fontSize: 10, fontWeight: 800, color: plan.color,
          background: plan.glow, padding: '3px 8px',
          borderRadius: 20, border: `1px solid ${plan.border}`,
          fontFamily: "'Syne', sans-serif", letterSpacing: '.08em',
        }}>ACTIVE</div>
      )}
      {/* Cancelling badge */}
      {isCancelling && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          fontSize: 10, fontWeight: 800, color: '#f59e0b',
          background: 'rgba(245,158,11,.12)', padding: '3px 8px',
          borderRadius: 20, border: '1px solid rgba(245,158,11,.4)',
          fontFamily: "'Syne', sans-serif", letterSpacing: '.08em',
        }}>CANCELS SOON</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 26 }}>{plan.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: plan.color, fontFamily: "'Syne', sans-serif" }}>{plan.name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#f9fafb' }}>{plan.price}</span>
          <span style={{ fontSize: 11, color: '#6b5f8a', marginLeft: 3 }}>{plan.period}</span>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: plan.color }}>✓</span>
            <span style={{ fontSize: 12, color: '#c4b5f0' }}>{f}</span>
          </div>
        ))}
      </div>

      {error && (
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#f87171', textAlign: 'center' }}>{error}</p>
      )}

      {/* Free plan — always just show current */}
      {isFree && (
        <div style={{
          width: '100%', padding: '12px', borderRadius: 12,
          background: 'rgba(255,255,255,.06)', textAlign: 'center',
          color: '#6b7280', fontSize: 14, fontWeight: 700,
        }}>
          {isCurrentFree ? '✓ Current Plan' : 'Free Plan'}
        </div>
      )}

      {/* Fully active paid plan — show Current Plan + Manage/Cancel */}
      {!isFree && isFullyActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            width: '100%', padding: '12px', borderRadius: 12, textAlign: 'center',
            background: 'rgba(255,255,255,.06)', color: '#6b7280', fontSize: 14, fontWeight: 700,
          }}>
            ✅ Current Plan
          </div>
          <button
            onClick={onPortalOpen}
            style={{
              width: '100%', padding: '11px', borderRadius: 12,
              background: 'transparent', border: `1px solid ${plan.color}`,
              color: plan.color, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Manage / Cancel
          </button>
        </div>
      )}

      {/* Cancelling — show re-subscribe option */}
      {!isFree && isCancelling && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 10, fontSize: 12, textAlign: 'center',
            background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)',
            color: '#fde68a',
          }}>
            ⏳ Access continues until period ends. Re-subscribe below when ready.
          </div>
        </div>
      )}

      {/* Upgrade button — only for plans the user is NOT currently on */}
      {!isFree && !isFullyActive && !isCancelling && (
        <button
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            width: '100%', padding: '12px', borderRadius: 12, border: 'none',
            background: loading
              ? 'rgba(255,255,255,.1)'
              : `linear-gradient(135deg, ${plan.color}cc, ${plan.color})`,
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: "'DM Sans', sans-serif", transition: 'all .2s',
            boxShadow: !loading ? `0 4px 16px ${plan.glow}` : 'none',
          }}
        >
          {loading ? '↗ Redirecting to Stripe...' : `Upgrade to ${plan.name}`}
        </button>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RewardsScreen({ xp = 0, userId = '' }) {
  const [byRegion, setByRegion]           = useState({})
  const [totalSongs, setTotalSongs]       = useState(0)
  const [moodLogs, setMoodLogs]           = useState([])
  const [activeTab, setActiveTab]         = useState('progress')
  // subStatus holds { plan, status, cancel_at_period_end, period_end }
  const [subStatus, setSubStatus]         = useState({ plan: 'free', status: 'inactive', cancel_at_period_end: false })
  const [tooltip, setTooltip]             = useState(null)
  const [mounted, setMounted]             = useState(false)
  const [userEmail, setUserEmail]         = useState('')
  const [stripeLoading, setStripeLoading] = useState(false)
  const [paySuccess, setPaySuccess]       = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  // ── Load subscription status ──────────────────────────
  const fetchSub = async (uid) => {
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/stripe/status/${uid}`)
      const data = await res.json()
      setSubStatus({
        plan:                 data.plan  || 'free',
        status:               data.status || 'inactive',
        cancel_at_period_end: data.cancel_at_period_end || false,
        period_end:           data.period_end || null,
      })
    } catch {
      setSubStatus({ plan: 'free', status: 'inactive', cancel_at_period_end: false })
    }
  }

  useEffect(() => {
    if (!userId) return
    fetchSub(userId)
  }, [userId])

  // ── Handle ?payment=success return from Stripe ────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      setPaySuccess(true)
      setActiveTab('plans')
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => { if (userId) fetchSub(userId) }, 3000)
    }
    if (params.get('payment') === 'cancel') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    fetch(`${import.meta.env.VITE_API_URL}/music/history/${userId}`)
      .then(r => r.json())
      .then(data => { setByRegion(data.by_region || {}); setTotalSongs((data.songs || []).length) })
      .catch(() => {})
    fetch(`${import.meta.env.VITE_API_URL}/mood/history/${userId}`)
      .then(r => r.json())
      .then(data => setMoodLogs(data.logs || []))
      .catch(() => {})
  }, [userId])

  // ── Open Stripe portal (fixed URL) ───────────────────
  const handlePortalOpen = async () => {
    setStripeLoading(true)
    try {
      // Fixed URL: /stripe/portal (not /stripe/create-portal)
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/stripe/portal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { /* ignore */ }
    setStripeLoading(false)
  }

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

  const rank       = getRank(xp)
  const nextRank   = getNextRank(xp)
  const rankPct    = nextRank ? Math.min(100, Math.round(((xp - rank.min) / (nextRank.min - rank.min)) * 100)) : 100
  const dayOfYear  = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  const dailyChall = DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length]
  const earnedBadges = BADGES.filter(b => isBadgeEarned(b, xp, streak, totalSongs)).length
  const regions      = Object.keys(byRegion)

  // Is user on a real paid active (non-cancelling) plan?
  const isFullyActive = subStatus.status === 'active' && !subStatus.cancel_at_period_end && subStatus.plan !== 'free'
  const isCancelling  = (subStatus.status === 'cancelling' || subStatus.cancel_at_period_end) && subStatus.plan !== 'free'

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
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${rank.color}cc, ${rank.color}44)`,
          boxShadow: `0 0 32px ${rank.glow}, 0 0 64px ${rank.glow}`,
          margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, animation: 'rankFloat 3s ease-in-out infinite',
        }}>{rank.icon}</div>
        <p style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, color: rank.color, fontFamily: "'Syne', sans-serif", textShadow: `0 0 20px ${rank.glow}` }}>{rank.label}</p>
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
            transition: 'width 1s ease', animation: 'shimmer 2s linear infinite',
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
        border: '1.5px solid rgba(251,191,36,.25)', borderRadius: 18, padding: '16px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(251,191,36,.06)' }} />
        <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: 'rgba(251,191,36,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: '1px solid rgba(251,191,36,.3)' }}>
          {dailyChall.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', fontFamily: "'Syne', sans-serif", letterSpacing: '.08em' }}>DAILY CHALLENGE</span>
          </div>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#fde68a' }}>{dailyChall.label}</p>
          <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>{dailyChall.desc}</p>
        </div>
        <div style={{ background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, padding: '6px 12px', flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#fbbf24', fontFamily: "'Syne', sans-serif" }}>+{dailyChall.xp} XP</div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 4 }}>
        {[
          { id: 'progress', label: '📈 Progress' },
          { id: 'badges',   label: `🏅 Badges (${earnedBadges})` },
          { id: 'plans',    label: '✨ Plans' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '9px 8px',
            background: activeTab === tab.id ? 'linear-gradient(135deg, rgba(124,92,231,.4), rgba(168,85,247,.3))' : 'transparent',
            border: activeTab === tab.id ? '1px solid rgba(168,85,247,.4)' : '1px solid transparent',
            borderRadius: 10, color: activeTab === tab.id ? '#e0d8ff' : '#6b5f8a',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
            fontFamily: "'DM Sans', sans-serif",
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ══════════════════ PROGRESS TAB ══════════════════ */}
      {activeTab === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Section label={`This week · ${streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet'}`}>
            <div style={{ display: 'flex', gap: 6 }}>
              {days.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: '100%', aspectRatio: '1', borderRadius: 10,
                    background: d.today ? 'linear-gradient(135deg, #7c5ce7, #a855f7)' : d.active ? 'rgba(124,92,231,.25)' : 'rgba(255,255,255,.04)',
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
              {streak >= 3 && streak < 7  && `🔥 ${streak} days strong! ${7 - streak} more for ⚡ Electric badge!`}
              {streak >= 7 && streak < 30 && `⚡ ${streak}-day streak! ${30 - streak} more days to Moonwalker!`}
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

      {/* ══════════════════ BADGES TAB ══════════════════ */}
      {activeTab === 'badges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b5f8a' }}>Tap a badge to see details · {earnedBadges} earned</p>
          {BADGES.map(badge => (
            <BadgeCard key={badge.id} badge={badge} xp={xp} streak={streak} totalSongs={totalSongs}
              onTap={(b, earned) => setTooltip({ badge: b, earned })} />
          ))}
        </div>
      )}

      {/* ══════════════════ PLANS TAB ══════════════════ */}
      {activeTab === 'plans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Payment success banner */}
          {paySuccess && (
            <div style={{ background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.35)', borderRadius: 12, padding: '12px 16px', color: '#6ee7b7', fontSize: 13, textAlign: 'center' }}>
              🎉 Payment successful! Your plan is now active. 📧 Check your email for invoice &amp; receipt PDFs.
            </div>
          )}

          {/* Active plan banner with manage button */}
          {isFullyActive && (
            <div style={{ background: 'rgba(124,92,231,.1)', border: '1px solid rgba(124,92,231,.3)', borderRadius: 12, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#c4b5f0' }}>
                ✅ You're on <strong style={{ color: '#a855f7' }}>{subStatus.plan.charAt(0).toUpperCase() + subStatus.plan.slice(1)}</strong>
              </span>
              <button onClick={handlePortalOpen} style={{ background: 'transparent', border: '1px solid rgba(168,85,247,.4)', borderRadius: 8, padding: '5px 12px', color: '#a855f7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {stripeLoading ? '...' : 'Manage billing →'}
              </button>
            </div>
          )}

          {/* Cancelling banner */}
          {isCancelling && (
            <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, padding: '10px 16px', color: '#fde68a', fontSize: 13, textAlign: 'center' }}>
              ⏳ Your <strong>{subStatus.plan.charAt(0).toUpperCase() + subStatus.plan.slice(1)}</strong> plan is cancelled and will expire at the end of the billing period. You can re-subscribe anytime.
            </div>
          )}

          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b5f8a' }}>
            {isFullyActive ? 'Manage or upgrade your plan below.' : 'Upgrade to unlock more generations and features.'}
          </p>

          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              subStatus={subStatus}
              userId={userId}
              userEmail={userEmail}
              onPortalOpen={handlePortalOpen}
            />
          ))}

          <p style={{ textAlign: 'center', color: '#4b4570', fontSize: 11, marginTop: 4 }}>
            Payments by Stripe · Cancel anytime · No hidden fees
          </p>
        </div>
      )}

      {/* ── Badge tooltip modal ── */}
      {tooltip && (
        <div onClick={() => setTooltip(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(135deg, #1a1040, #2d1b69)', border: `1.5px solid ${tooltip.earned ? 'rgba(168,85,247,.5)' : 'rgba(255,255,255,.1)'}`, borderRadius: 24, padding: '28px 24px', maxWidth: 320, width: '100%', boxShadow: tooltip.earned ? '0 0 40px rgba(168,85,247,.3)' : '0 20px 60px rgba(0,0,0,.5)', textAlign: 'center', animation: 'modalPop .25s ease' }}>
            <div style={{ fontSize: 52, marginBottom: 12, filter: tooltip.earned ? 'none' : 'grayscale(1) brightness(.5)', animation: tooltip.earned ? 'badgeBounce .5s ease' : 'none' }}>{tooltip.badge.emoji}</div>
            <p style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: tooltip.earned ? '#e0d8ff' : '#6b5f8a', fontFamily: "'Syne', sans-serif" }}>{tooltip.badge.label}</p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#8b7eb8', lineHeight: 1.6 }}>{tooltip.earned ? tooltip.badge.desc : tooltip.badge.how}</p>
            {tooltip.earned
              ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(168,85,247,.15)', border: '1px solid rgba(168,85,247,.4)', borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 700, color: '#a855f7' }}>✨ Badge earned!</div>
              : <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#6b5f8a' }}>🔒 Keep going — you've got this!</div>
            }
            <button onClick={() => setTooltip(null)} style={{ display: 'block', width: '100%', marginTop: 16, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '10px', color: '#8b7eb8', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Close</button>
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
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#6b5f8a', textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: "'Syne', sans-serif" }}>{label}</p>
      {children}
    </div>
  )
}

const CSS = `
  @keyframes rankFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  @keyframes particleBurst { 0% { transform: scale(1) translate(0,0); opacity: 1; } 100% { transform: scale(0) translate(var(--tx, 20px), var(--ty, -30px)); opacity: 0; } }
  @keyframes modalPop { from { transform: scale(.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes badgeBounce { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 70% { transform: scale(.95); } 100% { transform: scale(1); } }
`