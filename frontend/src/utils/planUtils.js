/** Plan helpers — keep in sync with PlansScreen + backend music.py */

export const PLAN_LIMITS = {
  free:   { dailyGenerations: 5,  historyLimit: 10 },
  groove: { dailyGenerations: 50, historyLimit: null },
  studio: { dailyGenerations: null, historyLimit: null },
}

/** Core emotions available on Free (7). Paid unlocks all 20 nuanced moods. */
export const FREE_CORE_EMOTIONS = new Set([
  'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral',
])

/** Free users pick Global Mix only; Groove/Studio unlock all 7 regions. */
export const FREE_REGION_IDS = new Set(['global'])

const NUANCED_TO_CORE = {
  nostalgia: 'sadness', exhaustion: 'sadness', loneliness: 'sadness', grief: 'sadness',
  frustration: 'anger', passion: 'anger',
  euphoria: 'joy', tenderness: 'joy',
  calm: 'neutral', hope: 'neutral', wonder: 'surprise',
  bittersweet: 'sadness', fedup: 'disgust',
}

export function isPaidPlan(plan) {
  return plan === 'groove' || plan === 'studio'
}

/** Free plan: first N artists per region list; Groove/Studio: all. */
export const FREE_ARTISTS_PER_REGION = 2

/** XP cost for artists at list positions 3–7 (index 2–6), per region. */
export const ARTIST_XP_UNLOCK_COST = 2500
export const XP_ELIGIBLE_ARTISTS_PER_REGION = 5

export function isXpEligibleArtistIndex(index) {
  return (
    index >= FREE_ARTISTS_PER_REGION
    && index < FREE_ARTISTS_PER_REGION + XP_ELIGIBLE_ARTISTS_PER_REGION
  )
}

export function canUseArtistStyles(plan) {
  return true
}

export function isArtistStyleUnlocked(artistIndex, plan, unlockedArtistIds = []) {
  if (isPaidPlan(plan)) return true
  if (artistIndex < FREE_ARTISTS_PER_REGION) return true
  return false
}

/** Prefer API `style.unlocked`; this is a fallback when flags are missing. */
export function isArtistUnlockedFromApi(style, artistIndex, plan) {
  if (style?.unlocked != null) return !!style.unlocked
  return isArtistStyleUnlocked(artistIndex, plan)
}

export function canDownload(plan) {
  return isPaidPlan(plan)
}

export function historyLimitFor(plan) {
  return PLAN_LIMITS[plan]?.historyLimit ?? PLAN_LIMITS.free.historyLimit
}

export function isRegionUnlocked(regionId, plan) {
  if (isPaidPlan(plan)) return true
  return FREE_REGION_IDS.has(regionId)
}

export function clampEmotionForPlan(emotion, plan) {
  if (isPaidPlan(plan)) return emotion
  if (FREE_CORE_EMOTIONS.has(emotion)) return emotion
  return NUANCED_TO_CORE[emotion] || 'neutral'
}

export function applyHistoryLimit(songs, plan) {
  const limit = historyLimitFor(plan)
  if (!limit || songs.length <= limit) return { visible: songs, truncated: false, hidden: 0 }
  const sorted = [...songs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return { visible: sorted.slice(0, limit), truncated: true, hidden: songs.length - limit }
}

export function dailyLimitFor(plan) {
  return PLAN_LIMITS[plan]?.dailyGenerations ?? PLAN_LIMITS.free.dailyGenerations
}

export function hasPriorityQueue(plan) {
  return isPaidPlan(plan)
}

export function hasCommercialLicense(plan) {
  return plan === 'studio'
}

export function canUseApiAccess(plan) {
  return plan === 'studio'
}
