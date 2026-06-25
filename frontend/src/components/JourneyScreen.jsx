import { useState, useEffect, useMemo, useCallback } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useCountUp } from '../hooks/useCountUp'
import { computeWrapped, computeMoodTimeline, computePassport } from '../utils/insights'
import { hasMemory } from '../utils/memoryCapsule'
import { filterByInstantSearch } from '../utils/searchFilter'
import { EMOTION_EMOJI } from '../utils/regions'
import MemoryCapsuleCard from './MemoryCapsuleCard'
import WrappedDisplay from './WrappedDisplay'

const TABS = [
  { id: 'timeline', icon: '📈', labelKey: 'journey.tabTimeline' },
  { id: 'passport', icon: '🛂', labelKey: 'journey.tabPassport' },
  { id: 'memories', icon: '📔', labelKey: 'journey.tabMemories' },
  { id: 'wrapped',  icon: '✨', labelKey: 'journey.tabWrapped' },
]

function JourneySkeleton() {
  return (
    <div className="journey-skeleton" aria-hidden="true">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="journey-skeleton__bar" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}

function MiniBarChart({ days, selectedDate, onSelectDay }) {
  const withData = days.filter(d => !d.empty && d.avgValence != null)
  if (!withData.length) {
    return (
      <p className="journey-chart-empty">
        No mood data yet — share how you feel to start your timeline.
      </p>
    )
  }

  const vals = withData.map(d => d.avgValence)
  const max = Math.max(...vals, 0.01)
  const min = Math.min(...vals, 0)
  const span = Math.max(max - min, 0.12)

  return (
    <div className="journey-chart" role="group" aria-label="Mood levels for the last seven days">
      {days.map((d, i) => {
        const em = d.dominantEmotion ? (EMOTION_EMOJI[d.dominantEmotion] || '🎵') : null
        const heightPct = d.empty
          ? 0
          : Math.round(18 + ((d.avgValence - min) / span) * 74)
        const clickable = !d.empty
        const selected = selectedDate === d.date

        const col = (
          <>
            <div className="journey-chart__plot">
              {!d.empty && em && (
                <span className="journey-chart__emoji" title={d.dominantEmotion}>{em}</span>
              )}
              <div
                className={`journey-chart__bar${d.empty ? ' journey-chart__bar--empty' : ' journey-chart__bar--grow'}`}
                style={d.empty ? undefined : { height: `${heightPct}%`, animationDelay: `${i * 0.07}s` }}
              />
            </div>
            <span className="journey-chart__label">{d.weekday}</span>
            <span className="journey-chart__date">{d.date.slice(5)}</span>
          </>
        )

        if (!clickable) {
          return (
            <div key={d.date} className="journey-chart__col journey-chart__col--empty">
              {col}
            </div>
          )
        }

        return (
          <button
            key={d.date}
            type="button"
            className={`journey-chart__col journey-chart__col--clickable${selected ? ' journey-chart__col--selected' : ''}`}
            onClick={() => onSelectDay(selected ? null : d.date)}
            aria-pressed={selected}
            aria-label={`${d.weekday} ${d.date.slice(5)}`}
          >
            {col}
          </button>
        )
      })}
    </div>
  )
}

function StatPill({ label, value, numeric, delay = 0 }) {
  const n = useCountUp(numeric ? value : 0, { enabled: numeric })
  return (
    <div className="journey-stat journey-stat--pop" style={{ animationDelay: `${delay}s` }}>
      <p className="journey-stat__label">{label}</p>
      <p className="journey-stat__value">
        {numeric ? n : value}
      </p>
    </div>
  )
}

function TimelineTab({ timeline, t }) {
  const [selectedDate, setSelectedDate] = useState(null)

  const filteredEntries = useMemo(() => {
    const list = [...timeline.entries].reverse()
    if (!selectedDate) return list.slice(0, 12)
    return list.filter(e => e.date === selectedDate).slice(0, 12)
  }, [timeline.entries, selectedDate])

  const selectedDayMeta = selectedDate
    ? timeline.last7.find(d => d.date === selectedDate)
    : null

  return (
    <div className="journey-panel journey-panel--card">
      <div className="journey-insight">
        <p>💡 {t(`journey.weeklyInsight.${timeline.weeklyInsightKey || 'empty'}`)}</p>
      </div>

      <div className="journey-timeline-wide">
        <div className="journey-timeline-wide__main">
          <h3 style={sectionTitle}>{t('journey.timelineChart')}</h3>
          <p style={hintStyle}>{t('journey.tapDay')}</p>
          <MiniBarChart
            days={timeline.last7}
            selectedDate={selectedDate}
            onSelectDay={setSelectedDate}
          />

          {selectedDayMeta && !selectedDayMeta.empty && (
            <p className="journey-filter-hint" style={{ animation: 'journeyPanelIn 0.3s ease both' }}>
              {EMOTION_EMOJI[selectedDayMeta.dominantEmotion] || '🎵'}{' '}
              {selectedDayMeta.dominantEmotion?.replace(/_/g, ' ')} · {selectedDayMeta.weekday}
              {' · '}
              <button type="button" className="journey-clear-filter" onClick={() => setSelectedDate(null)}>
                {t('journey.clearFilter')}
              </button>
            </p>
          )}

          <div className="journey-stats">
            <StatPill label={t('journey.moodCheckIns')} value={timeline.totalCheckIns} numeric delay={0.05} />
            <StatPill label={t('journey.songsCreated')} value={timeline.totalSongs} numeric delay={0.1} />
            {timeline.dominantRecent && (
              <StatPill
                label={t('journey.recentMood')}
                value={`${EMOTION_EMOJI[timeline.dominantRecent] || ''} ${timeline.dominantRecent}`}
                delay={0.15}
              />
            )}
          </div>
        </div>

        <div>
          <h3 style={sectionTitle}>{t('journey.recentEntries')}</h3>
          <div className="journey-timeline-wide__entries">
            {filteredEntries.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>{t('journey.emptyTimeline')}</p>
            ) : (
              filteredEntries.map((e, i) => (
                <div
                  key={`${e.ts}-${i}`}
                  className={`journey-entry${selectedDate && e.date === selectedDate ? ' journey-entry--highlight' : ''}`}
                  style={{ animationDelay: `${0.04 * i}s` }}
                >
                  <span style={{ fontSize: 27 }}>{EMOTION_EMOJI[e.emotion] || '🎵'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="journey-entry__title">{e.label || e.emotion}</p>
                    <p className="journey-entry__meta">
                      {new Date(e.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {e.source === 'song' ? ' · 🎵 Song' : ' · 🎙 Mood'}
                    </p>
                  </div>
                  <div
                    className="journey-entry__dot"
                    style={{
                      background: e.valence >= 0.6 ? '#34d399' : e.valence <= 0.4 ? '#60a5fa' : '#a855f7',
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PassportTab({ passport, t }) {
  const [selectedId, setSelectedId] = useState(null)
  const count = useCountUp(passport.stampedCount)
  const pct = Math.round((passport.stampedCount / passport.totalRegions) * 100)
  const selected = passport.stamps.find(s => s.id === selectedId)

  return (
    <div className="journey-panel journey-panel--card">
      <div className="journey-passport-layout">
      <div className="journey-passport-layout__hero">
        <div className="journey-passport-hero">
        <p style={{ margin: 0, fontSize: 16, letterSpacing: '.12em', color: '#c9a84c', fontWeight: 700 }}>
          {t('journey.passportTitle')}
        </p>
        <h2 style={{ margin: '8px 0 4px', fontSize: 27, color: '#fff' }}>{passport.title}</h2>
        <p style={{ margin: 0, fontSize: 18, color: 'rgba(255,255,255,0.55)' }}>{passport.subtitle}</p>
        <div className="journey-passport-ring" style={{ '--pct': pct }}>
          {count}/{passport.totalRegions}
        </div>
        </div>
      </div>

      <div>
      <div className="journey-passport-stamps" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
      }}>
        {passport.stamps.map((stamp, i) => (
          <button
            key={stamp.id}
            type="button"
            className={`journey-stamp${stamp.stamped ? ' journey-stamp--stamped' : ' journey-stamp--locked'}${selectedId === stamp.id ? ' journey-stamp--selected' : ''}`}
            style={{
              animationDelay: `${i * 0.06}s`,
              background: stamp.stamped
                ? `linear-gradient(145deg, ${stamp.color}22, rgba(0,0,0,0.2))`
                : 'rgba(255,255,255,0.03)',
              border: stamp.stamped
                ? `1.5px solid ${stamp.color}88`
                : '1px dashed rgba(255,255,255,0.12)',
            }}
            onClick={() => stamp.stamped && setSelectedId(selectedId === stamp.id ? null : stamp.id)}
            disabled={!stamp.stamped}
          >
            <span
              className="journey-stamp__emoji"
              style={{ filter: stamp.stamped ? 'none' : 'grayscale(1)' }}
            >
              {stamp.emoji}
            </span>
            <p style={{ margin: '8px 0 2px', fontSize: 18, fontWeight: 700, color: '#fff' }}>
              {stamp.label}
            </p>
            <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.45)' }}>
              {stamp.stamped ? stamp.stamp : t('journey.stampLocked')}
            </p>
            {stamp.stamped && stamp.songCount > 0 && (
              <p style={{ margin: '6px 0 0', fontSize: 15, color: stamp.color }}>
                {stamp.songCount} track{stamp.songCount !== 1 ? 's' : ''}
              </p>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="journey-stamp-detail">
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#e0d8ff' }}>
            {selected.emoji} {selected.label}
          </p>
          <p style={{ margin: 0, fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
            {t('journey.stampDetail', {
              count: selected.songCount,
              stamp: selected.stamp,
            })}
          </p>
        </div>
      )}
      </div>
      </div>
    </div>
  )
}

function MemoriesTab({ songs, t, onCreate }) {
  const [search, setSearch] = useState('')
  const capsules = useMemo(
    () => songs.filter(hasMemory).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [songs],
  )
  const filteredCapsules = useMemo(
    () => filterByInstantSearch(capsules, search, s => [
      s.title, s.mood_label, s.memory_location, s.memory_note, s.emotion, s.region,
    ]),
    [capsules, search],
  )

  if (!capsules.length) {
    return (
      <div className="journey-panel" style={{ textAlign: 'center', padding: '40px 16px' }}>
        <p style={{ fontSize: 53, margin: '0 0 12px', animation: 'journeyStampPop 0.8s ease both' }}>📔</p>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, lineHeight: 1.5, marginBottom: 20 }}>
          {t('journey.memoriesEmpty')}
        </p>
        {onCreate && (
          <button type="button" className="journey-share-btn" style={{ maxWidth: 280, margin: '0 auto' }} onClick={onCreate}>
            {t('journey.createSong')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="journey-panel journey-panel--card">
      <p className="journey-memories-intro" style={{ margin: '0 0 16px', fontSize: 18, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>
        {search
          ? `${filteredCapsules.length} of ${capsules.length} capsules`
          : t('journey.memoriesSub', { count: capsules.length })}
      </p>
      {capsules.length > 3 && (
        <input
          type="search"
          className="journey-memories-search"
          placeholder="Type to filter memories…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Filter memory capsules"
          style={{ marginBottom: 16 }}
        />
      )}
      {filteredCapsules.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 18, padding: '24px 0' }}>
          No memories match “{search}”
        </p>
      ) : (
      <div className="mc-grid">
        {filteredCapsules.map((song, i) => (
          <div key={song.id} style={{ animation: 'journeyCardIn 0.45s ease both', animationDelay: `${i * 0.08}s` }}>
            <MemoryCapsuleCard song={song} />
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

function WrappedTab({ wrapped, t, userId, userName = '', onCopied }) {
  return (
    <WrappedDisplay
      wrapped={wrapped}
      t={t}
      userId={userId}
      displayName={userName}
      onCopied={onCopied}
      showTapHint
    />
  )
}

const sectionTitle = {
  margin: '0 0 12px', fontSize: 18, fontWeight: 700,
  color: 'rgba(255,255,255,0.55)', letterSpacing: '.08em', textTransform: 'uppercase',
}

const hintStyle = {
  margin: '0 0 10px', fontSize: 16, color: 'rgba(255,255,255,0.38)', fontStyle: 'italic',
}

export default function JourneyScreen({ userId, xp = 0, userName = '', initialTab = 'timeline', onCreateSong }) {
  const { t } = useI18n()
  const [tab, setTab] = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [songs, setSongs] = useState([])
  const [moodLogs, setMoodLogs] = useState([])
  const [shareOk, setShareOk] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  const loadData = useCallback(async (isRefresh = false) => {
    if (!userId) { setLoading(false); return }
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const api = import.meta.env.VITE_API_URL
    try {
      const [music, mood] = await Promise.all([
        fetch(`${api}/music/history/${userId}`).then(r => r.json()),
        fetch(`${api}/mood/history/${userId}`).then(r => r.json()),
      ])
      setSongs(music.songs || [])
      setMoodLogs(mood.logs || [])
      if (isRefresh) setAnimKey(k => k + 1)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [userId])

  useEffect(() => { loadData() }, [loadData])

  const timeline = useMemo(() => computeMoodTimeline(moodLogs, songs), [moodLogs, songs])
  const passport = useMemo(() => computePassport(songs), [songs])
  const wrapped = useMemo(
    () => computeWrapped({ songs, moodLogs, xp, displayName: userName }),
    [songs, moodLogs, xp, userName],
  )

  const memCount = songs.filter(hasMemory).length

  return (
    <div className="journey-screen">
      <div className="journey-header">
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 31, fontWeight: 800, color: '#fff' }}>
            {t('journey.title')}
          </h1>
          <p style={{ margin: 0, fontSize: 19, color: 'rgba(255,255,255,0.5)' }}>
            {t('journey.subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="journey-refresh"
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          aria-label={t('journey.refresh')}
        >
          {refreshing ? '…' : '↻'}
        </button>
      </div>

      <div className="journey-tabs" role="tablist">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`journey-tab${tab === item.id ? ' journey-tab--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <span className="journey-tab__icon" aria-hidden="true">{item.icon}</span>
            <span>{t(item.labelKey)}</span>
            {item.id === 'memories' && memCount > 0 && (
              <span className="journey-tab__badge">{memCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <JourneySkeleton />
      ) : (
        <div key={`${tab}-${animKey}`}>
          {tab === 'timeline' && <TimelineTab timeline={timeline} t={t} />}
          {tab === 'passport' && <PassportTab passport={passport} t={t} />}
          {tab === 'memories' && (
            <MemoriesTab songs={songs} t={t} onCreate={onCreateSong} />
          )}
          {tab === 'wrapped' && (
            <WrappedTab
              wrapped={wrapped}
              t={t}
              userId={userId}
              userName={userName}
              onCopied={() => { setShareOk(true); setTimeout(() => setShareOk(false), 2000) }}
            />
          )}
        </div>
      )}

      {shareOk && (
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 18, color: '#34d399', animation: 'journeyPanelIn 0.3s ease' }}>
          {t('share.linkCopied')}
        </p>
      )}
    </div>
  )
}
