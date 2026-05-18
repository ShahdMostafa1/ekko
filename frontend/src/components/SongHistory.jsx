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
  const [expanded, setExpanded] = useState(null)
  const [playing, setPlaying]   = useState(null)
  const audioRef                = useRef(null)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    fetch(`http://localhost:8000/music/history/${userId}`)
      .then(r => r.json())
      .then(data => {
        setSongs(data.songs || [])
        setByRegion(data.by_region || {})
      })
      .catch(e => console.error('History load failed:', e))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

  const togglePlay = (song) => {
    if (playing === song.id) {
      audioRef.current?.pause()
      setPlaying(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    audioRef.current = new Audio(song.audio_url)
    audioRef.current.play().catch(() => {})
    audioRef.current.onended = () => setPlaying(null)
    setPlaying(song.id)
  }

  const filteredSongs = filter === 'all' ? songs : (byRegion[filter] || [])
  const regions       = Object.keys(byRegion)

  const SongCard = ({ song }) => {
    const meta    = REGION_META[song.region] || REGION_META.global
    const isOpen  = expanded === song.id
    const isPlay  = playing  === song.id
    const dateStr = new Date(song.created_at).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })

    return (
      <div className="sh-card" style={{ '--rc': meta.color }}>
        <div className="sh-card-top" onClick={() => setExpanded(isOpen ? null : song.id)}>
          <div className="sh-left">
            <span className="sh-emotion">{EMOTION_EMOJI[song.emotion] || '🎵'}</span>
            <div className="sh-info">
              <p className="sh-mood">{song.mood_label || song.emotion}</p>
              <p className="sh-meta">
                <span className="sh-region">{meta.emoji} {meta.label}</span>
                <span className="sh-dot">·</span>
                <span className="sh-date">{dateStr}</span>
                {song.language && song.language !== 'English' && (
                  <>
                    <span className="sh-dot">·</span>
                    <span className="sh-lang">{song.language}</span>
                  </>
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

        {isOpen && (
          <div className="sh-expanded">
            {song.lyrics && (
              <div className="sh-lyrics-wrap">
                <p className="sh-section-label">Lyrics</p>
                <pre className="sh-lyrics">{song.lyrics}</pre>
              </div>
            )}
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
            {song.reasoning && (
              <p className="sh-reasoning">💭 {song.reasoning}</p>
            )}
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

      {regions.length > 1 && (
        <div className="sh-filters">
          <button
            className={`sh-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
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
        <div className="sh-loading">
          <div className="sh-spinner" />
          <p>Loading your songs…</p>
        </div>
      ) : filteredSongs.length === 0 ? (
        <div className="sh-empty">
          <p className="sh-empty-icon">🎵</p>
          <p className="sh-empty-title">No songs yet</p>
          <p className="sh-empty-sub">Share a mood to create your first track.</p>
        </div>
      ) : (
        <div className="sh-list">
          {filteredSongs.map(song => <SongCard key={song.id} song={song} />)}
        </div>
      )}

      <style>{`
        .sh-root {
          font-family: 'DM Sans','Segoe UI',sans-serif;
          max-width: 440px; margin: 0 auto; padding-bottom: 40px;
        }
        .sh-header { text-align: center; margin-bottom: 24px; }
        .sh-headline { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 4px; }
        .sh-headline em { font-style: italic; color: #b09ee0; }
        .sh-sub { font-size: 13px; color: #8b7eb8; margin: 0; }

        .sh-filters {
          display: flex; flex-wrap: wrap; gap: 6px;
          margin-bottom: 16px;
        }
        .sh-pill {
          padding: 6px 14px;
          border: 1.5px solid rgba(176,158,224,.2);
          border-radius: 20px; background: transparent;
          color: #b09ee0; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all .18s;
        }
        .sh-pill.active {
          background: color-mix(in srgb, var(--pc, #7c5ce7) 18%, transparent);
          border-color: var(--pc, #7c5ce7); color: #fff;
        }

        .sh-list { display: flex; flex-direction: column; gap: 10px; }
        .sh-card {
          background: rgba(255,255,255,.05);
          border: 1.5px solid rgba(176,158,224,.12);
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
        .sh-left { display: flex; align-items: center; gap: 12px; }
        .sh-emotion { font-size: 26px; line-height: 1; }
        .sh-mood { font-size: 14px; font-weight: 600; color: #e0d8ff; margin: 0 0 3px; }
        .sh-meta {
          font-size: 11px; color: #8b7eb8; margin: 0;
          display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
        }
        .sh-region { color: var(--rc); font-weight: 600; }
        .sh-dot { opacity: .4; }
        .sh-lang { color: #7c5ce7; font-weight: 600; }
        .sh-right { display: flex; align-items: center; gap: 10px; }
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
          max-height: 200px; overflow-y: auto; padding-right: 4px;
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
        .sh-empty-icon { font-size: 44px; margin: 0 0 14px; }
        .sh-empty-title { font-size: 17px; font-weight: 600; color: #c4b5f0; margin: 0 0 6px; }
        .sh-empty-sub { font-size: 13px; color: #8b7eb8; margin: 0; }
      `}</style>
    </div>
  )
}