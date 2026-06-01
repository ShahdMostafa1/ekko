/** Shared product copy — keep in sync across auth, onboarding, and mood screen. */

export const EKKO_TAGLINE = 'From mood to song'

export const EKKO_HOOK =
  'The first platform that transforms how you feel into original music — in your language and culture.'

export const EKKO_HOOK_SHORT = 'Share how you feel. Ekko makes the music.'

const DEFAULT_SURVEY_STATUS = { pre_done: false, post_done: false }
const surveyStatusCache = new Map()
const surveyStatusInflight = new Map()

export function clearSurveyStatusCache(userId) {
  if (userId) {
    surveyStatusCache.delete(userId)
    surveyStatusInflight.delete(userId)
  } else {
    surveyStatusCache.clear()
    surveyStatusInflight.clear()
  }
}

export function patchSurveyStatusCache(userId, patch) {
  if (!userId) return
  const prev = surveyStatusCache.get(userId) || { ...DEFAULT_SURVEY_STATUS }
  surveyStatusCache.set(userId, { ...prev, ...patch, user_id: userId })
}

export function getCachedSurveyStatus(userId) {
  if (!userId) return null
  return surveyStatusCache.get(userId) || null
}

export async function fetchSurveyStatus(userId, { force = false } = {}) {
  if (!userId) return { ...DEFAULT_SURVEY_STATUS }

  if (!force) {
    const cached = surveyStatusCache.get(userId)
    if (cached) return cached
    const inflight = surveyStatusInflight.get(userId)
    if (inflight) return inflight
  }

  const request = (async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/survey/status/${userId}`)
      if (res.ok) {
        const data = await res.json()
        surveyStatusCache.set(userId, data)
        return data
      }
    } catch { /* ignore */ }
    return surveyStatusCache.get(userId) || { ...DEFAULT_SURVEY_STATUS, user_id: userId }
  })()

  surveyStatusInflight.set(userId, request)
  try {
    return await request
  } finally {
    surveyStatusInflight.delete(userId)
  }
}
