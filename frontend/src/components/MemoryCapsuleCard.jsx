import { memoryDisplayTitle } from '../utils/memoryCapsule'
import { EMOTION_EMOJI } from '../utils/regions'
import ShareActions from './ShareActions'
import { memoryShareUrl } from '../utils/shareLinks'
import { useI18n } from '../i18n/I18nContext.jsx'

/** Read-only memory capsule — player, history, journey. */
export default function MemoryCapsuleCard({ song, compact = false, showShareLink = true }) {
  const { t } = useI18n()
  if (!song) return null
  const title = memoryDisplayTitle(song)
  const shareUrl = song.id ? memoryShareUrl(song.id) : ''
  const dateStr = song.created_at
    ? new Date(song.created_at).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : ''

  if (compact) {
    return (
      <div className="mc-capsule mc-capsule--compact">
        {song.memory_photo_url && (
          <img src={song.memory_photo_url} alt="" className="mc-photo mc-photo--compact" />
        )}
        <div className="mc-body">
          <p className="mc-title">{title}</p>
          {song.memory_note && <p className="mc-note">{song.memory_note}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="mc-capsule">
      {song.memory_photo_url ? (
        <div className="mc-photo-wrap">
          <img src={song.memory_photo_url} alt="" className="mc-photo" />
          <div className="mc-photo-overlay">
            <span className="mc-emoji">{EMOTION_EMOJI[song.emotion] || '🎵'}</span>
          </div>
        </div>
      ) : (
        <div className="mc-photo-placeholder">
          <span>{EMOTION_EMOJI[song.emotion] || '📔'}</span>
        </div>
      )}
      <div className="mc-body">
        <p className="mc-label">MEMORY CAPSULE</p>
        <h3 className="mc-title">{title}</h3>
        {dateStr && <p className="mc-date">{dateStr}</p>}
        {song.memory_note && (
          <blockquote className="mc-note">&ldquo;{song.memory_note}&rdquo;</blockquote>
        )}
        {song.mood_label && (
          <p className="mc-mood">
            {EMOTION_EMOJI[song.emotion] || '🎵'} {song.mood_label}
          </p>
        )}
        {showShareLink && shareUrl && (
          <ShareActions
            url={shareUrl}
            title={title}
            text={t('share.songBlurb', { title })}
            compact
          />
        )}
      </div>
    </div>
  )
}
