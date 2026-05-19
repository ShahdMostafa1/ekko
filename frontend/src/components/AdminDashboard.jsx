import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Admin credentials (change these) ─────────────────────────────────────────
const ADMIN_EMAIL    = 'admin@ekko.app'
const ADMIN_PASSWORD = 'EkkoAdmin2026!'

// ── Constants ─────────────────────────────────────────────────────────────────
const REGION_COLORS = {
  arabic:'#c9a84c', west_africa:'#e07b39', india:'#d4518a',
  east_asia:'#7eb8c9', latin:'#e04f4f', europe:'#6e8efb', global:'#7c5ce7'
}
const REGION_EMOJI = {
  arabic:'🌙', west_africa:'🥁', india:'🪔', east_asia:'🌸',
  latin:'🎺', europe:'🎻', global:'🌍'
}
const EMOTION_COLORS = {
  joy:'#ffd93d', sadness:'#60a5fa', anger:'#ff6b6b',
  fear:'#a78bfa', surprise:'#34d399', disgust:'#fb923c', neutral:'#94a3b8'
}
const EMOTION_EMOJI = {
  joy:'😄', sadness:'😢', anger:'😠', fear:'😨',
  surprise:'😲', disgust:'🤢', neutral:'😐'
}
const LANG_LABELS = { ar:'Arabic', en:'English', fr:'French', text:'Text', unknown:'Unknown' }

function getPlan(xp, streak) {
  if (xp >= 500 || streak >= 30) return { label:'Studio', color:'#fbbf24' }
  if (xp >= 100 || streak >= 7)  return { label:'Groove', color:'#34d399' }
  return { label:'Free', color:'#4a5168' }
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}
function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) + ' ' +
         d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

// ── Sub-components ────────────────────────────────────────────────────────────
function BarChart({ counts, colors, emojis = {}, labelMap = {} }) {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const max = sorted[0]?.[1] || 1
  if (!sorted.length) return <div style={s.emptyState}>No data yet</div>
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {sorted.map(([k, v]) => (
        <div key={k} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:11, color:'#e8eaf0', width:90, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {emojis[k] || ''} {labelMap[k] || k}
          </div>
          <div style={{ flex:1, height:8, background:'rgba(255,255,255,.05)', borderRadius:4, overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:4,
              width:`${Math.round(v/max*100)}%`,
              background: colors[k] || '#4a5168',
              transition:'width .8s ease'
            }} />
          </div>
          <div style={{ fontSize:10, color:'#4a5168', fontFamily:'DM Mono,monospace', minWidth:20, textAlign:'right' }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ ...s.statCard, '--ca': accent }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:accent }} />
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, color: accent }}>{value}</div>
      <div style={s.statSub}>{sub}</div>
    </div>
  )
}

