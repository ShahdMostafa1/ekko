import { REGION_IDS, regionMeta, EMOTION_EMOJI } from './regions'
import { computeMoodStreak } from './badges'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Localized emotion label (falls back to English). */
export function emotionLabel(emotion, t) {
  const id = (emotion || 'neutral').toLowerCase()
  const key = `emotions.${id}`
  const tr = t(key)
  return tr !== key ? tr : id.replace(/_/g, ' ')
}

/** Format one Wrapped insight item using i18n. */
export function formatWrappedInsightItem(item, t) {
  if (!item?.key) return ''
  const vars = { ...item.vars }
  if (vars.mood) vars.mood = emotionLabel(vars.mood, t)
  if (vars.day != null) {
    const dk = `days.${vars.day}`
    const tr = t(dk)
    vars.day = tr !== dk ? tr : DAY_NAMES[vars.day]
  }
  if (vars.region) {
    const rk = `onboarding.regions.${vars.region}`
    const tr = t(rk)
    if (tr !== rk) vars.region = tr
  }
  const suffix = item.named ? 'Named' : ''
  return t(`journey.insights.${item.key}${suffix}`, vars)
}

function inYear(iso, year) {
  if (!iso) return false
  return new Date(iso).getFullYear() === year
}

function countBy(items, keyFn) {
  const m = {}
  for (const x of items) {
    const k = keyFn(x)
    if (!k) continue
    m[k] = (m[k] || 0) + 1
  }
  return m
}

function topKey(counts) {
  let best = null
  let max = 0
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) { max = v; best = k }
  }
  return best
}

function avg(nums) {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** First name for personalized copy (e.g. "Shahd Ahmed" → "Shahd"). */
export function firstNameFrom(fullName) {
  const trimmed = (fullName || '').trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0]
}

