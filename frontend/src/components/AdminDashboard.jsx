import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { filterByInstantSearch } from '../utils/searchFilter'
import {
  ADMIN_EMAIL,
  adminApiFetch,
  getAdminSession,
  signInAdmin,
} from '../utils/adminAuth'

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

function songHasMemory(song) {
  if (!song) return false
  return !!(
    (song.memory_note || '').trim()
    || (song.memory_location || '').trim()
    || (song.memory_photo_url || '').trim()
  )
}

function countBy(rows, keyFn) {
  const m = {}
  for (const row of rows) {
    const k = keyFn(row)
    if (!k) continue
    m[k] = (m[k] || 0) + 1
  }
  return m
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
          <div style={{ fontSize:16, color:'#e8eaf0', width:90, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
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
          <div style={{ fontSize:15, color:'#4a5168', fontFamily:'DM Mono,monospace', minWidth:20, textAlign:'right' }}>{v}</div>
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

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await signInAdmin(email, password)
      onLogin()
    } catch (e) {
      setError(e.message || 'Invalid admin credentials.')
    } finally {
      setLoading(false)
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
  const [authChecked, setAuthChecked] = useState(false)
  const [tab, setTab]             = useState('overview')
  const [loading, setLoading]     = useState(false)
  const [lastRefresh, setRefresh] = useState(null)
  const [search, setSearch]       = useState('')

  const [profiles, setProfiles] = useState([])
  const [songs, setSongs]       = useState([])
  const [moods, setMoods]       = useState([])
  const [moodSessions, setMoodSessions] = useState([])
  const [rewards, setRewards]   = useState([])
  const [xpEvents, setXpEvents] = useState([])
  const [editingSongId, setEditingSongId] = useState(null)
  const [editSongTitle, setEditSongTitle] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: p }, { data: so },
        { data: r }, { data: x }
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('songs').select('*').order('created_at', { ascending: false }),
        supabase.from('user_rewards').select('*'),
        supabase.from('xp_events').select('*').order('created_at', { ascending: false }).limit(2000),
      ])
      const profileRows = p || []
      setProfiles(profileRows)
      setSongs(so || [])

      const emailByUser = {}
      profileRows.forEach(row => { emailByUser[row.id] = row.email || '' })
      const attachEmails = (rows) => rows.map(r => ({
        ...r,
        email: r.email || emailByUser[r.user_id] || '',
      }))

      let moodRows = []
      try {
        const mr = await adminApiFetch('/admin/mood-logs')
        const md = await mr.json().catch(() => ({}))
        if (mr.ok) moodRows = md.mood_logs || []
        else console.error('Admin mood-logs API:', mr.status, md)
      } catch (e) {
        console.error('Admin mood-logs fetch failed:', e)
      }
      if (!moodRows.length) {
        const { data: directMoods } = await supabase
          .from('mood_logs')
          .select('*')
          .order('created_at', { ascending: false })
        moodRows = directMoods || []
      }
      setMoods(attachEmails(moodRows))

      let sessionRows = []
      try {
        const sr = await adminApiFetch('/admin/mood-sessions')
        const sd = await sr.json().catch(() => ({}))
        if (sr.ok) sessionRows = sd.mood_sessions || []
      } catch (e) {
        console.error('Admin mood-sessions fetch failed:', e)
      }
      if (!sessionRows.length) {
        const { data: directSessions } = await supabase
          .from('mood_sessions')
          .select('*')
          .order('created_at', { ascending: false })
        sessionRows = directSessions || []
      }
      setMoodSessions(attachEmails(sessionRows))

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
    getAdminSession()
      .then(session => { if (session) setAuthed(true) })
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (authed) loadData()
  }, [authed, loadData])

  if (!authChecked) {
    return (
      <div style={s.loginWrap}>
        <p style={{ color: '#8b7eb8', fontFamily: 'DM Sans,sans-serif' }}>Checking session…</p>
      </div>
    )
  }
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />

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

  const filteredUsers = filterByInstantSearch(enrichedUsers, search, u => [
    u.email, u.id, u.region, u.full_name,
  ])

  const filteredSongs = filterByInstantSearch(songs, search, s => [
    emailOf[s.user_id], s.title, s.mood_label, s.emotion, s.region, s.language,
    s.artist_label, s.scale, s.lyrics, s.memory_location, s.memory_note,
  ])

  const filteredMoods = filterByInstantSearch(moods, search, m => [
    emailOf[m.user_id], m.emotion, m.transcript, m.region, m.language, m.mood_label,
  ])

  const filteredRewards = filterByInstantSearch(rewards, search, r => [
    emailOf[r.user_id], r.user_id,
  ])

  const filteredXpEvents = filterByInstantSearch(xpEvents, search, e => [
    emailOf[e.user_id], e.action, e.user_id,
  ])

  const memorySongs = songs.filter(songHasMemory)
  const filteredMemories = filterByInstantSearch(memorySongs, search, s => [
    emailOf[s.user_id], s.title, s.memory_location, s.memory_note, s.mood_label, s.emotion,
  ])

  const filteredSessions = filterByInstantSearch(moodSessions, search, ms => [
    emailOf[ms.user_id], ms.mood_label, ms.emotion, ms.region, ms.language,
  ])

  const deleteSongAdmin = async (id) => {
    if (!window.confirm('Delete this song permanently?')) return
    const { error } = await supabase.from('songs').delete().eq('id', id)
    if (!error) setSongs(prev => prev.filter(s => s.id !== id))
  }

  const deleteMoodAdmin = async (id) => {
    if (!window.confirm('Delete this mood log?')) return
    const { error } = await supabase.from('mood_logs').delete().eq('id', id)
    if (!error) setMoods(prev => prev.filter(m => m.id !== id))
  }

  const deleteXpEventAdmin = async (id) => {
    if (!window.confirm('Delete this XP event?')) return
    const { error } = await supabase.from('xp_events').delete().eq('id', id)
    if (!error) setXpEvents(prev => prev.filter(e => e.id !== id))
  }

  const saveSongTitleAdmin = async (id) => {
    const title = editSongTitle.trim()
    if (!title) return
    const { error } = await supabase.from('songs').update({ title }).eq('id', id)
    if (!error) {
      setSongs(prev => prev.map(s => s.id === id ? { ...s, title } : s))
      setEditingSongId(null)
    }
  }

  const toggleFavoriteAdmin = async (song) => {
    const next = !song.is_favorite
    const { error } = await supabase.from('songs').update({ is_favorite: next }).eq('id', song.id)
    if (!error) {
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, is_favorite: next } : s))
    }
  }

  const deleteUserAdmin = async (u) => {
    if (u.email === ADMIN_EMAIL) {
      window.alert('Cannot delete the admin account.')
      return
    }
    const label = u.email || u.id
    if (!window.confirm(`Permanently delete user "${label}"?\n\nAll songs, moods, XP, rewards, and auth access will be removed. This cannot be undone.`)) {
      return
    }
    try {
      const res = await adminApiFetch(`/admin/users/${u.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      setProfiles(prev => prev.filter(p => p.id !== u.id))
      setSongs(prev => prev.filter(s => s.user_id !== u.id))
      setMoods(prev => prev.filter(m => m.user_id !== u.id))
      setMoodSessions(prev => prev.filter(ms => ms.user_id !== u.id))
      setRewards(prev => prev.filter(r => r.user_id !== u.id))
      setXpEvents(prev => prev.filter(e => e.user_id !== u.id))
    } catch (e) {
      window.alert(`Delete failed: ${e.message}`)
    }
  }

  // ── Overview stats ──────────────────────────────────────────────────────────
  const totalXp      = profiles.reduce((s, p) => s + (p.xp || 0), 0)
  const regionCounts = countBy(songs, s => s.region || 'global')
  const emotionCounts = countBy(moods, m => m.emotion || 'neutral')
  const langCounts   = countBy(moods, m => m.language || 'unknown')
  const planCounts   = countBy(profiles, p => (p.plan || 'free').toLowerCase())
  const xpByAction   = xpEvents.reduce((acc, e) => {
    const act = e.action || 'unknown'
    acc[act] = (acc[act] || 0) + (e.xp || 0)
    return acc
  }, {})
  const favoritesCount = songs.filter(s => s.is_favorite).length
  const memoriesCount  = memorySongs.length
  const coversCount    = songs.filter(s => s.cover_url).length
  const activeStreaks  = rewards.filter(r => (r.streak || 0) > 0).length

  const dbInventory = [
    { table: 'profiles', count: profiles.length, icon: '👤' },
    { table: 'songs', count: songs.length, icon: '🎵' },
    { table: 'mood_logs', count: moods.length, icon: '🎭' },
    { table: 'mood_sessions', count: moodSessions.length, icon: '🎙' },
    { table: 'xp_events', count: xpEvents.length, icon: '⚡' },
    { table: 'user_rewards', count: rewards.length, icon: '🏅' },
  ]

  const recentActivity = [
    ...moods.slice(0, 8).map(m => ({ type:'mood', data:m })),
    ...songs.slice(0, 8).map(s => ({ type:'song', data:s })),
    ...moodSessions.slice(0, 4).map(ms => ({ type:'session', data: ms })),
    ...xpEvents.slice(0, 4).map(e => ({ type:'xp', data: e })),
  ].sort((a, b) => new Date(b.data.created_at) - new Date(a.data.created_at)).slice(0, 14)

  const NAV = [
    { id:'overview', icon:'📊', label:'Overview'  },
    { id:'users',    icon:'👥', label:'Users'     },
    { id:'songs',    icon:'🎵', label:'Songs'     },
    { id:'moods',    icon:'🎭', label:'Mood logs' },
    { id:'sessions', icon:'🎙', label:'Sessions'  },
    { id:'memories', icon:'📔', label:'Memories'  },
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
            onClick={() => { setTab(n.id); setSearch('') }}
          >
            <span style={{ fontSize:20, width:20, textAlign:'center' }}>{n.icon}</span>
            {n.label}
          </div>
        ))}
        <div style={s.sidebarBottom}>
          <div style={{ fontSize:16, color:'#4a5168', lineHeight:1.5, fontFamily:'DM Mono,monospace' }}>
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
          <span style={{ fontSize:19, fontWeight:700, color:'#e8eaf0' }}>
            {NAV.find(n => n.id === tab)?.label}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {loading
              ? <span style={{ fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>loading…</span>
              : <>
                  <div style={s.liveDot} />
                  <span style={{ fontSize:16, color:'#00ffa3', fontWeight:700, fontFamily:'DM Mono,monospace' }}>LIVE</span>
                </>
            }
            <button style={s.refreshBtn} onClick={loadData} disabled={loading}>↻ Refresh</button>
          </div>
        </div>

        <div style={s.content}>

          {/* ══ OVERVIEW ══ */}
          {tab === 'overview' && (
            <>
              <div style={{ ...s.statsGrid, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                <StatCard label="Total Users"     value={profiles.length} sub="profiles"                accent="#00e5ff" />
                <StatCard label="Songs"           value={songs.length}    sub={`${favoritesCount} favourites · ${coversCount} covers`} accent="#00ffa3" />
                <StatCard label="Mood Logs"       value={moods.length}    sub="detections saved"        accent="#7c5ce7" />
                <StatCard label="Co-create"       value={moodSessions.length} sub="mood_sessions rows" accent="#c084fc" />
                <StatCard label="XP Total"        value={totalXp}         sub={`${xpEvents.length} xp_events`} accent="#ffd93d" />
                <StatCard label="Memory Capsules" value={memoriesCount}   sub="songs with memory"       accent="#f472b6" />
                <StatCard label="Active Streaks"  value={activeStreaks}   sub={`${rewards.length} reward rows`} accent="#f59e0b" />
              </div>

              <div style={{ ...s.chartsRow, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                <div style={s.chartCard}>
                  <div style={s.chartTitle}>Database tables (row counts)</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {dbInventory.map(row => (
                      <div key={row.table} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:17 }}>
                        <span style={{ color:'#e8eaf0' }}>{row.icon} {row.table}</span>
                        <span style={{ fontFamily:'DM Mono,monospace', color:'#00e5ff', fontWeight:700 }}>{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={s.chartCard}>
                  <div style={s.chartTitle}>Plans (profiles)</div>
                  <BarChart
                    counts={planCounts}
                    colors={{ free:'#4a5168', groove:'#7c5ce7', studio:'#f59e0b' }}
                    labelMap={{ free:'Free', groove:'Groove', studio:'Studio' }}
                  />
                </div>
                <div style={s.chartCard}>
                  <div style={s.chartTitle}>Songs by Region</div>
                  <BarChart counts={regionCounts} colors={REGION_COLORS} emojis={REGION_EMOJI} />
                </div>
                <div style={s.chartCard}>
                  <div style={s.chartTitle}>Mood emotions (logs)</div>
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
                <div style={s.chartCard}>
                  <div style={s.chartTitle}>XP by action</div>
                  <BarChart
                    counts={xpByAction}
                    colors={{}}
                    labelMap={{}}
                  />
                </div>
              </div>

              <div style={s.tableWrap}>
                <div style={s.tableSearch}>
                  <span style={{ fontSize:18, fontWeight:800, color:'#e8eaf0' }}>Recent Activity</span>
                </div>
                <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:0 }}>
                  {recentActivity.length === 0
                    ? <div style={s.emptyState}>No activity yet</div>
                    : recentActivity.map((r, i) => {
                        const meta = {
                          song:    { color:'#00ffa3', icon:'🎵', label: d => `Song · ${d.region || '?'} · ${d.emotion || '?'}` },
                          mood:    { color:'#7c5ce7', icon:'🎭', label: d => `Mood log · ${d.emotion || '?'} · ${d.language || '?'}` },
                          session: { color:'#c084fc', icon:'🎙', label: d => `Co-create session · ${d.mood_label || d.emotion || '?'}` },
                          xp:      { color:'#00e5ff', icon:'⚡', label: d => `XP +${d.xp || 0} · ${d.action || '?'}` },
                        }[r.type] || { color:'#4a5168', icon:'•', label: () => 'Activity' }
                        const user  = emailOf[r.data.user_id] || r.data.user_id?.slice(0, 8) + '…' || 'anon'
                        return (
                          <div key={i} style={s.timelineItem}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:meta.color, boxShadow:`0 0 6px ${meta.color}`, flexShrink:0, marginTop:4 }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:17, fontWeight:600, color:'#e8eaf0' }}>
                                {meta.icon} {meta.label(r.data)}
                              </div>
                              <div style={{ fontSize:15, color:'#4a5168', fontFamily:'DM Mono,monospace', marginTop:2 }}>
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
                  autoComplete="off"
                  spellCheck={false}
                />
                <span style={{ marginLeft:'auto', fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                  {filteredUsers.length} users
                </span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                      {['User','Region','Plan','XP','Streak','Songs','Moods','Joined','Last Active','Actions'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0
                      ? <tr><td colSpan={10} style={s.emptyState}>No users found</td></tr>
                      : filteredUsers.map(u => {
                          const streak   = u.reward?.streak || 0
                          const plan     = u.plan
                          const xpPct    = Math.min((u.xp || 0) / 1000 * 100, 100)
                          const lastMood = moods.find(m => m.user_id === u.id)
                          return (
                            <tr key={u.id} style={s.tr}>
                              <td style={s.td}>
                                <div style={{ fontWeight:600, color:'#e8eaf0', fontSize:17 }}>{u.email || '—'}</div>
                                <div style={{ fontSize:15, color:'#4a5168', fontFamily:'DM Mono,monospace', marginTop:2 }}>{u.id?.slice(0, 12)}…</div>
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
                                  <span style={{ fontSize:16, fontWeight:700, color:'#7c5ce7', fontFamily:'DM Mono,monospace', minWidth:36 }}>{u.xp || 0}</span>
                                  <div style={{ flex:1, height:4, background:'rgba(255,255,255,.07)', borderRadius:2, overflow:'hidden', maxWidth:80 }}>
                                    <div style={{ height:'100%', background:'#7c5ce7', borderRadius:2, width:`${xpPct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td style={s.td}>
                                {streak > 0
                                  ? <span style={{ fontSize:16, fontFamily:'DM Mono,monospace' }}>🔥 {streak}d</span>
                                  : <span style={{ color:'#4a5168' }}>—</span>}
                              </td>
                              <td style={{ ...s.td, fontWeight:700, color:'#00ffa3' }}>{u.songs}</td>
                              <td style={{ ...s.td, color:'#7c5ce7' }}>{u.moods}</td>
                              <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtTime(u.created_at)}</td>
                              <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{lastMood ? fmtTime(lastMood.created_at) : '—'}</td>
                              <td style={s.td}>
                                <button
                                  style={{ ...s.iconBtn, color:'#ff6b6b' }}
                                  title="Delete user permanently"
                                  disabled={u.email === ADMIN_EMAIL}
                                  onClick={() => deleteUserAdmin(u)}
                                >
                                  🗑 Delete
                                </button>
                              </td>
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
                <input
                  style={s.searchInput}
                  placeholder="Search songs, user, mood, region…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span style={{ marginLeft:'auto', fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                  {filteredSongs.length} / {songs.length} songs
                </span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                      {['User','Title','Region','Emotion','Language','Artist','Mood','Memory','Cover','Valence','Created','Actions'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSongs.length === 0
                      ? <tr><td colSpan={12} style={s.emptyState}>No songs found</td></tr>
                      : filteredSongs.map(song => (
                          <tr key={song.id} style={s.tr}>
                            <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                              {emailOf[song.user_id] || song.user_id?.slice(0, 10) || '—'}
                            </td>
                            <td style={s.td}>
                              {editingSongId === song.id ? (
                                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                                  <input
                                    style={{ ...s.searchInput, width:140, padding:'4px 8px' }}
                                    value={editSongTitle}
                                    onChange={e => setEditSongTitle(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveSongTitleAdmin(song.id); if (e.key === 'Escape') setEditingSongId(null) }}
                                    autoFocus
                                  />
                                  <button style={s.iconBtn} onClick={() => saveSongTitleAdmin(song.id)}>✓</button>
                                  <button style={s.iconBtn} onClick={() => setEditingSongId(null)}>✕</button>
                                </div>
                              ) : (
                                <span style={{ fontSize:17, color:'#e8eaf0' }}>
                                  {song.is_favorite ? '★ ' : ''}{song.title || song.mood_label || '—'}
                                </span>
                              )}
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
                            <td style={{ ...s.td, fontSize:16, color:'#4a5168' }}>{song.artist_label || '—'}</td>
                            <td style={{ ...s.td, fontSize:16 }}>{song.mood_label || '—'}</td>
                            <td style={{ ...s.td, fontSize:16, color: songHasMemory(song) ? '#f472b6' : '#4a5168' }}>
                              {songHasMemory(song) ? `📔 ${song.memory_location || 'saved'}` : '—'}
                            </td>
                            <td style={{ ...s.td, fontSize:16 }}>{song.cover_url ? '🎨' : '—'}</td>
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:16, color:(song.valence||0.5)>0.5?'#00ffa3':'#ff6b6b' }}>
                              {song.valence?.toFixed(2) || '—'}
                            </td>
                            <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtTime(song.created_at)}</td>
                            <td style={s.td}>
                              <div style={{ display:'flex', gap:4 }}>
                                <button
                                  style={{ ...s.iconBtn, color: song.is_favorite ? '#fbbf24' : undefined }}
                                  title={song.is_favorite ? 'Remove from favourites' : 'Add to favourites'}
                                  onClick={() => toggleFavoriteAdmin(song)}
                                >{song.is_favorite ? '❤️' : '🤍'}</button>
                                <button
                                  style={s.iconBtn}
                                  title="Rename"
                                  onClick={() => { setEditingSongId(song.id); setEditSongTitle(song.title || song.mood_label || '') }}
                                >✎</button>
                                <button style={{ ...s.iconBtn, color:'#ff6b6b' }} title="Delete" onClick={() => deleteSongAdmin(song.id)}>🗑</button>
                              </div>
                            </td>
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
                <input
                  style={s.searchInput}
                  placeholder="Search user, emotion, transcript…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span style={{ marginLeft:'auto', fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                  {filteredMoods.length} / {moods.length} sessions
                </span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                      {['User','Emotion','Valence','Arousal','Language','Region','Confidence','Transcript','Detected At','Actions'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMoods.length === 0
                      ? <tr><td colSpan={10} style={s.emptyState}>No mood logs found</td></tr>
                      : filteredMoods.map(m => (
                          <tr key={m.id} style={s.tr}>
                            <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                              {emailOf[m.user_id] || m.user_id?.slice(0, 10) || '—'}
                            </td>
                            <td style={{ ...s.td, fontWeight:700, color: EMOTION_COLORS[m.emotion] || '#fff' }}>
                              {EMOTION_EMOJI[m.emotion] || ''} {m.emotion || '—'}
                            </td>
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:16, color:(m.valence||0.5)>0.5?'#00ffa3':'#ff6b6b' }}>
                              {m.valence?.toFixed(2) || '—'}
                            </td>
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:16 }}>{m.arousal?.toFixed(2) || '—'}</td>
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
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:16, color:(m.confidence||0)>0.7?'#00ffa3':'#4a5168' }}>
                              {m.confidence?.toFixed(2) || '—'}
                            </td>
                            <td style={{ ...s.td, fontSize:16, color:'#4a5168', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                                title={m.transcript || ''}>
                              {m.transcript || '—'}
                            </td>
                            <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtTime(m.created_at)}</td>
                            <td style={s.td}>
                              <button style={{ ...s.iconBtn, color:'#ff6b6b' }} title="Delete" onClick={() => deleteMoodAdmin(m.id)}>🗑</button>
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ CO-CREATE SESSIONS ══ */}
          {tab === 'sessions' && (
            <div style={s.tableWrap}>
              <div style={s.tableSearch}>
                <input
                  style={s.searchInput}
                  placeholder="Search user, mood label…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span style={{ marginLeft:'auto', fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                  {filteredSessions.length} / {moodSessions.length} sessions
                </span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                      {['User','Mood label','Emotion','Valence','Energy','Created'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.length === 0
                      ? <tr><td colSpan={6} style={s.emptyState}>No mood_sessions rows</td></tr>
                      : filteredSessions.map(ms => (
                          <tr key={ms.id} style={s.tr}>
                            <td style={{ ...s.td, fontSize:16, fontFamily:'DM Mono,monospace', color:'#4a5168' }}>
                              {emailOf[ms.user_id] || ms.email || ms.user_id?.slice(0, 10) || '—'}
                            </td>
                            <td style={s.td}>{ms.mood_label || '—'}</td>
                            <td style={{ ...s.td, fontWeight:700, color: EMOTION_COLORS[ms.emotion] || '#fff' }}>
                              {EMOTION_EMOJI[ms.emotion] || ''} {ms.emotion || '—'}
                            </td>
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:16 }}>{ms.valence?.toFixed(2) ?? '—'}</td>
                            <td style={{ ...s.td, fontFamily:'DM Mono,monospace', fontSize:16 }}>{ms.energy?.toFixed(2) ?? '—'}</td>
                            <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtTime(ms.created_at)}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ MEMORY CAPSULES ══ */}
          {tab === 'memories' && (
            <div style={s.tableWrap}>
              <div style={s.tableSearch}>
                <input
                  style={s.searchInput}
                  placeholder="Search place, note, user…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span style={{ marginLeft:'auto', fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                  {filteredMemories.length} / {memorySongs.length} capsules
                </span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                      {['User','Title','Place','Note','Photo','Mood','Created'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMemories.length === 0
                      ? <tr><td colSpan={7} style={s.emptyState}>No memory capsules saved yet</td></tr>
                      : filteredMemories.map(song => (
                          <tr key={song.id} style={s.tr}>
                            <td style={{ ...s.td, fontSize:16, fontFamily:'DM Mono,monospace', color:'#4a5168' }}>
                              {emailOf[song.user_id] || song.user_id?.slice(0, 10) || '—'}
                            </td>
                            <td style={s.td}>{song.title || song.mood_label || '—'}</td>
                            <td style={s.td}>{song.memory_location || '—'}</td>
                            <td style={{ ...s.td, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={song.memory_note || ''}>
                              {song.memory_note || '—'}
                            </td>
                            <td style={s.td}>{song.memory_photo_url ? '📷' : '—'}</td>
                            <td style={s.td}>{song.mood_label || song.emotion || '—'}</td>
                            <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtTime(song.created_at)}</td>
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
                  <input
                    style={s.searchInput}
                    placeholder="Search user email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  />
                  <span style={{ marginLeft:'auto', fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                    {filteredRewards.length} / {rewards.length} users
                  </span>
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
                      {filteredRewards.length === 0
                        ? <tr><td colSpan={5} style={s.emptyState}>No rewards found</td></tr>
                        : filteredRewards.map(r => (
                            <tr key={r.user_id} style={s.tr}>
                              <td style={{ ...s.td, fontSize:16, fontFamily:'DM Mono,monospace', color:'#4a5168' }}>
                                {emailOf[r.user_id] || r.user_id?.slice(0, 12) || '—'}
                              </td>
                              <td style={{ ...s.td, fontWeight:700, color:'#7c5ce7', fontFamily:'DM Mono,monospace' }}>{r.points || 0} pts</td>
                              <td style={s.td}>
                                {(r.streak || 0) > 0
                                  ? <span style={{ fontSize:16, fontFamily:'DM Mono,monospace' }}>🔥 {r.streak}d</span>
                                  : <span style={{ color:'#4a5168' }}>—</span>}
                              </td>
                              <td style={s.td}>
                                {(r.badges || []).length > 0
                                  ? (r.badges || []).map(b => (
                                      <span key={b} style={{ ...s.tag, background:'rgba(124,92,231,.15)', color:'#a78bfa', border:'1px solid rgba(124,92,231,.25)', margin:'1px 2px' }}>{b}</span>
                                    ))
                                  : <span style={{ color:'#4a5168' }}>—</span>}
                              </td>
                              <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{r.last_checkin || '—'}</td>
                            </tr>
                          ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={s.tableWrap}>
                <div style={s.tableSearch}>
                  <input
                    style={s.searchInput}
                    placeholder="Search user or action…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  />
                  <span style={{ marginLeft:'auto', fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>
                    {filteredXpEvents.length} / {xpEvents.length} events
                  </span>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                        {['User','Action','XP','Time','Actions'].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredXpEvents.length === 0
                        ? <tr><td colSpan={5} style={s.emptyState}>No XP events found</td></tr>
                        : filteredXpEvents.slice(0, 50).map(e => (
                            <tr key={e.id} style={s.tr}>
                              <td style={{ ...s.td, fontSize:16, fontFamily:'DM Mono,monospace', color:'#4a5168' }}>
                                {emailOf[e.user_id] || e.user_id?.slice(0, 12) || '—'}
                              </td>
                              <td style={{ ...s.td, fontSize:17 }}>{e.action || '—'}</td>
                              <td style={{ ...s.td, fontWeight:700, color:'#00e5ff', fontFamily:'DM Mono,monospace' }}>+{e.xp || 0}</td>
                              <td style={{ ...s.td, fontSize:16, color:'#4a5168', fontFamily:'DM Mono,monospace' }}>{fmtTime(e.created_at)}</td>
                              <td style={s.td}>
                                <button style={{ ...s.iconBtn, color:'#ff6b6b' }} title="Delete" onClick={() => deleteXpEventAdmin(e.id)}>🗑</button>
                              </td>
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
  logo:        { padding:'0 20px 28px', fontSize:25, fontWeight:900, letterSpacing:'-0.5px', color:'#00e5ff', borderBottom:'1px solid rgba(255,255,255,.07)', marginBottom:16 },
  navItem:     { display:'flex', alignItems:'center', gap:10, padding:'10px 20px', fontSize:18, fontWeight:600, cursor:'pointer', borderLeft:'2px solid transparent', transition:'all .15s', letterSpacing:'.02em' },
  sidebarBottom: { marginTop:'auto', padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', gap:10 },
  exitBtn:     { background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#4a5168', fontSize:16, fontWeight:700, padding:'7px 12px', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  main:        { flex:1, overflowX:'hidden', display:'flex', flexDirection:'column' },
  topbar:      { height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', borderBottom:'1px solid rgba(255,255,255,.07)', background:'#0e1320', position:'sticky', top:0, zIndex:10 },
  liveDot:     { width:7, height:7, borderRadius:'50%', background:'#00ffa3', boxShadow:'0 0 8px #00ffa3', animation:'pulse 2s infinite' },
  refreshBtn:  { padding:'6px 14px', borderRadius:8, background:'rgba(0,229,255,.1)', border:'1px solid rgba(0,229,255,.25)', color:'#00e5ff', fontSize:17, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  content:     { padding:28, flex:1, width:'100%', maxWidth:'none' },
  statsGrid:   { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28 },
  statCard:    { background:'#0e1320', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'18px 20px', position:'relative', overflow:'hidden' },
  statLabel:   { fontSize:15, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 },
  statValue:   { fontSize:37, fontWeight:900, lineHeight:1, marginBottom:4 },
  statSub:     { fontSize:16, color:'#4a5168' },
  chartsRow:   { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:28 },
  chartCard:   { background:'#0e1320', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'18px 20px' },
  chartTitle:  { fontSize:16, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 },
  tableWrap:   { background:'#0e1320', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, overflow:'hidden', marginBottom:28 },
  tableSearch: { padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', gap:10 },
  searchInput: { background:'#141926', border:'1px solid rgba(255,255,255,.07)', borderRadius:8, padding:'7px 12px', color:'#e8eaf0', fontSize:17, fontFamily:'DM Mono,monospace', outline:'none', width:260 },
  iconBtn:     { background:'#141926', border:'1px solid rgba(255,255,255,.1)', borderRadius:6, padding:'4px 8px', color:'#8b9ab0', fontSize:17, cursor:'pointer' },
  th:          { padding:'10px 16px', textAlign:'left', fontSize:15, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'.08em', fontFamily:'DM Mono,monospace', whiteSpace:'nowrap' },
  td:          { padding:'12px 16px', fontSize:17, borderBottom:'1px solid rgba(255,255,255,.03)' },
  tr:          {},
  tag:         { display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6, fontSize:15, fontWeight:700, fontFamily:'DM Mono,monospace', whiteSpace:'nowrap' },
  timelineItem:{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.05)' },
  emptyState:  { padding:32, textAlign:'center', color:'#4a5168', fontSize:17 },

  // Login
  loginWrap:   { minHeight:'100vh', background:'#080b12', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans','Segoe UI',sans-serif" },
  loginCard:   { background:'#0e1320', border:'1px solid rgba(255,255,255,.07)', borderRadius:20, padding:'40px 36px', width:360, display:'flex', flexDirection:'column', gap:14 },
  loginLogo:   { fontSize:27, fontWeight:900, color:'#00e5ff', letterSpacing:'-0.5px', marginBottom:4 },
  loginSub:    { fontSize:18, color:'#4a5168', marginTop:-10, marginBottom:8 },
  input:       { background:'rgba(0,0,0,.3)', border:'1px solid rgba(255,255,255,.07)', borderRadius:8, padding:'10px 14px', color:'#e8eaf0', fontSize:18, fontFamily:'DM Mono,monospace', outline:'none', width:'100%' },
  loginError:  { fontSize:17, color:'#ff6b6b', background:'rgba(255,107,107,.08)', border:'1px solid rgba(255,107,107,.2)', borderRadius:8, padding:'8px 12px' },
  loginBtn:    { background:'#00e5ff', border:'none', borderRadius:10, padding:'12px', color:'#000', fontSize:19, fontWeight:800, cursor:'pointer', fontFamily:'inherit', transition:'opacity .15s', marginTop:4 },
}