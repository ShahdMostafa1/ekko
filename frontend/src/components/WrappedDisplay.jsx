import { useState } from 'react'
import { useCountUp } from '../hooks/useCountUp'
import { firstNameFrom, emotionLabel, formatWrappedInsightItem } from '../utils/insights'
import ShareActions from './ShareActions'
import { wrappedShareUrl } from '../utils/shareLinks'

const hintStyle = {
  margin: '0 0 10px', fontSize: 16, color: 'rgba(255,255,255,0.38)', fontStyle: 'italic',
}

/** Shared Ekko Wrapped UI — same in Journey and public share links. */
export default function WrappedDisplay({
  wrapped,
  t,
  userId = '',
  displayName = '',
  onCopied,
  showTapHint = true,
}) {
  const firstName = wrapped?.firstName || firstNameFrom(displayName)
  const [flipped, setFlipped] = useState(null)
  const songCount = useCountUp(wrapped.songCount, { enabled: wrapped.hasData })
  const xpCount = useCountUp(wrapped.xp, { enabled: wrapped.hasData })

  if (!wrapped?.hasData) {
    return (
      <div className="journey-panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ fontSize: 45, margin: '0 0 12px' }}>✨</p>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>{t('journey.wrappedEmpty')}</p>
      </div>
    )
  }

  const shareUrl = userId ? wrappedShareUrl(userId) : ''
  const insightLines = (wrapped.insightItems || []).map(item => formatWrappedInsightItem(item, t))
  const topMoodLabel = emotionLabel(wrapped.topEmotion, t)
  const topRegionLabel = t(`onboarding.regions.${wrapped.topRegion}`) !== `onboarding.regions.${wrapped.topRegion}`
    ? t(`onboarding.regions.${wrapped.topRegion}`)
    : wrapped.topRegionMeta.label

  const shareText = [
    firstName
      ? t('journey.shareTitleNamed', { name: firstName, year: wrapped.year })
      : t('journey.shareTitle', { year: wrapped.year }),
    t('journey.shareStats', {
      songs: wrapped.songCount,
      moods: wrapped.moodCheckIns,
    }),
    t('journey.shareTopMood', { emoji: wrapped.topEmotionEmoji, mood: topMoodLabel }),
    t('journey.shareTopRegion', { emoji: wrapped.topRegionMeta.emoji, region: topRegionLabel }),
    t('journey.shareXpStreak', { xp: wrapped.xp, streak: wrapped.streak }),
    ...insightLines.slice(0, 2),
  ].join('\n')

  const cards = [
    { id: 'mood', emoji: wrapped.topEmotionEmoji, label: t('journey.topMood'), value: topMoodLabel },
    { id: 'region', emoji: wrapped.topRegionMeta.emoji, label: t('journey.topRegion'), value: topRegionLabel },
    { id: 'songs', emoji: '🎵', label: t('journey.songsCreated'), value: String(songCount) },
    { id: 'xp', emoji: '⭐', label: 'XP', value: String(xpCount) },
    { id: 'streak', emoji: '🔥', label: t('journey.streak'), value: `${wrapped.streak}d` },
    { id: 'regions', emoji: '🌍', label: t('journey.regions'), value: String(wrapped.regionsExplored) },
    { id: 'memories', emoji: '📔', label: t('journey.memories'), value: String(wrapped.memories) },
    { id: 'covers', emoji: '🎨', label: t('journey.covers'), value: String(wrapped.covers) },
  ]

  return (
    <div className="journey-panel journey-panel--card wrapped-display">
      <div className="journey-wrapped-hero">
        <p style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '.15em', color: 'rgba(255,255,255,0.9)' }}>
          EKKO WRAPPED
        </p>
        {firstName ? (
          <>
            <h2 style={{ margin: '10px 0 4px', fontSize: 41, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
              {t('journey.wrappedForName', { name: firstName })}
            </h2>
            <p style={{ margin: '0 0 4px', fontSize: 33, fontWeight: 800, color: 'rgba(255,255,255,0.75)' }}>{wrapped.year}</p>
          </>
        ) : (
          <h2 style={{ margin: '8px 0', fontSize: 47, fontWeight: 900, color: '#fff' }}>{wrapped.year}</h2>
        )}
        <p style={{ margin: 0, fontSize: 19, color: 'rgba(255,255,255,0.85)' }}>
          {firstName
            ? t('journey.wrappedSubtitleNamed', { name: firstName, year: wrapped.year })
            : t('journey.wrappedSubtitle')}
        </p>
      </div>

      {showTapHint && <p style={hintStyle}>{t('journey.tapCard')}</p>}

      <div className="journey-wrapped-grid">
        {cards.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className="journey-wrapped-card"
            style={{ animationDelay: `${i * 0.06}s`, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setFlipped(flipped === c.id ? null : c.id)}
          >
            <span style={{ fontSize: 29 }}>{c.emoji}</span>
            <p style={{ margin: '6px 0 2px', fontSize: 15, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {c.label}
            </p>
            <p style={{
              margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', textTransform: 'capitalize',
              transform: flipped === c.id ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.2s',
            }}>
              {c.value}
            </p>
          </button>
        ))}
      </div>

      {insightLines.map((line, i) => (
        <p
          key={i}
          style={{
            margin: '0 0 10px', padding: '12px 14px', borderRadius: 12,
            background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)',
            fontSize: 18, color: 'rgba(255,255,255,0.88)', lineHeight: 1.45,
            animation: 'journeyEntryIn 0.4s ease both',
            animationDelay: `${0.5 + i * 0.1}s`,
          }}
        >
          {line}
        </p>
      ))}

      {shareUrl && (
        <ShareActions
          url={shareUrl}
          title={firstName ? `${firstName}'s Ekko Wrapped ${wrapped.year}` : `Ekko Wrapped ${wrapped.year}`}
          text={shareText}
          onCopied={onCopied}
        />
      )}
    </div>
  )
}
