export const ESTIMATED_WAIT_SEC = 90;

export function generationPhase(elapsed, isPriority, t) {
  if (isPriority && elapsed < 12) return t('player.priorityQueue');
  if (elapsed < 12) return t('player.pollingLyrics');
  if (elapsed < 24) return t('player.pollingMelody');
  if (elapsed < 45) return t('player.pollingVocals');
  if (elapsed < 75) return t('player.pollingMixing');
  return t('player.pollingFinishing');
}

export function secondsRemaining(elapsed, estimate = ESTIMATED_WAIT_SEC) {
  return Math.max(0, estimate - elapsed);
}

export function progressPercent(elapsed, estimate = ESTIMATED_WAIT_SEC) {
  return Math.min(96, Math.round((elapsed / estimate) * 100));
}
