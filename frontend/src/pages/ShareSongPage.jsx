import { useState, useEffect, useRef, useMemo } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import MemoryCapsuleCard from '../components/MemoryCapsuleCard'
import ShareActions from '../components/ShareActions'
import { proxiedAudioUrl, openAudioUrl } from '../utils/audioProxy'
import { songShareUrl, memoryShareUrl } from '../utils/shareLinks'
import { hasMemory } from '../utils/memoryCapsule'
import { EMOTION_EMOJI, regionMeta } from '../utils/regions'

const api = () => import.meta.env.VITE_API_URL

export default function ShareSongPage({ songId, memoryView = false }) {
  const { t } = useI18n()
  const audioRef = useRef(null)
  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${api()}/share/song/${encodeURIComponent(songId)}`)
        if (!res.ok) {
          setError(res.status === 404 ? t('share.notFound') : t('share.loadError'))
          return
        }
        const data = await res.json()
        if (!cancelled) setSong(data.song)
      } catch {
        if (!cancelled) setError(t('share.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [songId, t])

  const proxyUrl = useMemo(
    () => proxiedAudioUrl(song?.audio_url, song?.task_id),
    [song?.audio_url, song?.task_id],
  )
  const tabUrl = useMemo(
    () => openAudioUrl(song?.audio_url, song?.task_id),
    [song?.audio_url, song?.task_id],
  )

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      el.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  const meta = regionMeta(song?.region)
  const title = song?.title || song?.mood_label || 'Ekko song'
  const shareUrl = memoryView && song?.id ? memoryShareUrl(song.id) : songShareUrl(songId)
  const showMemory = memoryView || (song && hasMemory(song))

  return (
    <div className="share-page">
      <div className="share-page__stars" aria-hidden="true" />
      <header className="share-page__header">
        <a href="/" className="share-page__brand">Ekko</a>
        <p className="share-page__tag">{memoryView ? t('share.memoryTag') : t('share.songTag')}</p>
      </header>

      <main className="share-page__main">
        {loading && <p className="share-page__status">{t('share.loading')}</p>}
        {error && (
          <div className="share-page__empty">
            <p>{error}</p>
            <a href="/" className="share-page__cta">{t('share.tryEkko')}</a>
          </div>
        )}
        {song && !error && (
          <article className="share-song-card" style={{ '--rc': meta.color }}>
            <div className="share-song-card__hero">
              {song.cover_url ? (
                <img src={song.cover_url} alt="" className="share-song-card__cover" />
              ) : (
                <div className="share-song-card__cover-ph">{EMOTION_EMOJI[song.emotion] || '🎵'}</div>
              )}
            </div>
            <h1 className="share-song-card__title">{title}</h1>
            <p className="share-song-card__meta">
              {meta.emoji} {meta.label}
              {song.mood_label && <> · {song.mood_label}</>}
            </p>

            {proxyUrl && (
              <>
                <audio ref={audioRef} src={proxyUrl} onEnded={() => setPlaying(false)} />
                <button type="button" className="share-song-card__play" onClick={togglePlay}>
                  {playing ? '⏸' : '▶'} {playing ? t('share.pause') : t('share.play')}
                </button>
                {tabUrl && (
                  <a href={tabUrl} target="_blank" rel="noreferrer" className="share-song-card__open">
                    {t('share.openAudio')}
                  </a>
                )}
              </>
            )}

            {showMemory && hasMemory(song) && (
              <div className="share-song-card__memory">
                <MemoryCapsuleCard song={song} />
              </div>
            )}

            {song.lyrics && (
              <pre className="share-song-card__lyrics">{song.lyrics}</pre>
            )}

            <ShareActions
              url={shareUrl}
              title={title}
              text={t('share.songBlurb', { title })}
              onCopied={() => {}}
            />

            <a href="/" className="share-page__cta">{t('share.tryEkko')}</a>
          </article>
        )}
      </main>
    </div>
  )
}