/** Spotify Wrapped–style year summary from songs + mood logs. */
export function computeWrapped({ songs = [], moodLogs = [], xp = 0, year, displayName } = {}) {
  const firstName = firstNameFrom(displayName)
  const y = year ?? new Date().getFullYear()
  const yearSongs = songs.filter(s => inYear(s.created_at, y))
  const yearMoods = moodLogs.filter(l => inYear(l.created_at, y))

  const emotionCounts = countBy(yearMoods.length ? yearMoods : yearSongs, x => x.emotion || 'neutral')
  const regionCounts = countBy(yearSongs, s => s.region || 'global')
  const topEmotion = topKey(emotionCounts) || 'neutral'
  const topRegion = topKey(regionCounts) || 'global'
  const favorites = yearSongs.filter(s => s.is_favorite).length

  const valences = yearMoods.map(l => Number(l.valence)).filter(n => !Number.isNaN(n))
  const avgValence = valences.length ? avg(valences) : avg(yearSongs.map(s => Number(s.valence)).filter(n => !Number.isNaN(n)))

  const moodByDay = {}
  for (const l of yearMoods) {
    const d = new Date(l.created_at).getDay()
    moodByDay[d] = moodByDay[d] || []
    moodByDay[d].push(Number(l.valence) || 0.5)
  }
  let bestDay = null
  let bestAvg = -1
  for (const [d, vals] of Object.entries(moodByDay)) {
    const a = avg(vals)
    if (a > bestAvg) { bestAvg = a; bestDay = Number(d) }
  }

  const instruments = countBy(yearSongs, s => {
    const m = (s.prompt_used || '').match(/instruments?:\s*([^|]+)/i)
    return m ? m[1].trim().slice(0, 40) : null
  })
  delete instruments.null

  const streak = computeMoodStreak(yearMoods.length ? yearMoods : moodLogs)
  const memories = yearSongs.filter(s =>
    s.memory_note || s.memory_location || s.memory_photo_url,
  ).length

  const moodTone = avgValence >= 0.6 ? 'uplifting' : avgValence <= 0.4 ? 'reflective' : 'balanced'

  const insightItems = []
  if (yearSongs.length) {
    insightItems.push({
      key: 'songsCreated',
      named: !!firstName,
      vars: { name: firstName, count: yearSongs.length, year: y },
    })
  }
  if (topEmotion && yearMoods.length + yearSongs.length > 2) {
    insightItems.push({
      key: 'topMood',
      named: !!firstName,
      vars: { name: firstName, mood: topEmotion },
    })
  }
  if (bestDay != null && yearMoods.length >= 3) {
    insightItems.push({
      key: 'energeticDay',
      named: !!firstName,
      vars: { name: firstName, day: bestDay },
    })
  }
  if (topRegion) {
    const rm = regionMeta(topRegion)
    insightItems.push({
      key: 'culturalHome',
      named: !!firstName,
      vars: { name: firstName, region: topRegion, emoji: rm.emoji },
    })
  }

  return {
    year: y,
    firstName,
    songCount: yearSongs.length,
    moodCheckIns: yearMoods.length,
    topEmotion,
    topEmotionEmoji: EMOTION_EMOJI[topEmotion] || '🎵',
    topRegion,
    topRegionMeta: regionMeta(topRegion),
    favorites,
    xp,
    streak,
    avgValence,
    moodTone,
    memories,
    covers: yearSongs.filter(s => s.cover_url).length,
    regionsExplored: new Set(yearSongs.map(s => s.region).filter(Boolean)).size,
    insightItems,
    hasData: yearSongs.length > 0 || yearMoods.length > 0,
  }
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localDateKey(date) {
  const x = date instanceof Date ? date : new Date(date)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Last 7 calendar days (today + previous 6) for the week bar chart. */
export function buildWeekChartDays(dayBuckets = []) {
  const byDate = {}
  for (const d of dayBuckets) byDate[d.date] = d

  const result = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = localDateKey(d)
    const bucket = byDate[key]
    if (bucket) {
      result.push({
        ...bucket,
        weekday: WEEKDAY_SHORT[d.getDay()],
      })
    } else {
      result.push({
        date: key,
        weekday: WEEKDAY_SHORT[d.getDay()],
        empty: true,
        avgValence: null,
        dominantEmotion: null,
      })
    }
  }
  return result
}

/** Daily mood points + weekly buckets for timeline chart. */
export function computeMoodTimeline(moodLogs = [], songs = []) {
  const entries = []

  for (const l of moodLogs) {
    entries.push({
      date: localDateKey(l.created_at),
      ts: l.created_at,
      emotion: l.emotion || 'neutral',
      valence: Number(l.valence) ?? 0.5,
      arousal: Number(l.arousal) ?? 0.5,
      source: 'mood',
      region: l.region,
      label: l.transcript?.slice(0, 60) || '',
    })
  }

  for (const s of songs) {
    entries.push({
      date: localDateKey(s.created_at),
      ts: s.created_at,
      emotion: s.emotion || 'neutral',
      valence: Number(s.valence) ?? 0.5,
      arousal: Number(s.energy) ?? 0.5,
      source: 'song',
      region: s.region,
      label: s.title || s.mood_label || 'Song created',
    })
  }

  entries.sort((a, b) => new Date(a.ts) - new Date(b.ts))

  const byDay = {}
  for (const e of entries) {
    if (!byDay[e.date]) byDay[e.date] = { date: e.date, valences: [], emotions: [], count: 0 }
    byDay[e.date].valences.push(e.valence)
    byDay[e.date].emotions.push(e.emotion)
    byDay[e.date].count += 1
  }

  const days = Object.values(byDay)
    .map(d => ({
      ...d,
      avgValence: avg(d.valences),
      dominantEmotion: topKey(countBy(d.emotions, x => x)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const last7 = buildWeekChartDays(days)
  const emotionCounts = countBy(entries.slice(-30), e => e.emotion)
  const dominantRecent = topKey(emotionCounts)

  let weeklyInsightKey = 'empty'
  if (days.length >= 3) {
    const recent = days.slice(-7)
    const trend = recent.length >= 2
      ? recent[recent.length - 1].avgValence - recent[0].avgValence
      : 0
    if (trend > 0.08) weeklyInsightKey = 'brighter'
    else if (trend < -0.08) weeklyInsightKey = 'reflective'
    else weeklyInsightKey = 'balanced'
  }

  return {
    entries: entries.slice(-60),
    days,
    last7,
    dominantRecent,
    weeklyInsightKey,
    totalCheckIns: moodLogs.length,
    totalSongs: songs.length,
  }
}

/** Cultural passport stamps — one per region after first song. */
export function computePassport(songs = []) {
  const explored = new Set(songs.map(s => s.region).filter(Boolean))
  const stamps = REGION_IDS.map(id => {
    const meta = regionMeta(id)
    const count = songs.filter(s => s.region === id).length
    return {
      ...meta,
      stamped: explored.has(id),
      songCount: count,
      firstSongAt: songs.find(s => s.region === id)?.created_at || null,
    }
  })
  const stampedCount = stamps.filter(s => s.stamped).length
  const allStamped = stampedCount === REGION_IDS.length
  const explorer = stampedCount >= 3

  return {
    stamps,
    stampedCount,
    totalRegions: REGION_IDS.length,
    explorer,
    allStamped,
    title: allStamped ? 'Global Maestro' : explorer ? 'Cultural Explorer' : 'Sound Wanderer',
    subtitle: allStamped
      ? 'Every region stamped — you are a world listener.'
      : explorer
        ? `${stampedCount} cultures explored — keep collecting stamps.`
        : 'Create songs in new regions to earn passport stamps.',
  }
}