// ── Login screen ──────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = () => {
    setError('')
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setLoading(true)
      setTimeout(() => onLogin(), 600)
    } else {
      setError('Invalid admin credentials.')
    }
  }

  return (
    <div style={s.loginWrap}>
      <div style={s.loginCard}>
        <div style={s.loginLogo}>ekko<span style={{ color:'#e8eaf0' }}>.</span>admin</div>
        <p style={s.loginSub}>Admin access only</p>
        <input
          style={s.input}
          type="email"
          placeholder="Admin email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          autoComplete="off"
        />
        <input
          style={s.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        {error && <div style={s.loginError}>{error}</div>}
        <button
          style={{ ...s.loginBtn, opacity: loading ? 0.6 : 1 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign in →'}
        </button>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard({ onExit }) {
  const [authed, setAuthed]       = useState(false)
  const [tab, setTab]             = useState('overview')
  const [loading, setLoading]     = useState(false)
  const [lastRefresh, setRefresh] = useState(null)
  const [search, setSearch]       = useState('')

  const [profiles, setProfiles] = useState([])
  const [songs, setSongs]       = useState([])
  const [moods, setMoods]       = useState([])
  const [rewards, setRewards]   = useState([])
  const [xpEvents, setXpEvents] = useState([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: p }, { data: so }, { data: m },
        { data: r }, { data: x }
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('songs').select('*').order('created_at', { ascending: false }),
        supabase.from('mood_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('user_rewards').select('*'),
        supabase.from('xp_events').select('*').order('created_at', { ascending: false }).limit(200),
      ])
      setProfiles(p || [])
      setSongs(so || [])
      setMoods(m || [])
      setRewards(r || [])
      setXpEvents(x || [])
      setRefresh(new Date())
    } catch (e) {
      console.error('Admin load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
  loadData()
}, [loadData])

  // ── Enriched user rows ──────────────────────────────────────────────────────
  const emailOf = {}
  profiles.forEach(p => { emailOf[p.id] = p.email })

  const songsByUser  = {}; songs.forEach(s   => { songsByUser[s.user_id]  = (songsByUser[s.user_id]  || 0) + 1 })
  const moodsByUser  = {}; moods.forEach(m   => { moodsByUser[m.user_id]  = (moodsByUser[m.user_id]  || 0) + 1 })
  const rewardByUser = {}; rewards.forEach(r => { rewardByUser[r.user_id] = r })

  const enrichedUsers = profiles.map(p => ({
    ...p,
    songs:  songsByUser[p.id]  || 0,
    moods:  moodsByUser[p.id]  || 0,
    reward: rewardByUser[p.id] || null,
    plan:   getPlan(p.xp || 0, rewardByUser[p.id]?.streak || 0),
  }))

  const filteredUsers = enrichedUsers.filter(u =>
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  )

  // ── Overview stats ──────────────────────────────────────────────────────────
  const totalXp      = profiles.reduce((s, p) => s + (p.xp || 0), 0)
  const regionCounts = {}; songs.forEach(s => { regionCounts[s.region] = (regionCounts[s.region] || 0) + 1 })
  const emotionCounts= {}; moods.forEach(m => { emotionCounts[m.emotion] = (emotionCounts[m.emotion] || 0) + 1 })
  const langCounts   = {}; moods.forEach(m => { const l = m.language||'unknown'; langCounts[l] = (langCounts[l]||0)+1 })

  const recentActivity = [
    ...moods.slice(0, 6).map(m => ({ type:'mood', data:m })),
    ...songs.slice(0, 6).map(s => ({ type:'song', data:s })),
  ].sort((a, b) => new Date(b.data.created_at) - new Date(a.data.created_at)).slice(0, 10)

  const NAV = [
    { id:'overview', icon:'📊', label:'Overview'  },
    { id:'users',    icon:'👥', label:'Users'     },
    { id:'songs',    icon:'🎵', label:'Songs'     },
    { id:'moods',    icon:'🎭', label:'Moods'     },
    { id:'rewards',  icon:'🏅', label:'Rewards'   },
  ]

  return (
    <div style={s.shell}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.logo}>ekko<span style={{ color:'#e8eaf0' }}>.</span>admin</div>
        {NAV.map(n => (
          <div
            key={n.id}
            style={{
              ...s.navItem,
              color: tab === n.id ? '#00e5ff' : '#4a5168',
              borderLeftColor: tab === n.id ? '#00e5ff' : 'transparent',
              background: tab === n.id ? 'rgba(0,229,255,.04)' : 'transparent',
            }}
            onClick={() => setTab(n.id)}
          >
            <span style={{ fontSize:15, width:20, textAlign:'center' }}>{n.icon}</span>
            {n.label}
          </div>
        ))}
        <div style={s.sidebarBottom}>
          <div style={{ fontSize:11, color:'#4a5168', lineHeight:1.5, fontFamily:'DM Mono,monospace' }}>
            {lastRefresh
              ? <span style={{ color:'#00ffa3' }}>● live · {fmtTime(lastRefresh)}</span>
              : <span>● not loaded</span>
            }
          </div>
          <button style={s.exitBtn} onClick={onExit}>← Back to app</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={s.main}>
        {/* Topbar */}
        <div style={s.topbar}>
          <span style={{ fontSize:14, fontWeight:700, color:'#e8eaf0' }}>
            {NAV.find(n => n.id === tab)?.label}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {loading
              ? <span style={{ fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>loading…</span>
              : <>
                  <div style={s.liveDot} />
                  <span style={{ fontSize:11, color:'#00ffa3', fontWeight:700, fontFamily:'DM Mono,monospace' }}>LIVE</span>
                </>
            }
            <button style={s.refreshBtn} onClick={loadData} disabled={loading}>↻ Refresh</button>
          </div>
        </div>

        <div style={s.content}>

          {/* ══ OVERVIEW ══ */}
          {tab === 'overview' && (
            <>
              <div style={s.statsGrid}>
                <StatCard label="Total Users"     value={profiles.length} sub="registered accounts"     accent="#00e5ff" />
                <StatCard label="Songs Generated" value={songs.length}    sub="total tracks created"    accent="#00ffa3" />
                <StatCard label="Mood Sessions"   value={moods.length}    sub="mood detections run"     accent="#7c5ce7" />
                <StatCard label="XP Awarded"      value={totalXp}         sub="total XP across users"   accent="#ffd93d" />
              </div>

              <div style={s.chartsRow}>
                <div style={s.chartCard}>
                  <div style={s.chartTitle}>Songs by Region</div>
                  <BarChart counts={regionCounts} colors={REGION_COLORS} emojis={REGION_EMOJI} />
                </div>
                <div style={s.chartCard}>
                  <div style={s.chartTitle}>Emotion Distribution</div>
                  <BarChart counts={emotionCounts} colors={EMOTION_COLORS} emojis={EMOTION_EMOJI} />
                </div>
                <div style={s.chartCard}>
                  <div style={s.chartTitle}>Input Languages</div>
                  <BarChart
                    counts={langCounts}
                    colors={{ ar:'#00e5ff', en:'#00ffa3', fr:'#ffd93d', text:'#a78bfa', unknown:'#4a5168' }}
                    emojis={{ ar:'🌙', en:'🇬🇧', fr:'🇫🇷', text:'⌨️', unknown:'❓' }}
                    labelMap={LANG_LABELS}
                  />
                </div>
              </div>

              <div style={s.tableWrap}>
                <div style={s.tableSearch}>
                  <span style={{ fontSize:13, fontWeight:800, color:'#e8eaf0' }}>Recent Activity</span>
                </div>
                <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:0 }}>
                  {recentActivity.length === 0
                    ? <div style={s.emptyState}>No activity yet</div>
                    : recentActivity.map((r, i) => {
                        const isS   = r.type === 'song'
                        const color = isS ? '#00ffa3' : '#7c5ce7'
                        const label = isS
                          ? `Generated a ${r.data.region || '?'} song (${r.data.emotion || '?'})`
                          : `Mood detected: ${r.data.emotion || '?'} in ${r.data.language || '?'}`
                        const user  = emailOf[r.data.user_id] || r.data.user_id?.slice(0, 8) + '…' || 'anon'
                        return (
                          <div key={i} style={s.timelineItem}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}`, flexShrink:0, marginTop:4 }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:600, color:'#e8eaf0' }}>
                                {isS ? '🎵' : '🎭'} {label}
                              </div>
                              <div style={{ fontSize:10, color:'#4a5168', fontFamily:'DM Mono,monospace', marginTop:2 }}>
                                {user} · {fmtTime(r.data.created_at)}
                              </div>
                            </div>
                          </div>
                        )
                      })
                  }
                </div>
              </div>
            </>
          )}

          {/* ══ USERS ══ */}
          {tab === 'users' && (
            <div style={s.tableWrap}>
              <div style={s.tableSearch}>
                <input
                  style={s.searchInput}
                  placeholder="Search by email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <span style={{ marginLeft:'auto', fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                  {filteredUsers.length} users
                </span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                      {['User','Region','Plan','XP','Streak','Songs','Moods','Joined','Last Active'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0
                      ? <tr><td colSpan={9} style={s.emptyState}>No users found</td></tr>
                      : filteredUsers.map(u => {
                          const streak   = u.reward?.streak || 0
                          const plan     = u.plan
                          const xpPct    = Math.min((u.xp || 0) / 1000 * 100, 100)
                          const lastMood = moods.find(m => m.user_id === u.id)
                          return (
                            <tr key={u.id} style={s.tr}>
                              <td style={s.td}>
                                <div style={{ fontWeight:600, color:'#e8eaf0', fontSize:12 }}>{u.email || '—'}</div>
                                <div style={{ fontSize:10, color:'#4a5168', fontFamily:'DM Mono,monospace', marginTop:2 }}>{u.id?.slice(0, 12)}…</div>
                              </td>
                              <td style={s.td}>
                                {u.region
                                  ? <span style={{ ...s.tag, background:'rgba(124,92,231,.15)', color:'#a78bfa', border:'1px solid rgba(124,92,231,.25)' }}>
                                      {REGION_EMOJI[u.region] || ''} {u.region}
                                    </span>
                                  : '—'}
                              </td>
                              <td style={s.td}>
                                <span style={{ ...s.tag, background:`${plan.color}18`, color:plan.color, border:`1px solid ${plan.color}40` }}>
                                  {plan.label}
                                </span>
                              </td>
                              <td style={s.td}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{ fontSize:11, fontWeight:700, color:'#7c5ce7', fontFamily:'DM Mono,monospace', minWidth:36 }}>{u.xp || 0}</span>
                                  <div style={{ flex:1, height:4, background:'rgba(255,255,255,.07)', borderRadius:2, overflow:'hidden', maxWidth:80 }}>
                                    <div style={{ height:'100%', background:'#7c5ce7', borderRadius:2, width:`${xpPct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td style={s.td}>
                                {streak > 0
                                  ? <span style={{ fontSize:11, fontFamily:'DM Mono,monospace' }}>🔥 {streak}d</span>
                                  : <span style={{ color:'#4a5168' }}>—</span>}
                              </td>
                              <td style={{ ...s.td, fontWeight:700, color:'#00ffa3' }}>{u.songs}</td>
                              <td style={{ ...s.td, color:'#7c5ce7' }}>{u.moods}</td>
                              <td style={{ ...s.td, fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtDate(u.created_at)}</td>
                              <td style={{ ...s.td, fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{lastMood ? fmtTime(lastMood.created_at) : '—'}</td>
                            </tr>
                          )
                        })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ SONGS ══ */}
          {tab === 'songs' && (
            <div style={s.tableWrap}>
              <div style={s.tableSearch}>
                <span style={{ fontSize:13, fontWeight:800, color:'#e8eaf0' }}>All Generated Songs</span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{songs.length} songs</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                      {['User','Region','Emotion','Language','Artist Style','Mood Label','Valence','Created'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {songs.length === 0
                      ? <tr><td colSpan={8} style={s.emptyState}>No songs yet</td></tr>
                      : songs.map(song => (
                          <tr key={song.id} style={s.tr}>
                            <td style={{ ...s.td, fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                              {emailOf[song.user_id] || song.user_id?.slice(0, 10) || '—'}
                            </td>
                            <td style={s.td}>
                              {song.region
                                ? <span style={{ ...s.tag, background:'rgba(124,92,231,.15)', color:'#a78bfa', border:'1px solid rgba(124,92,231,.25)' }}>
                                    {REGION_EMOJI[song.region] || ''} {song.region}
                                  </span>
                                : '—'}
                            </td>
                            <td style={{ ...s.td, fontWeight:700, color: EMOTION_COLORS[song.emotion] || '#fff' }}>
                              {EMOTION_EMOJI[song.emotion] || ''} {song.emotion || '—'}
                            </td>
                            <td style={s.td}>
                              <span style={{ ...s.tag, background:'rgba(0,229,255,.08)', color:'#00e5ff', border:'1px solid rgba(0,229,255,.2)' }}>
                                {song.language || '—'}
                              </span>
                            </td>
                            <td style={{ ...s.td, fontSize:11, color:'#4a5168' }}>{song.artist_label || '—'}</td>
                            <td style={{ ...s.td, fontSize:11 }}>{song.mood_label || '—'}</td>
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:11, color:(song.valence||0.5)>0.5?'#00ffa3':'#ff6b6b' }}>
                              {song.valence?.toFixed(2) || '—'}
                            </td>
                            <td style={{ ...s.td, fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtTime(song.created_at)}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ MOODS ══ */}
          {tab === 'moods' && (
            <div style={s.tableWrap}>
              <div style={s.tableSearch}>
                <span style={{ fontSize:13, fontWeight:800, color:'#e8eaf0' }}>Mood Detection Logs</span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{moods.length} sessions</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                      {['User','Emotion','Valence','Arousal','Language','Region','Confidence','Transcript','Detected At'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {moods.length === 0
                      ? <tr><td colSpan={9} style={s.emptyState}>No mood logs yet</td></tr>
                      : moods.map(m => (
                          <tr key={m.id} style={s.tr}>
                            <td style={{ ...s.td, fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                              {emailOf[m.user_id] || m.user_id?.slice(0, 10) || '—'}
                            </td>
                            <td style={{ ...s.td, fontWeight:700, color: EMOTION_COLORS[m.emotion] || '#fff' }}>
                              {EMOTION_EMOJI[m.emotion] || ''} {m.emotion || '—'}
                            </td>
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:11, color:(m.valence||0.5)>0.5?'#00ffa3':'#ff6b6b' }}>
                              {m.valence?.toFixed(2) || '—'}
                            </td>
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:11 }}>{m.arousal?.toFixed(2) || '—'}</td>
                            <td style={s.td}>
                              <span style={{ ...s.tag, background:'rgba(0,229,255,.08)', color:'#00e5ff', border:'1px solid rgba(0,229,255,.2)' }}>
                                {LANG_LABELS[m.language] || m.language || '—'}
                              </span>
                            </td>
                            <td style={s.td}>
                              {m.region
                                ? <span style={{ ...s.tag, background:'rgba(124,92,231,.15)', color:'#a78bfa', border:'1px solid rgba(124,92,231,.25)' }}>
                                    {REGION_EMOJI[m.region] || ''} {m.region}
                                  </span>
                                : '—'}
                            </td>
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:11, color:(m.confidence||0)>0.7?'#00ffa3':'#4a5168' }}>
                              {m.confidence?.toFixed(2) || '—'}
                            </td>
                            <td style={{ ...s.td, fontSize:11, color:'#4a5168', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                                title={m.transcript || ''}>
                              {m.transcript || '—'}
                            </td>
                            <td style={{ ...s.td, fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtTime(m.created_at)}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ REWARDS ══ */}
          {tab === 'rewards' && (
            <>
              <div style={s.tableWrap}>
                <div style={s.tableSearch}>
                  <span style={{ fontSize:13, fontWeight:800, color:'#e8eaf0' }}>Rewards & XP</span>
                  <span style={{ marginLeft:'auto', fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{rewards.length} users</span>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                        {['User','Points','Streak','Badges','Last Check-in'].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rewards.length === 0
                        ? <tr><td colSpan={5} style={s.emptyState}>No rewards yet</td></tr>
                        : rewards.map(r => (
                            <tr key={r.user_id} style={s.tr}>
                              <td style={{ ...s.td, fontSize:11, fontFamily:'DM Mono,monospace', color:'#4a5168' }}>
                                {emailOf[r.user_id] || r.user_id?.slice(0, 12) || '—'}
                              </td>
                              <td style={{ ...s.td, fontWeight:700, color:'#7c5ce7', fontFamily:'DM Mono,monospace' }}>{r.points || 0} pts</td>
                              <td style={s.td}>
                                {(r.streak || 0) > 0
                                  ? <span style={{ fontSize:11, fontFamily:'DM Mono,monospace' }}>🔥 {r.streak}d</span>
                                  : <span style={{ color:'#4a5168' }}>—</span>}
                              </td>
                              <td style={s.td}>
                                {(r.badges || []).length > 0
                                  ? (r.badges || []).map(b => (
                                      <span key={b} style={{ ...s.tag, background:'rgba(124,92,231,.15)', color:'#a78bfa', border:'1px solid rgba(124,92,231,.25)', margin:'1px 2px' }}>{b}</span>
                                    ))
                                  : <span style={{ color:'#4a5168' }}>—</span>}
                              </td>
                              <td style={{ ...s.td, fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{r.last_checkin || '—'}</td>
                            </tr>
                          ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={s.tableWrap}>
                <div style={s.tableSearch}>
                  <span style={{ fontSize:13, fontWeight:800, color:'#e8eaf0' }}>XP Event Log</span>
                  <span style={{ marginLeft:'auto', fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>last {Math.min(xpEvents.length, 200)}</span>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                        {['User','Action','XP','Time'].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {xpEvents.length === 0
                        ? <tr><td colSpan={4} style={s.emptyState}>No XP events yet</td></tr>
                        : xpEvents.slice(0, 50).map(e => (
                            <tr key={e.id} style={s.tr}>
                              <td style={{ ...s.td, fontSize:11, fontFamily:'DM Mono,monospace', color:'#4a5168' }}>
                                {emailOf[e.user_id] || e.user_id?.slice(0, 12) || '—'}
                              </td>
                              <td style={{ ...s.td, fontSize:12 }}>{e.action || '—'}</td>
                              <td style={{ ...s.td, fontWeight:700, color:'#00e5ff', fontFamily:'DM Mono,monospace' }}>+{e.xp || 0}</td>
                              <td style={{ ...s.td, fontSize:11, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtTime(e.created_at)}</td>
                            </tr>
                          ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  shell:       { display:'flex', minHeight:'100vh', background:'#080b12', color:'#e8eaf0', fontFamily:"'DM Sans','Segoe UI',sans-serif" },
  sidebar:     { width:220, flexShrink:0, background:'#0e1320', borderRight:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', padding:'24px 0', minHeight:'100vh' },
  logo:        { padding:'0 20px 28px', fontSize:20, fontWeight:900, letterSpacing:'-0.5px', color:'#00e5ff', borderBottom:'1px solid rgba(255,255,255,.07)', marginBottom:16 },
  navItem:     { display:'flex', alignItems:'center', gap:10, padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer', borderLeft:'2px solid transparent', transition:'all .15s', letterSpacing:'.02em' },
  sidebarBottom: { marginTop:'auto', padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', gap:10 },
  exitBtn:     { background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#4a5168', fontSize:11, fontWeight:700, padding:'7px 12px', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  main:        { flex:1, overflowX:'hidden', display:'flex', flexDirection:'column' },
  topbar:      { height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', borderBottom:'1px solid rgba(255,255,255,.07)', background:'#0e1320', position:'sticky', top:0, zIndex:10 },
  liveDot:     { width:7, height:7, borderRadius:'50%', background:'#00ffa3', boxShadow:'0 0 8px #00ffa3', animation:'pulse 2s infinite' },
  refreshBtn:  { padding:'6px 14px', borderRadius:8, background:'rgba(0,229,255,.1)', border:'1px solid rgba(0,229,255,.25)', color:'#00e5ff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  content:     { padding:28, flex:1 },
  statsGrid:   { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28 },
  statCard:    { background:'#0e1320', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'18px 20px', position:'relative', overflow:'hidden' },
  statLabel:   { fontSize:10, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 },
  statValue:   { fontSize:32, fontWeight:900, lineHeight:1, marginBottom:4 },
  statSub:     { fontSize:11, color:'#4a5168' },
  chartsRow:   { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:28 },
  chartCard:   { background:'#0e1320', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'18px 20px' },
  chartTitle:  { fontSize:11, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 },
  tableWrap:   { background:'#0e1320', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, overflow:'hidden', marginBottom:28 },
  tableSearch: { padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', gap:10 },
  searchInput: { background:'#141926', border:'1px solid rgba(255,255,255,.07)', borderRadius:8, padding:'7px 12px', color:'#e8eaf0', fontSize:12, fontFamily:'DM Mono,monospace', outline:'none', width:260 },
  th:          { padding:'10px 16px', textAlign:'left', fontSize:10, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'.08em', fontFamily:'DM Mono,monospace', whiteSpace:'nowrap' },
  td:          { padding:'12px 16px', fontSize:12, borderBottom:'1px solid rgba(255,255,255,.03)' },
  tr:          {},
  tag:         { display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6, fontSize:10, fontWeight:700, fontFamily:'DM Mono,monospace', whiteSpace:'nowrap' },
  timelineItem:{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.05)' },
  emptyState:  { padding:32, textAlign:'center', color:'#4a5168', fontSize:12 },

  // Login
  loginWrap:   { minHeight:'100vh', background:'#080b12', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans','Segoe UI',sans-serif" },
  loginCard:   { background:'#0e1320', border:'1px solid rgba(255,255,255,.07)', borderRadius:20, padding:'40px 36px', width:360, display:'flex', flexDirection:'column', gap:14 },
  loginLogo:   { fontSize:22, fontWeight:900, color:'#00e5ff', letterSpacing:'-0.5px', marginBottom:4 },
  loginSub:    { fontSize:13, color:'#4a5168', marginTop:-10, marginBottom:8 },
  input:       { background:'rgba(0,0,0,.3)', border:'1px solid rgba(255,255,255,.07)', borderRadius:8, padding:'10px 14px', color:'#e8eaf0', fontSize:13, fontFamily:'DM Mono,monospace', outline:'none', width:'100%' },
  loginError:  { fontSize:12, color:'#ff6b6b', background:'rgba(255,107,107,.08)', border:'1px solid rgba(255,107,107,.2)', borderRadius:8, padding:'8px 12px' },
  loginBtn:    { background:'#00e5ff', border:'none', borderRadius:10, padding:'12px', color:'#000', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit', transition:'opacity .15s', marginTop:4 },
}