import { useState, useEffect, useRef } from 'react'
import { applyHistoryLimit, canDownload } from '../utils/planUtils'
import { proxiedAudioUrl, openAudioUrl } from '../utils/audioProxy'
import {
  configureMobileAudio,
  fetchBlobAudioUrl,
  isMobileBrowser,
  playFromUserGesture,
  revokeBlobAudioUrl,
} from '../utils/mobileAudio'

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

export default function SongHistory({ userId = '', userPlan = 'free', onUpgrade }) {
  const [songs, setSongs]       = useState([])
  const [byRegion, setByRegion] = useState({})
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [sortBy, setSortBy]     = useState('newest')
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(null)
  const [activeSongId, setActiveSongId] = useState(null)
  const [isPlaying, setIsPlaying]       = useState(false)
  const [playProgress, setPlayProgress] = useState({})
  const [editingId, setEditingId]     = useState(null)
  const [editTitle, setEditTitle]     = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [actionError, setActionError]     = useState('')
  const audioRef                = useRef(null)
  const activeSongRef           = useRef(null)
  const rafRef                  = useRef(null)

  const API = import.meta.env.VITE_API_URL

  const normalizeSong = (song) => ({
    ...song,
    is_favorite: song.is_favorite === true || song.is_favorite === 'true',
  })

  const reloadSongs = () => {
    if (!userId) return Promise.resolve()
    return fetch(`${API}/music/history/${userId}`)
      .then(r => r.json())
      .then(data => {
        const list = (data.songs || []).map(normalizeSong)
        const grouped = {}
        Object.entries(data.by_region || {}).forEach(([region, items]) => {
          grouped[region] = items.map(normalizeSong)
        })
        setSongs(list)
        setByRegion(grouped)
      })
  }

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    reloadSongs()
      .catch(e => console.error('History load failed:', e))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => () => {
    stopProgress()
    audioRef.current?.pause()
    audioRef.current = null
    revokeBlobAudioUrl()
  }, [])

  const stopProgress = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  const clearActivePlayback = (songId) => {
    stopProgress()
    audioRef.current?.pause()
    audioRef.current = null
    activeSongRef.current = null
    revokeBlobAudioUrl()
    setActiveSongId(null)
    setIsPlaying(false)
    if (songId != null) {
      setPlayProgress(prev => ({ ...prev, [String(songId)]: 0 }))
    }
  }

  const trackProgress = (id) => {
    stopProgress()
    const tick = () => {
      const el = audioRef.current
      if (!el || el.paused) return
      const p = el.duration ? el.currentTime / el.duration : 0
      setPlayProgress(prev => ({ ...prev, [id]: p }))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const togglePlay = async (song) => {
    const songId = String(song.id)
    const streamUrl = proxiedAudioUrl(song.audio_url, song.task_id)
    if (!streamUrl) return

    if (activeSongRef.current === songId && audioRef.current) {
      if (!audioRef.current.paused) {
        clearActivePlayback(songId)
        return
      }
      const resumed = await playFromUserGesture(audioRef.current)
      if (!resumed) clearActivePlayback(songId)
      return
    }

    if (audioRef.current) clearActivePlayback(activeSongRef.current)

    let playSrc = streamUrl
    if (isMobileBrowser()) {
      const blobUrl = await fetchBlobAudioUrl(streamUrl)
      if (blobUrl) playSrc = blobUrl
    }

    const audio = configureMobileAudio(new Audio(), playSrc)
    audioRef.current = audio
    activeSongRef.current = songId
    setActiveSongId(songId)
    setPlayProgress(prev => ({ ...prev, [songId]: 0 }))

    audio.onended = () => clearActivePlayback(songId)
    audio.onpause = () => {
      stopProgress()
      setIsPlaying(false)
    }
    audio.onplay = () => {
      setIsPlaying(true)
      trackProgress(songId)
    }
    audio.onerror = async () => {
      if (audio.currentTime > 1 && !audio.paused && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        return
      }
      if (playSrc !== streamUrl) {
        clearActivePlayback(songId)
        return
      }
      const blobUrl = await fetchBlobAudioUrl(streamUrl)
      if (blobUrl) {
        configureMobileAudio(audio, blobUrl)
        if (await playFromUserGesture(audio)) {
          setIsPlaying(true)
          trackProgress(songId)
          return
        }
      }
      clearActivePlayback(songId)
    }

    if (await playFromUserGesture(audio)) {
      setIsPlaying(true)
      trackProgress(songId)
      return
    }

    if (playSrc === streamUrl && isMobileBrowser()) {
      const blobUrl = await fetchBlobAudioUrl(streamUrl)
      if (blobUrl) {
        configureMobileAudio(audio, blobUrl)
        if (await playFromUserGesture(audio)) {
          setIsPlaying(true)
          trackProgress(songId)
          return
        }
      }
    }
    clearActivePlayback(songId)
  }

  const patchSong = async (songId, body) => {
    const res = await fetch(`${API}/music/${songId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, ...body }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  const toggleFavorite = async (song, e) => {
    e?.stopPropagation()
    if (!userId) {
      setActionError('Sign in to save favourites.')
      return
    }
    if (actionLoading) return
    setActionLoading(song.id)
    setActionError('')
    const next = !song.is_favorite
    try {
      await patchSong(song.id, { is_favorite: next })
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, is_favorite: next } : s))
      setByRegion(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(r => {
          updated[r] = updated[r].map(s => s.id === song.id ? { ...s, is_favorite: next } : s)
        })
        return updated
      })
    } catch (err) {
      console.error('Favorite toggle failed:', err)
      setActionError('Could not update favourite. Restart the backend and try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const deleteSong = async (song, e) => {
    e?.stopPropagation()
    if (!userId || actionLoading) return
    if (!window.confirm(`Delete "${song.title || song.mood_label || 'this song'}"?`)) return
    setActionLoading(song.id)
    try {
      const res = await fetch(`${API}/music/${song.id}?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (String(activeSongId) === String(song.id)) {
        clearActivePlayback(song.id)
      }
      setSongs(prev => prev.filter(s => s.id !== song.id))
      setByRegion(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(r => {
          updated[r] = updated[r].filter(s => s.id !== song.id)
        })
        return updated
      })
      if (expanded === song.id) setExpanded(null)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const startEditTitle = (song, e) => {
    e?.stopPropagation()
    setEditingId(song.id)
    setEditTitle(song.title || song.mood_label || '')
  }

  const saveTitle = async (songId) => {
    if (!userId || !editTitle.trim()) { setEditingId(null); return }
    setActionLoading(songId)
    try {
      await patchSong(songId, { title: editTitle.trim() })
      const title = editTitle.trim()
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, title } : s))
      setByRegion(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(r => {
          updated[r] = updated[r].map(s => s.id === songId ? { ...s, title } : s)
        })
        return updated
      })
      setEditingId(null)
    } catch (err) {
      console.error('Title update failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // ── Filter + sort + search ─────────────────────────────────
  const { visible: planVisible, truncated, hidden } = applyHistoryLimit(songs, userPlan)
  const favCount = planVisible.filter(s => s.is_favorite).length
  const base = filter === 'all'
    ? planVisible
    : filter === 'favorites'
    ? planVisible.filter(s => s.is_favorite)
    : (byRegion[filter] || []).filter(s => planVisible.some(v => v.id === s.id))
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
    const isActive = String(activeSongId) === String(song.id)
    const isPlay   = isActive && isPlaying
    const isBusy   = actionLoading === song.id
    const prog     = playProgress[String(song.id)] || 0
    const dateStr = new Date(song.created_at).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    const displayName = song.title || song.mood_label || song.emotion

    return (
      <div className={`sh-card ${song.is_favorite ? 'fav' : ''}`} style={{ '--rc': meta.color }}>
        <div className="sh-card-top" onClick={() => setExpanded(isOpen ? null : song.id)}>
          <div className="sh-left">
            <span className="sh-emotion">{EMOTION_EMOJI[song.emotion] || '🎵'}</span>
            <div className="sh-info">
              {editingId === song.id ? (
                <div className="sh-edit-row" onClick={e => e.stopPropagation()}>
                  <input
                    className="sh-edit-input"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(song.id); if (e.key === 'Escape') setEditingId(null) }}
                    autoFocus
                  />
                  <button className="sh-action-btn save" onClick={() => saveTitle(song.id)}>✓</button>
                  <button className="sh-action-btn" onClick={() => setEditingId(null)}>✕</button>
                </div>
              ) : (
                <p className="sh-mood">{displayName}</p>
              )}
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
            <button
              className={`sh-action-btn sh-fav-btn ${song.is_favorite ? 'on' : ''}`}
              onClick={e => toggleFavorite(song, e)}
              disabled={isBusy}
              title={song.is_favorite ? 'Remove from favourites' : 'Add to favourites'}
              aria-label={song.is_favorite ? 'Remove from favourites' : 'Add to favourites'}
              aria-pressed={song.is_favorite}
            >
              {song.is_favorite ? '❤️' : '🤍'}
            </button>
            {song.audio_url && (
              <>
                {canDownload(userPlan) ? (
                  <a
                    className="sh-action-btn sh-dl-btn"
                    href={openAudioUrl(song.audio_url, song.task_id) || song.audio_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    title="Download"
                    aria-label="Download song"
                  >
                    ⬇
                  </a>
                ) : (
                  <button
                    type="button"
                    className="sh-action-btn sh-dl-btn locked"
                    onClick={e => { e.stopPropagation(); onUpgrade?.() }}
                    title="Download — Groove or Studio"
                    aria-label="Download locked — upgrade to unlock"
                  >
                    🔒
                  </button>
                )}
                <button
                  className={`sh-play ${isActive ? 'playing' : ''}`}
                  onClick={e => { e.stopPropagation(); togglePlay(song) }}
                  aria-label={isPlay ? 'Pause' : isActive ? 'Play' : 'Play'}
                >
                  {isPlay ? '⏸' : '▶'}
                </button>
              </>
            )}
            <button className="sh-action-btn" onClick={e => startEditTitle(song, e)} title="Rename">✎</button>
            <button className="sh-action-btn danger" onClick={e => deleteSong(song, e)} disabled={isBusy} title="Delete">🗑</button>
            <span className="sh-chevron">{isOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* ── Progress bar shown when playing ── */}
        {isActive && (
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
            {song.audio_url && (
              <div className="sh-dl-row">
                {canDownload(userPlan) ? (
                  <a
                    className="sh-dl-link"
                    href={openAudioUrl(song.audio_url, song.task_id) || song.audio_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                  >
                    ⬇ Download track
                  </a>
                ) : (
                  <button
                    type="button"
                    className="sh-dl-link locked"
                    onClick={e => { e.stopPropagation(); onUpgrade?.() }}
                  >
                    🔒 Download — upgrade to Groove or Studio
                  </button>
                )}
              </div>
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
        <div className="sh-sub-row">
          <p className="sh-sub">
            {loading ? 'Loading…' : truncated
              ? `${planVisible.length} of ${songs.length} tracks (Free plan)`
              : `${songs.length} track${songs.length !== 1 ? 's' : ''} created`}
          </p>
          <button
            type="button"
            className={`sh-fav-filter ${filter === 'favorites' ? 'active' : ''}`}
            onClick={() => setFilter(f => f === 'favorites' ? 'all' : 'favorites')}
            aria-pressed={filter === 'favorites'}
          >
            <span className="sh-fav-filter-icon">{filter === 'favorites' ? '❤️' : '🤍'}</span>
            Favourites{favCount > 0 ? ` (${favCount})` : ''}
          </button>
        </div>
      </div>

      {truncated && (
        <div className="sh-plan-banner">
          Showing your {planVisible.length} most recent tracks. {hidden} older track{hidden !== 1 ? 's' : ''} hidden on Free.{' '}
          <button type="button" className="sh-upgrade-link" onClick={() => onUpgrade?.()}>Upgrade for full history</button>
        </div>
      )}

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

      {actionError && (
        <p className="sh-action-error" role="alert">{actionError}</p>
      )}

      {/* ── Region filter pills ── */}
      <div className="sh-filters">
        <button className={`sh-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All ({songs.length})
        </button>
        {regions.length > 1 && regions.map(r => {
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

      {loading ? (
        <div className="sh-loading"><div className="sh-spinner" /><p>Loading your songs…</p></div>
      ) : filteredSongs.length === 0 ? (
        <div className="sh-empty">
          <p className="sh-empty-icon">{search ? '🔍' : '🎵'}</p>
          <p className="sh-empty-title">
            {search ? 'No results found' : filter === 'favorites' ? 'No favourites yet' : 'No songs yet'}
          </p>
          <p className="sh-empty-sub">
            {search
              ? `No songs match "${search}"`
              : filter === 'favorites'
              ? 'Tap 🤍 on any song to add it to your favourites.'
              : 'Share a mood to create your first track.'}
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
        .sh-header { margin-bottom: 14px; }
        .sh-plan-banner {
          margin-bottom: 12px; padding: 10px 14px; border-radius: 10px;
          background: rgba(124, 92, 231, 0.12); border: 1px solid rgba(124, 92, 231, 0.25);
          font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.45;
        }
        .sh-upgrade-link {
          background: none; border: none; padding: 0; color: #a78bfa;
          font-weight: 600; cursor: pointer; text-decoration: underline;
        }
        .sh-headline { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 6px; text-align: center; }
        .sh-headline em { font-style: italic; color: #b09ee0; }
        .sh-sub-row {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .sh-sub { font-size: 13px; color: #8b7eb8; margin: 0; }

        /* ── Favourites (same width as sort) ── */
        .sh-fav-filter {
          display: flex; align-items: center; justify-content: center; gap: 5px;
          flex-shrink: 0; width: 128px; box-sizing: border-box;
          padding: 9px 8px;
          border-radius: 12px;
          border: 1.5px solid rgba(176,158,224,.15);
          background: rgba(255,255,255,.06);
          color: #b09ee0; font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: inherit;
          white-space: nowrap;
          transition: border-color .18s, background .18s, color .18s, box-shadow .18s;
        }
        .sh-fav-filter:hover {
          background: rgba(255,255,255,.09);
          border-color: rgba(239,68,68,.35);
          color: #e0d8ff;
        }
        .sh-fav-filter.active {
          border-color: rgba(239,68,68,.55);
          background: rgba(239,68,68,.12);
          color: #fecaca;
          box-shadow: 0 0 16px rgba(239,68,68,.15);
        }
        .sh-fav-filter-icon { font-size: 13px; line-height: 1; flex-shrink: 0; }

        /* ── Search + sort row ── */
        .sh-search-row {
          display: flex; gap: 8px; margin-bottom: 14px; align-items: center;
        }
        .sh-search-wrap {
          flex: 1; position: relative; display: flex; align-items: center; min-width: 0;
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
          flex-shrink: 0; width: 128px; box-sizing: border-box;
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
        .sh-card.fav { border-color: rgba(239,68,68,.35); box-shadow: 0 4px 20px rgba(239,68,68,.12); }
        .sh-action-error {
          margin: 0 0 12px; padding: 10px 12px; border-radius: 10px;
          background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.25);
          color: #fca5a5; font-size: 12px; text-align: center;
        }
        .sh-fav-btn {
          font-size: 16px; line-height: 1;
        }
        .sh-fav-btn.on {
          border-color: rgba(239,68,68,.55);
          background: rgba(239,68,68,.15);
          box-shadow: 0 0 14px rgba(239,68,68,.3);
        }
        .sh-fav-btn:hover:not(:disabled) {
          border-color: rgba(239,68,68,.45);
          background: rgba(239,68,68,.1);
        }
        .sh-action-btn {
          background: rgba(255,255,255,.06); border: 1px solid rgba(176,158,224,.15);
          border-radius: 8px; color: #8b7eb8; font-size: 12px;
          width: 28px; height: 28px; cursor: pointer; display: flex;
          align-items: center; justify-content: center; transition: all .15s;
        }
        .sh-action-btn:hover { background: rgba(255,255,255,.1); color: #e0d8ff; }
        .sh-action-btn.save { color: #34d399; border-color: rgba(52,211,153,.3); }
        .sh-action-btn.danger:hover { color: #f87171; border-color: rgba(248,113,113,.3); }
        .sh-dl-btn { font-size: 13px; text-decoration: none; color: inherit; }
        .sh-dl-btn.locked { opacity: 0.7; cursor: pointer; }
        .sh-dl-row { margin-top: 4px; }
        .sh-dl-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: #a78bfa; text-decoration: none;
          background: rgba(124, 92, 231, 0.12); border: 1px solid rgba(124, 92, 231, 0.25);
          border-radius: 8px; padding: 6px 12px; cursor: pointer;
        }
        .sh-dl-link.locked {
          background: none; border: none; padding: 0;
          color: #8b7eb8; font-weight: 500;
        }
        .sh-dl-link:not(.locked):hover { background: rgba(124, 92, 231, 0.22); }
        .sh-edit-row { display: flex; gap: 6px; align-items: center; margin-bottom: 3px; }
        .sh-edit-input {
          flex: 1; min-width: 0; padding: 4px 8px; border-radius: 8px;
          background: rgba(255,255,255,.08); border: 1px solid rgba(124,92,231,.4);
          color: #e0d8ff; font-size: 13px; font-family: inherit; outline: none;
        }
        .sh-left  { display: flex; align-items: center; gap: 8px; }
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

        @media (max-width: 520px) {
          .sh-root { max-width: 100%; }
          .sh-headline { font-size: 20px; }
          .sh-sub-row { flex-wrap: wrap; gap: 10px; }
          .sh-fav-filter { width: auto; flex: 1; min-width: 0; }
          .sh-search-row { flex-wrap: wrap; }
          .sh-search-wrap { flex: 1 1 100%; width: 100%; }
          .sh-sort { width: 100%; }
          .sh-card-top { flex-wrap: wrap; gap: 10px; }
          .sh-right { margin-left: auto; }
        }
        @media (max-width: 380px) {
          .sh-fav-filter span:last-child { display: none; }
        }
      `}</style>
    </div>
  )
}