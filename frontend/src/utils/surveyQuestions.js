/** Pre/post study survey — structured for thesis analysis (Likert + options). */

export const LIKERT_5 = [
  { value: 1, label: '1', hint: 'Strongly disagree' },
  { value: 2, label: '2', hint: 'Disagree' },
  { value: 3, label: '3', hint: 'Neutral' },
  { value: 4, label: '4', hint: 'Agree' },
  { value: 5, label: '5', hint: 'Strongly agree' },
]

export const FREQUENCY_5 = [
  { value: 1, label: '1', hint: 'Rarely' },
  { value: 2, label: '2', hint: 'Monthly' },
  { value: 3, label: '3', hint: 'Weekly' },
  { value: 4, label: '4', hint: 'Most days' },
  { value: 5, label: '5', hint: 'Daily' },
]

export const AGE_GROUPS = [
  { id: 'under_18', label: 'Under 18' },
  { id: '18-24', label: '18–24' },
  { id: '25-34', label: '25–34' },
  { id: '35-44', label: '35–44' },
  { id: '45+',   label: '45+' },
]

export const MOOD_APP_USE = [
  { id: 'yes',      label: 'Yes' },
  { id: 'no',       label: 'No' },
  { id: 'not_sure', label: 'Not sure' },
]

export const PRIMARY_GOALS = [
  { id: 'express_emotion', label: 'Express emotions through music' },
  { id: 'explore_culture', label: 'Explore cultures & regions' },
  { id: 'share_content',   label: 'Create shareable content' },
  { id: 'ai_curiosity',    label: 'Curiosity about AI music' },
  { id: 'study',           label: 'Academic / study participation' },
  { id: 'fun',             label: 'Fun & entertainment' },
]

export const GENRES = [
  { id: 'pop',        label: 'Pop' },
  { id: 'hiphop_rnb', label: 'Hip-hop / R&B' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'rock',       label: 'Rock' },
  { id: 'classical',  label: 'Classical' },
  { id: 'jazz',       label: 'Jazz' },
  { id: 'arabic',     label: 'Arabic' },
  { id: 'latin',      label: 'Latin' },
  { id: 'afrobeat',   label: 'Afrobeat' },
  { id: 'kpop',       label: 'K-pop' },
  { id: 'indian',     label: 'Indian' },
  { id: 'east_asian', label: 'East Asian' },
  { id: 'world',      label: 'World / Global mix' },
]

export const EXPECTATIONS_MET = [
  { id: 'exceeded',  label: 'Exceeded expectations' },
  { id: 'met',       label: 'Met expectations' },
  { id: 'partial',   label: 'Partially met' },
  { id: 'not_met',   label: 'Did not meet expectations' },
]

export const ASPECTS = [
  { id: 'mood_detection', label: 'Mood detection' },
  { id: 'music_quality',  label: 'Music quality' },
  { id: 'cultural_fit',   label: 'Cultural / regional fit' },
  { id: 'cocreation',     label: 'Co-creation tools' },
  { id: 'speed',          label: 'Generation speed' },
  { id: 'ease_of_use',    label: 'Ease of use' },
  { id: 'lyrics',         label: 'Lyrics quality' },
]

export const WEAKNESS_OPTIONS = [
  ...ASPECTS,
  { id: 'nothing_major', label: 'Nothing major' },
]

export const PRE_QUESTIONS = [
  { type: 'choice', key: 'age_group', label: 'Age group', options: AGE_GROUPS, required: true },
  { type: 'likert', key: 'music_frequency', label: 'How often do you listen to music?', scale: FREQUENCY_5, required: true },
  { type: 'likert', key: 'ai_familiarity', label: 'How familiar are you with AI music tools?', scale: LIKERT_5, required: true },
  { type: 'choice', key: 'used_mood_apps', label: 'Have you used mood-based or emotion apps before?', options: MOOD_APP_USE, required: true },
  { type: 'choice', key: 'primary_goal', label: 'What is your main reason for trying Ekko?', options: PRIMARY_GOALS, required: true },
  { type: 'likert', key: 'cultural_importance', label: 'How important is culturally authentic music to you?', scale: LIKERT_5, required: true },
  { type: 'likert', key: 'expected_mood_match', label: 'Before using Ekko, how accurate do you expect mood-to-song matching to be?', scale: LIKERT_5, required: true },
  { type: 'likert', key: 'expected_quality', label: 'Before using Ekko, what quality of music do you expect?', scale: LIKERT_5, required: true },
  { type: 'multi', key: 'genre_preferences', label: 'Which genres do you enjoy? (select all that apply)', options: GENRES, required: true, min: 1 },
  { type: 'text', key: 'loved_artists', label: 'Favourite artists (names, genres, or styles)', placeholder: 'e.g. Burna Boy, Fairuz, Taylor Swift, Khruangbin…', required: true, rows: 2 },
]

