/** Badge definitions and earn logic — used by RewardsScreen and App (on song save). */

export const BADGES = [
  { id: 'first_mood',   emoji: '🌱', label: 'First Note',     desc: 'Share your first mood',            how: 'Share any mood',                  why: 'You shared your very first mood — the journey begins!',      xpNeeded: 0,    songsNeeded: 0, streakNeeded: 0,  regionsNeeded: 0 },
  { id: 'first_song',   emoji: '🎵', label: 'Born to Create', desc: 'Generated your first track',       how: 'Generate a song',                 why: 'You generated your first AI song — a creator is born!',      xpNeeded: 0,    songsNeeded: 1, streakNeeded: 0,  regionsNeeded: 0 },
  { id: 'multilingual', emoji: '🌍', label: 'Polyglot',       desc: 'Made songs in 3 regions',          how: 'Try 3 different language regions', why: 'You explored 3 different cultural regions — truly global!',  xpNeeded: 0,    songsNeeded: 0, streakNeeded: 0,  regionsNeeded: 3 },
  { id: 'streak_3',     emoji: '🔥', label: 'On Fire',        desc: '3-day check-in streak',            how: 'Check in 3 days in a row',        why: "You checked in 3 days in a row — you're on fire!",           xpNeeded: 0,    songsNeeded: 0, streakNeeded: 3,  regionsNeeded: 0 },
  { id: 'streak_7',     emoji: '⚡', label: 'Electric',       desc: '7-day streak — unstoppable',       how: 'Check in 7 days in a row',        why: 'A full week of check-ins — absolutely electric!',            xpNeeded: 0,    songsNeeded: 0, streakNeeded: 7,  regionsNeeded: 0 },
  { id: 'composer_5',   emoji: '🎼', label: 'Prolific',       desc: 'Created 5 tracks',                 how: 'Generate 5 songs total',          why: "Five songs made — you're a prolific creator!",               xpNeeded: 0,    songsNeeded: 5, streakNeeded: 0,  regionsNeeded: 0 },
  { id: 'xp_300',       emoji: '💎', label: 'Diamond Mind',   desc: 'Reached 300 XP',                   how: 'Earn 300 XP',                     why: 'You hit 300 XP — a Diamond Mind has been forged!',           xpNeeded: 300,  songsNeeded: 0, streakNeeded: 0,  regionsNeeded: 0 },
  { id: 'night_owl',    emoji: '🦉', label: 'Night Owl',      desc: 'Created a song after midnight',    how: 'Generate a song after midnight',  why: 'A midnight creation — only Night Owls dare this!',           xpNeeded: 0,    songsNeeded: 0, streakNeeded: 0,  regionsNeeded: 0 },
  { id: 'streak_30',    emoji: '🌙', label: 'Moonwalker',     desc: '30-day streak — legendary',        how: 'Check in 30 days in a row',       why: "30 days straight — you're a true Moonwalker!",              xpNeeded: 0,    songsNeeded: 0, streakNeeded: 30, regionsNeeded: 0 },
  { id: 'xp_1000',      emoji: '⭐', label: 'Legend',         desc: 'Hit 1000 XP — you are the music', how: 'Earn 1000 XP',                    why: '1000 XP reached — you ARE the music. Legend status!',        xpNeeded: 1000, songsNeeded: 0, streakNeeded: 0,  regionsNeeded: 0 },
  { id: 'passport_3',   emoji: '🛂', label: 'Cultural Explorer', desc: 'Stamped 3 regions in your passport', how: 'Create songs in 3 regions', why: 'Three cultures explored — your passport is filling up!', xpNeeded: 0, songsNeeded: 0, streakNeeded: 0, regionsNeeded: 3 },
  { id: 'passport_all', emoji: '🌐', label: 'Global Maestro', desc: 'Stamped every cultural region', how: 'Create a song in all 7 regions', why: 'Every region stamped — you are a Global Maestro!', xpNeeded: 0, songsNeeded: 0, streakNeeded: 0, regionsNeeded: 7 },
]

/** Hour 0–4 local time = after midnight, before 5 AM. */
export function isNightOwlHour(date = new Date()) {
  const h = date.getHours()
  return h >= 0 && h < 5
}

export function isNightOwlTimestamp(ts) {
  if (!ts) return false
  return isNightOwlHour(new Date(ts))
}

export function countDistinctRegions(songs = []) {
  return new Set(songs.map(s => s.region).filter(Boolean)).size
}

export function hasNightOwlSong(songs = [], { alsoAt } = {}) {
  if (alsoAt && isNightOwlHour(alsoAt)) return true
  return songs.some(s => isNightOwlTimestamp(s.created_at))
}

export function computeMoodStreak(moodLogs = []) {
  const logDates = new Set(moodLogs.map(l => new Date(l.created_at).toDateString()))
  const today = new Date()
  let streak = 0
  for (let i = 0; i < 60; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (logDates.has(d.toDateString())) streak++
    else break
  }
  return streak
}

export function computeBadgeStats({ songs = [], moodLogs = [], xp = 0, nightOwlAlsoAt } = {}) {
  return {
    xp,
    streak: computeMoodStreak(moodLogs),
    totalSongs: songs.length,
    distinctRegions: countDistinctRegions(songs),
    hasNightOwlSong: hasNightOwlSong(songs, { alsoAt: nightOwlAlsoAt }),
  }
}

export function isBadgeEarned(badge, stats) {
  if (badge.id === 'night_owl') return stats.hasNightOwlSong
  if (badge.regionsNeeded > 0 && stats.distinctRegions < badge.regionsNeeded) return false
  if (badge.xpNeeded     > 0 && stats.xp            < badge.xpNeeded)     return false
  if (badge.streakNeeded > 0 && stats.streak         < badge.streakNeeded) return false
  if (badge.songsNeeded  > 0 && stats.totalSongs     < badge.songsNeeded)  return false
  return true
}

export function getEarnedBadges(stats) {
  return BADGES.filter(b => isBadgeEarned(b, stats))
}

function announcedKey(userId) {
  return `ekko_announced_badges_${userId}`
}

export function getAnnouncedBadgeIds(userId) {
  if (!userId) return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem(announcedKey(userId)) || '[]'))
  } catch {
    return new Set()
  }
}

export function markBadgeAnnounced(userId, badgeId) {
  if (!userId || !badgeId) return
  try {
    const ids = getAnnouncedBadgeIds(userId)
    ids.add(badgeId)
    localStorage.setItem(announcedKey(userId), JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

/** Badges earned now but not yet announced (popup / toast). */
export function getNewlyEarnedBadges(stats, userId) {
  const announced = getAnnouncedBadgeIds(userId)
  return getEarnedBadges(stats).filter(b => !announced.has(b.id))
}
