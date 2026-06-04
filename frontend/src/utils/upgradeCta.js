/** Upgrade plan modal — once per day per user (free plan only). */

export function upgradeCtaDismissKey(userId) {
  const today = new Date().toISOString().slice(0, 10)
  return `ekko_upgrade_dismiss_${userId}_${today}`
}

export function wasUpgradeCtaDismissed(userId) {
  if (!userId) return false
  try {
    return localStorage.getItem(upgradeCtaDismissKey(userId)) === '1'
  } catch {
    return false
  }
}

export function markUpgradeCtaDismissed(userId) {
  if (!userId) return
  try {
    localStorage.setItem(upgradeCtaDismissKey(userId), '1')
  } catch { /* ignore */ }
}