export const POST_QUESTIONS = [
  { type: 'likert', key: 'experience_rating', label: 'Overall experience with Ekko', scale: LIKERT_5, required: true },
  { type: 'likert', key: 'ease_of_use', label: 'Ease of use', scale: LIKERT_5, required: true },
  { type: 'likert', key: 'mood_accuracy', label: 'Mood detection accuracy', scale: LIKERT_5, required: true },
  { type: 'likert', key: 'music_quality', label: 'Music output quality', scale: LIKERT_5, required: true },
  { type: 'likert', key: 'cultural_fit', label: 'Cultural / regional fit of the song', scale: LIKERT_5, required: true },
  { type: 'likert', key: 'lyrics_quality', label: 'Lyrics quality', scale: LIKERT_5, required: true },
  { type: 'likert', key: 'cocreation_rating', label: 'Usefulness of co-creation (mood + instruments)', scale: LIKERT_5, required: true },
  { type: 'choice', key: 'expectations_met', label: 'Did Ekko meet your expectations?', options: EXPECTATIONS_MET, required: true },
  { type: 'likert', key: 'recommend_score', label: 'How likely are you to recommend Ekko?', scale: LIKERT_5, required: true },
  { type: 'likert', key: 'would_use_again', label: 'How likely are you to use Ekko again?', scale: LIKERT_5, required: true },
  { type: 'choice', key: 'strongest_aspect', label: 'What worked best for you?', options: ASPECTS, required: true },
  { type: 'choice', key: 'weakest_aspect', label: 'What needs the most improvement?', options: WEAKNESS_OPTIONS, required: true },
]

export const EMPTY_SURVEY_FORM = {
  age_group: '',
  music_frequency: 0,
  ai_familiarity: 0,
  used_mood_apps: '',
  primary_goal: '',
  cultural_importance: 0,
  expected_mood_match: 0,
  expected_quality: 0,
  genre_preferences: [],
  loved_artists: '',
  experience_rating: 0,
  ease_of_use: 0,
  mood_accuracy: 0,
  music_quality: 0,
  cultural_fit: 0,
  lyrics_quality: 0,
  cocreation_rating: 0,
  expectations_met: '',
  recommend_score: 0,
  would_use_again: 0,
  strongest_aspect: '',
  weakest_aspect: '',
  improvements_needed: '',
}

export function validateSurveyForm(form, phase) {
  const questions = phase === 'pre' ? PRE_QUESTIONS : POST_QUESTIONS
  for (const q of questions) {
    if (!q.required) continue
    const val = form[q.key]
    if (q.type === 'likert' && (!val || val < 1)) return `${q.label} is required.`
    if (q.type === 'choice' && !val) return `${q.label} is required.`
    if (q.type === 'multi' && (!val?.length || val.length < (q.min || 1))) return `${q.label} is required.`
    if (q.type === 'text' && q.required && !String(val || '').trim()) return `${q.label} is required.`
  }
  return null
}

export function buildSurveyPayload(form, userId, phase) {
  const base = {
    user_id: userId,
    phase,
    improvements_needed: form.improvements_needed?.trim() || null,
  }
  if (phase === 'pre') {
    return {
      ...base,
      age_group: form.age_group || null,
      music_frequency: form.music_frequency || null,
      ai_familiarity: form.ai_familiarity || null,
      used_mood_apps: form.used_mood_apps || null,
      primary_goal: form.primary_goal || null,
      cultural_importance: form.cultural_importance || null,
      expected_mood_match: form.expected_mood_match || null,
      expected_quality: form.expected_quality || null,
      genre_preferences: form.genre_preferences?.length
        ? JSON.stringify(form.genre_preferences)
        : null,
      loved_artists: form.loved_artists?.trim() || null,
    }
  }
  return {
    ...base,
    experience_rating: form.experience_rating || null,
    ease_of_use: form.ease_of_use || null,
    mood_accuracy: form.mood_accuracy || null,
    music_quality: form.music_quality || null,
    cultural_fit: form.cultural_fit || null,
    lyrics_quality: form.lyrics_quality || null,
    cocreation_rating: form.cocreation_rating || null,
    expectations_met: form.expectations_met || null,
    recommend_score: form.recommend_score || null,
    would_use_again: form.would_use_again || null,
    strongest_aspect: form.strongest_aspect || null,
    weakest_aspect: form.weakest_aspect || null,
  }
}

/** Label lookup for admin / export */
export function labelFor(field, value) {
  if (value == null || value === '') return '—'
  const maps = {
    age_group: AGE_GROUPS,
    used_mood_apps: MOOD_APP_USE,
    primary_goal: PRIMARY_GOALS,
    expectations_met: EXPECTATIONS_MET,
    strongest_aspect: ASPECTS,
    weakest_aspect: WEAKNESS_OPTIONS,
  }
  const list = maps[field]
  if (list) return list.find(o => o.id === value)?.label || value
  if (field === 'genre_preferences') {
    try {
      const ids = typeof value === 'string' ? JSON.parse(value) : value
      return ids.map(id => GENRES.find(g => g.id === id)?.label || id).join(', ')
    } catch { return value }
  }
  return String(value)
}
