import { useState, useEffect, useRef } from 'react'

const REGION_META = {
  arabic:      { emoji: '🌙', label: 'Arabic',      color: '#c9a84c' },
  west_africa: { emoji: '🥁', label: 'West Africa', color: '#e07b39' },
  india:       { emoji: '🪔', label: 'India',       color: '#d4518a' },
  east_asia:   { emoji: '🌸', label: 'East Asia',   color: '#7eb8c9' },
  latin:       { emoji: '🎺', label: 'Latin',       color: '#e04f4f' },
  europe:      { emoji: '🎻', label: 'Europe',      color: '#6e8efb' },
  global:      { emoji: '🌍', label: 'Global Mix',  color: '#7c5ce7' },
}

const EMOTION_EMOJI = {
  joy: '☀️', sadness: '🌧️', anger: '🔥',
  fear: '🌀', surprise: '⚡', disgust: '🌫️', neutral: '🌿',
}

export default function SongHistory({ userId = '' }) {
  const [songs, setSongs]       = useState([])
  const [byRegion, setByRegion] = useState({})
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [sortBy, setSortBy]     = useState('newest')   // 'newest' | 'oldest' | 'energy'
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(null)
  const [playing, setPlaying]   = useState(null)
  const [playProgress, setPlayProgress] = useState({}) // id → 0..1
  const audioRef                = useRef(null)
  const rafRef                  = useRef(null)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    fetch(`${import.meta.env.VITE_API_URL}/music/history/${userId}`)
      .then(r => r.json())
      .then(data => { setSongs(data.songs || []); setByRegion(data.by_region || {}) })
      .catch(e => console.error('History load failed:', e))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => () => {
    audioRef.current?.pause()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const trackProgress = (id) => {
    const tick = () => {
      const el = audioRef.current
      if (!el || el.paused) return
      const p = el.duration ? el.currentTime / el.duration : 0
      setPlayProgress(prev => ({ ...prev, [id]: p }))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const togglePlay = (song) => {
    if (playing === song.id) {
      audioRef.current?.pause()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setPlaying(null)
      return
    }
    if (audioRef.current) { audioRef.current.pause(); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    audioRef.current = new Audio(song.audio_url)
    audioRef.current.play().catch(() => {})
    audioRef.current.onended = () => {
      setPlaying(null)
      setPlayProgress(prev => ({ ...prev, [song.id]: 0 }))
    }
    setPlaying(song.id)
    setPlayProgress(prev => ({ ...prev, [song.id]: 0 }))
    trackProgress(song.id)
  }

  // ── Filter + sort + search ─────────────────────────────────
  const base = filter === 'all' ? songs : (byRegion[filter] || [])
  const searched = search.trim()
    ? base.filter(s => {
        const q = search.toLowerCase()
        return (
          (s.title       || '').toLowerCase().includes(q) ||
          (s.mood_label  || '').toLowerCase().includes(q) ||
          (s.emotion     || '').toLowerCase().includes(q) ||
          (s.lyrics      || '').toLowerCase().includes(q)
        )
      })
    : base
  const filteredSongs = [...searched].sort((a, b) => {
    if (sortBy === 'newest')  return new Date(b.created_at) - new Date(a.created_at)
    if (sortBy === 'oldest')  return new Date(a.created_at) - new Date(b.created_at)
    if (sortBy === 'energy')  return (b.energy ?? 0) - (a.energy ?? 0)
    return 0
  })

  const regions = Object.keys(byRegion)

  const SongCard = ({ song }) => {
    const meta    = REGION_META[song.region] || REGION_META.global
    const isOpen  = expanded === song.id
    const isPlay  = playing  === song.id
    const prog    = playProgress[song.id] || 0
    const dateStr = new Date(song.created_at).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    const displayName = song.title || song.mood_label || song.emotion

    return (
      <div className="sh-card" style={{ '--rc': meta.color }}>
        <div className="sh-card-top" onClick={() => setExpanded(isOpen ? null : song.id)}>
          <div className="sh-left">
            <span className="sh-emotion">{EMOTION_EMOJI[song.emotion] || '🎵'}</span>
            <div className="sh-info">
              <p className="sh-mood">{displayName}</p>
              <p className="sh-meta">
                <span className="sh-region">{meta.emoji} {meta.label}</span>
                <span className="sh-dot">·</span>
                <span className="sh-date">{dateStr}</span>
                {song.language && song.language !== 'English' && (
                  <><span className="sh-dot">·</span><span className="sh-lang">{song.language}</span></>
                )}
                {song.title && song.mood_label && (
                  <><span className="sh-dot">·</span><span className="sh-mood-sub">{song.mood_label}</span></>
                )}
              </p>
            </div>
          </div>
          <div className="sh-right">
            {song.audio_url && (
              <button
                className={`sh-play ${isPlay ? 'playing' : ''}`}
                onClick={e => { e.stopPropagation(); togglePlay(song) }}
                aria-label={isPlay ? 'Pause' : 'Play'}
              >
                {isPlay ? '⏸' : '▶'}
              </button>
            )}
            <span className="sh-chevron">{isOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* ── Progress bar shown when playing ── */}
        {isPlay && (
          <div className="sh-play-progress-wrap">
            <div className="sh-play-progress-fill" style={{ width: `${prog * 100}%`, background: meta.color }} />
          </div>
        )}

        {isOpen && (
          <div className="sh-expanded">
            {song.lyrics && (
              <div className="sh-lyrics-wrap">
                <p className="sh-section-label">Lyrics</p>
                {/* ── TALLER lyrics scroll area ── */}
                <pre className="sh-lyrics">{song.lyrics}</pre>
              </div>
            )}

            {/* Valence + Energy bars */}
            <div className="sh-bars">
              {[
                { label: 'Valence', val: song.valence ?? 0.5 },
                { label: 'Energy',  val: song.energy  ?? 0.5 },
              ].map(({ label, val }) => (
                <div key={label} className="sh-bar-row">
                  <span className="sh-bar-label">{label}</span>
                  <div className="sh-bar-bg">
                    <div className="sh-bar-fill" style={{ width: `${val * 100}%`, background: meta.color }} />
                  </div>
                  <span className="sh-bar-val">{Math.round(val * 100)}%</span>
                </div>
              ))}
            </div>

            {song.reasoning  && <p className="sh-reasoning">💭 {song.reasoning}</p>}
            {song.artist_label && <p className="sh-artist">🎤 {song.artist_label} style</p>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="sh-root">
      <div className="sh-header">
        <h2 className="sh-headline">Your <em>songs</em></h2>
        <p className="sh-sub">
          {loading ? 'Loading…' : `${songs.length} track${songs.length !== 1 ? 's' : ''} created`}
        </p>
      </div>

      {/* ── Search bar ── */}
      <div className="sh-search-row">
        <div className="sh-search-wrap">
          <span className="sh-search-icon">🔍</span>
          <input
            className="sh-search"
            type="text"
            placeholder="Search songs, moods, lyrics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="sh-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
        <select
          className="sh-sort"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="energy">Highest energy</option>
        </select>
      </div>

      {/* ── Region filter pills ── */}
      {regions.length > 1 && (
        <div className="sh-filters">
          <button className={`sh-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            All ({songs.length})
          </button>
          {regions.map(r => {
            const m = REGION_META[r] || REGION_META.global
            return (
              <button
                key={r}
                className={`sh-pill ${filter === r ? 'active' : ''}`}
                style={filter === r ? { '--pc': m.color } : {}}
                onClick={() => setFilter(r)}
              >
                {m.emoji} {m.label} ({byRegion[r]?.length || 0})
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="sh-loading"><div className="sh-spinner" /><p>Loading your songs…</p></div>
      ) : filteredSongs.length === 0 ? (
        <div className="sh-empty">
          <p className="sh-empty-icon">{search ? '🔍' : '🎵'}</p>
          <p className="sh-empty-title">{search ? 'No results found' : 'No songs yet'}</p>
          <p className="sh-empty-sub">
            {search ? `No songs match "${search}"` : 'Share a mood to create your first track.'}
          </p>
        </div>
      ) : (
        <div className="sh-list">
          {filteredSongs.map(song => <SongCard key={song.id} song={song} />)}
        </div>
      )}

      <style>{`
        .sh-root {
          font-family: 'DM Sans','Segoe UI',sans-serif;
          max-width: 480px; margin: 0 auto; padding-bottom: 40px;
        }
        .sh-header { text-align: center; margin-bottom: 20px; }
        .sh-headline { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 4px; }
        .sh-headline em { font-style: italic; color: #b09ee0; }
        .sh-sub { font-size: 13px; color: #8b7eb8; margin: 0; }

        /* ── Search + sort row ── */
        .sh-search-row {
          display: flex; gap: 8px; margin-bottom: 14px; align-items: center;
        }
        .sh-search-wrap {
          flex: 1; position: relative; display: flex; align-items: center;
        }
        .sh-search-icon {
          position: absolute; left: 12px; font-size: 14px; pointer-events: none; opacity: .6;
        }
        .sh-search {
          width: 100%; box-sizing: border-box;
          padding: 9px 36px 9px 34px;
          background: rgba(255,255,255,.06);
          border: 1.5px solid rgba(176,158,224,.15);
          border-radius: 12px; color: #e0d8ff;
          font-size: 13px; font-family: inherit;
          outline: none; transition: border-color .18s;
        }
        .sh-search::placeholder { color: #6b5f8a; }
        .sh-search:focus { border-color: rgba(124,92,231,.5); }
        .sh-search-clear {
          position: absolute; right: 10px;
          background: transparent; border: none;
          color: #6b5f8a; font-size: 13px; cursor: pointer; padding: 2px 4px;
        }
        .sh-sort {
          padding: 9px 10px;
          background: rgba(255,255,255,.06);
          border: 1.5px solid rgba(176,158,224,.15);
          border-radius: 12px; color: #b09ee0;
          font-size: 12px; font-family: inherit;
          cursor: pointer; outline: none;
          appearance: none; -webkit-appearance: none;
          white-space: nowrap;
        }

        /* ── Filter pills ── */
        .sh-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
        .sh-pill {
          padding: 6px 14px; border: 1.5px solid rgba(176,158,224,.2);
          border-radius: 20px; background: transparent;
          color: #b09ee0; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all .18s;
        }
        .sh-pill.active {
          background: color-mix(in srgb, var(--pc, #7c5ce7) 18%, transparent);
          border-color: var(--pc, #7c5ce7); color: #fff;
        }

        /* ── Cards ── */
        .sh-list { display: flex; flex-direction: column; gap: 10px; }
        .sh-card {
          background: rgba(255,255,255,.05);
          border: 1.5px solid rgba(176,158,224,.1);
          border-radius: 16px; overflow: hidden;
          transition: border-color .2s, box-shadow .2s;
        }
        .sh-card:hover {
          border-color: var(--rc);
          box-shadow: 0 4px 20px color-mix(in srgb, var(--rc) 15%, transparent);
        }
        .sh-card-top {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 14px 16px; cursor: pointer;
        }
        .sh-left  { display: flex; align-items: center; gap: 12px; }
        .sh-emotion { font-size: 26px; line-height: 1; }
        .sh-mood { font-size: 14px; font-weight: 700; color: #e0d8ff; margin: 0 0 3px; }
        .sh-meta {
          font-size: 11px; color: #8b7eb8; margin: 0;
          display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
        }
        .sh-region  { color: var(--rc); font-weight: 600; }
        .sh-dot     { opacity: .4; }
        .sh-lang    { color: #7c5ce7; font-weight: 600; }
        .sh-mood-sub{ color: #6b5f8a; font-style: italic; }
        .sh-right   { display: flex; align-items: center; gap: 10px; }
        .sh-play {
          width: 38px; height: 38px; border-radius: 50%;
          border: 1.5px solid var(--rc);
          background: color-mix(in srgb, var(--rc) 12%, transparent);
          color: var(--rc); font-size: 13px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .18s;
        }
        .sh-play:hover { background: color-mix(in srgb, var(--rc) 28%, transparent); transform: scale(1.08); }
        .sh-play.playing { background: var(--rc); color: #fff; }
        .sh-chevron { font-size: 10px; color: #6b5f8a; }

        /* ── Progress bar when playing ── */
        .sh-play-progress-wrap {
          height: 3px; background: rgba(255,255,255,.07); width: 100%;
        }
        .sh-play-progress-fill {
          height: 100%; border-radius: 0; transition: width .15s linear;
        }

        /* ── Expanded ── */
        .sh-expanded {
          padding: 0 16px 16px;
          border-top: 1px solid rgba(176,158,224,.08);
          animation: shFadeDown .2s ease;
          display: flex; flex-direction: column; gap: 12px;
        }
        @keyframes shFadeDown {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sh-section-label {
          font-size: 10px; font-weight: 700; color: #6b5f8a;
          text-transform: uppercase; letter-spacing: .06em;
          margin: 12px 0 6px;
        }
        .sh-lyrics {
          font-family: inherit; font-size: 13px; line-height: 1.9;
          color: #c4b5f0; white-space: pre-wrap; margin: 0;
          /* ── TALLER ── */
          max-height: 280px; overflow-y: auto; padding-right: 6px;
        }
        .sh-lyrics::-webkit-scrollbar { width: 3px; }
        .sh-lyrics::-webkit-scrollbar-thumb { background: rgba(176,158,224,.25); border-radius: 2px; }
        .sh-bars { display: flex; flex-direction: column; gap: 8px; }
        .sh-bar-row { display: flex; align-items: center; gap: 8px; }
        .sh-bar-label { font-size: 11px; color: #8b7eb8; font-weight: 600; width: 52px; }
        .sh-bar-bg { flex: 1; height: 5px; background: rgba(255,255,255,.07); border-radius: 3px; overflow: hidden; }
        .sh-bar-fill { height: 100%; border-radius: 3px; transition: width .5s ease; }
        .sh-bar-val { font-size: 11px; color: #6b5f8a; font-weight: 600; width: 32px; text-align: right; }
        .sh-reasoning {
          font-size: 12px; color: #8b7eb8; font-style: italic;
          background: rgba(124,92,231,.06); border-radius: 10px;
          padding: 8px 12px; margin: 0; line-height: 1.6;
        }
        .sh-artist {
          font-size: 12px; color: #a78bfa; font-weight: 600;
          background: rgba(124,92,231,.08); border-radius: 10px;
          padding: 6px 12px; margin: 0;
        }
        .sh-loading {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 48px 0; color: #8b7eb8; font-size: 14px;
        }
        .sh-spinner {
          width: 28px; height: 28px;
          border: 2px solid rgba(124,92,231,.15);
          border-top-color: #7c5ce7;
          border-radius: 50%; animation: shSpin .8s linear infinite;
        }
        @keyframes shSpin { to { transform: rotate(360deg); } }
        .sh-empty { text-align: center; padding: 52px 20px; }
        .sh-empty-icon  { font-size: 44px; margin: 0 0 14px; }
        .sh-empty-title { font-size: 17px; font-weight: 600; color: #c4b5f0; margin: 0 0 6px; }
        .sh-empty-sub   { font-size: 13px; color: #8b7eb8; margin: 0; }
      `}</style>
    </div>
  )
}