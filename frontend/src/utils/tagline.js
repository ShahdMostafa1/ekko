/** Shared product copy — keep in sync across auth, onboarding, and mood screen. */

export const EKKO_TAGLINE = 'From mood to song'

export const EKKO_HOOK =
  'The first platform that transforms how you feel into original music — in your language and culture.'

export const EKKO_HOOK_SHORT = 'Share how you feel. Ekko makes the music.'

export async function fetchSurveyStatus(userId) {
  if (!userId) return { pre_done: false, post_done: false }
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/survey/status/${userId}`)
    if (res.ok) return await res.json()
  } catch { /* ignore */ }
  return { pre_done: false, post_done: false }
}
