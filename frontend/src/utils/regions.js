/** Canonical cultural regions — shared across Journey, History, Rewards. */

export const REGION_IDS = [
  'arabic',
  'west_africa',
  'india',
  'east_asia',
  'latin',
  'europe',
  'global',
]

export const REGION_META = {
  arabic:      { id: 'arabic',      emoji: '🌙', label: 'Arabic',      color: '#c9a84c', stamp: 'Moon Crescent' },
  west_africa: { id: 'west_africa', emoji: '🥁', label: 'West Africa', color: '#e07b39', stamp: 'Rhythm Drum' },
  india:       { id: 'india',       emoji: '🪔', label: 'India',       color: '#d4518a', stamp: 'Sacred Lamp' },
  east_asia:   { id: 'east_asia',   emoji: '🌸', label: 'East Asia',   color: '#7eb8c9', stamp: 'Cherry Bloom' },
  latin:       { id: 'latin',       emoji: '🎺', label: 'Latin',       color: '#e04f4f', stamp: 'Brass Soul' },
  europe:      { id: 'europe',      emoji: '🎻', label: 'Europe',      color: '#6e8efb', stamp: 'Classical Arc' },
  global:      { id: 'global',      emoji: '🌍', label: 'Global Mix',  color: '#7c5ce7', stamp: 'World Bridge' },
}

export const EMOTION_EMOJI = {
  joy: '☀️', sadness: '🌧️', anger: '🔥', fear: '🌀', surprise: '⚡',
  disgust: '🌫️', neutral: '🌿', nostalgia: '🕯️', hope: '🌅', love: '💜',
  anxiety: '😰', calm: '🧘', energetic: '⚡', motivated: '🚀',
}

export function regionMeta(id) {
  return REGION_META[id] || REGION_META.global
}
