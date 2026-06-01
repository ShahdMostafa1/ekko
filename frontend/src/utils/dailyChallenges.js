/** Daily challenges — keep in sync with backend/routers/rewards.py */

export const DAILY_CHALLENGES = [
  { id: 'dc1', emoji: '🌅', label: 'Morning Mood',  desc: 'Share a mood before noon',  xp: 15 },
  { id: 'dc2', emoji: '🎭', label: 'Emotion Flip',  desc: 'Try a new region today',    xp: 20 },
  { id: 'dc3', emoji: '🌙', label: 'Night Session', desc: 'Create a song after 9 PM',  xp: 25 },
  { id: 'dc4', emoji: '🎲', label: 'Random Vibes',  desc: 'Use the quiz mood input',   xp: 15 },
  { id: 'dc5', emoji: '🔁', label: 'Double Down',   desc: 'Generate 2 songs today',    xp: 30 },
]

export function getTodayChallenge(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date - start) / 86400000)
  return DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length]
}

export function dailyChallengeDismissKey(userId) {
  const today = new Date().toISOString().slice(0, 10)
  return `ekko_dc_dismiss_${userId}_${today}`
}

export function wasDailyChallengeDismissed(userId) {
  if (!userId) return false
  try {
    return localStorage.getItem(dailyChallengeDismissKey(userId)) === '1'
  } catch {
    return false
  }
}

export function markDailyChallengeDismissed(userId) {
  if (!userId) return
  try {
    localStorage.setItem(dailyChallengeDismissKey(userId), '1')
  } catch { /* ignore */ }
}
