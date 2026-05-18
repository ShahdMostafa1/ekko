// Full note maps for every scale
const SCALE_NOTES = {
  'C major': ['C4','D4','E4','F4','G4','A4','B4','C5'],
  'D minor': ['D4','E4','F4','G4','A4','Bb4','C5','D5'],
  'G major': ['G3','A3','B3','C4','D4','E4','F#4','G4'],
  'A minor': ['A3','B3','C4','D4','E4','F4','G4','A4'],
  'F major': ['F3','G3','A3','Bb3','C4','D4','E4','F4'],
  'B minor': ['B3','C#4','D4','E4','F#4','G4','A4','B4'],
  'E minor': ['E3','F#3','G3','A3','B3','C4','D4','E4'],
  'D major': ['D4','E4','F#4','G4','A4','B4','C#5','D5'],
}

// Pick notes that feel right for the energy/valence
export function buildNotes(scale, energy = 0.5, valence = 0.5) {
  const pool = SCALE_NOTES[scale] || SCALE_NOTES['C major']

  // High energy = more notes, wider jumps
  // Low energy = fewer notes, stepwise motion
  const count = energy > 0.7 ? 6 : energy > 0.4 ? 5 : 4

  if (energy > 0.6 && valence > 0.6) {
    // Happy + energetic: bright ascending phrase
    return pool.slice(0, count)
  } else if (energy < 0.4 && valence < 0.4) {
    // Sad + slow: descending, lower register
    return [...pool].reverse().slice(0, count)
  } else if (energy > 0.6 && valence < 0.4) {
    // Tense + fast: angular, skippy intervals
    return [pool[0], pool[2], pool[4], pool[1], pool[3], pool[6]].slice(0, count)
  } else if (energy < 0.4 && valence > 0.6) {
    // Calm + positive: gentle stepwise
    return pool.slice(2, 2 + count)
  } else {
    // Neutral: middle of the pool
    const mid = Math.floor(pool.length / 2) - Math.floor(count / 2)
    return pool.slice(mid, mid + count)
  }
}

export function buildDescription(moodLabel, scale, tempo, instruments) {
  const tempoWord = tempo < 70 ? 'slow' : tempo < 90 ? 'gentle' : tempo < 110 ? 'moderate' : tempo < 130 ? 'upbeat' : 'driving'
  const instrStr = instruments?.join(', ') || 'piano'
  return `A ${tempoWord} ${scale} piece for ${moodLabel?.toLowerCase() || 'your mood'}, played on ${instrStr}.`
}