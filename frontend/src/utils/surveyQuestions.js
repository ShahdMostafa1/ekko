/** Pre/post study survey — scales match each question (stored as 1–5 for analysis). */

import {
  PRE_QUESTIONS_AR,
  POST_QUESTIONS_AR,
  SCALE_BY_FIELD_AR,
  AGE_GROUPS_AR,
  MOOD_APP_USE_AR,
  PRIMARY_GOALS_AR,
  GENRES_AR,
  EXPECTATIONS_MET_AR,
  ASPECTS_AR,
  WEAKNESS_OPTIONS_AR,
} from './surveyQuestionsAr.js'

export function getPreQuestions(locale) {
  return locale === 'ar' ? PRE_QUESTIONS_AR : PRE_QUESTIONS
}

export function getPostQuestions(locale) {
  return locale === 'ar' ? POST_QUESTIONS_AR : POST_QUESTIONS
}

export const FREQUENCY_5 = [
  { value: 1, label: 'Rarely' },
  { value: 2, label: 'A few times a month' },
  { value: 3, label: 'A few times a week' },
  { value: 4, label: 'Most days' },
  { value: 5, label: 'Every day' },
]

export const AI_FAMILIARITY_5 = [
  { value: 1, label: 'Not at all familiar' },
  { value: 2, label: 'Heard of them, never used' },
  { value: 3, label: 'Tried once or twice' },
  { value: 4, label: 'Use occasionally' },
  { value: 5, label: 'Use regularly / very familiar' },
]

export const IMPORTANCE_5 = [
  { value: 1, label: 'Not important to me' },
  { value: 2, label: 'Slightly important' },
  { value: 3, label: 'Moderately important' },
  { value: 4, label: 'Very important' },
  { value: 5, label: 'Essential — central to my taste' },
]

export const MOOD_MATCH_EXPECTATION_5 = [
  { value: 1, label: 'Not accurate at all' },
  { value: 2, label: 'Slightly accurate' },
  { value: 3, label: 'Moderately accurate' },
  { value: 4, label: 'Very accurate' },
  { value: 5, label: 'Extremely accurate' },
]

export const QUALITY_EXPECTATION_5 = [
  { value: 1, label: 'Demo / low quality' },
  { value: 2, label: 'Below average' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'Good / polished' },
  { value: 5, label: 'Professional / studio-level' },
]

export const SATISFACTION_5 = [
  { value: 1, label: 'Very poor' },
  { value: 2, label: 'Poor' },
  { value: 3, label: 'Okay / mixed' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Excellent' },
]

export const EASE_5 = [
  { value: 1, label: 'Very difficult' },
  { value: 2, label: 'Difficult' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Easy' },
  { value: 5, label: 'Very easy' },
]

export const ACCURACY_5 = [
  { value: 1, label: 'Very inaccurate' },
  { value: 2, label: 'Inaccurate' },
  { value: 3, label: 'Somewhat accurate' },
  { value: 4, label: 'Accurate' },
  { value: 5, label: 'Very accurate' },
]

export const QUALITY_RATING_5 = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Below average' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Excellent' },
]

export const CULTURAL_FIT_5 = [
  { value: 1, label: 'Not a fit at all' },
  { value: 2, label: 'Slightly fitting' },
  { value: 3, label: 'Somewhat fitting' },
  { value: 4, label: 'Mostly fitting' },
  { value: 5, label: 'Perfect cultural fit' },
]

export const USEFULNESS_5 = [
  { value: 1, label: 'Not useful' },
  { value: 2, label: 'Slightly useful' },
  { value: 3, label: 'Moderately useful' },
  { value: 4, label: 'Very useful' },
  { value: 5, label: 'Extremely useful' },
]

export const RECOMMEND_5 = [
  { value: 1, label: 'Would not recommend' },
  { value: 2, label: 'Probably would not' },
  { value: 3, label: 'Might or might not' },
  { value: 4, label: 'Probably would' },
  { value: 5, label: 'Would strongly recommend' },
]

export const USE_AGAIN_5 = [
  { value: 1, label: 'Definitely not' },
  { value: 2, label: 'Unlikely' },
  { value: 3, label: 'Not sure' },
  { value: 4, label: 'Likely' },
  { value: 5, label: 'Definitely yes' },
]

/** Map numeric fields → scale options (admin labels & exports). */
export const SCALE_BY_FIELD = {
  music_frequency: FREQUENCY_5,
  ai_familiarity: AI_FAMILIARITY_5,
  cultural_importance: IMPORTANCE_5,
  expected_mood_match: MOOD_MATCH_EXPECTATION_5,
  expected_quality: QUALITY_EXPECTATION_5,
  experience_rating: SATISFACTION_5,
  ease_of_use: EASE_5,
  mood_accuracy: ACCURACY_5,
  music_quality: QUALITY_RATING_5,
  cultural_fit: CULTURAL_FIT_5,
  lyrics_quality: QUALITY_RATING_5,
  cocreation_rating: USEFULNESS_5,
  recommend_score: RECOMMEND_5,
  would_use_again: USE_AGAIN_5,
}

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
  { type: 'scale', key: 'music_frequency', label: 'How often do you listen to music?', scale: FREQUENCY_5, required: true },
  { type: 'scale', key: 'ai_familiarity', label: 'How familiar are you with AI music tools?', scale: AI_FAMILIARITY_5, required: true },
  { type: 'choice', key: 'used_mood_apps', label: 'Have you used mood-based or emotion apps before?', options: MOOD_APP_USE, required: true },
  { type: 'choice', key: 'primary_goal', label: 'What is your main reason for trying Ekko?', options: PRIMARY_GOALS, required: true },
  { type: 'scale', key: 'cultural_importance', label: 'How important is culturally authentic music to you?', scale: IMPORTANCE_5, required: true },
  { type: 'scale', key: 'expected_mood_match', label: 'Before using Ekko, how accurate do you expect mood-to-song matching to be?', scale: MOOD_MATCH_EXPECTATION_5, required: true },
  { type: 'scale', key: 'expected_quality', label: 'Before using Ekko, what quality of music do you expect?', scale: QUALITY_EXPECTATION_5, required: true },
  { type: 'multi', key: 'genre_preferences', label: 'Which genres do you enjoy? (select all that apply)', options: GENRES, required: true, min: 1 },
  { type: 'text', key: 'loved_artists', label: 'Favourite artists (names, genres, or styles)', placeholder: 'e.g. Burna Boy, Fairuz, Taylor Swift, Khruangbin…', required: true, rows: 2 },
]

export const POST_QUESTIONS = [
  { type: 'scale', key: 'experience_rating', label: 'Overall, how was your experience with Ekko?', scale: SATISFACTION_5, required: true },
  { type: 'scale', key: 'ease_of_use', label: 'How easy was Ekko to use?', scale: EASE_5, required: true },
  { type: 'scale', key: 'mood_accuracy', label: 'How well did Ekko detect your mood?', scale: ACCURACY_5, required: true },
  { type: 'scale', key: 'music_quality', label: 'How would you rate the music quality?', scale: QUALITY_RATING_5, required: true },
  { type: 'scale', key: 'cultural_fit', label: 'How well did the song fit your chosen culture / region?', scale: CULTURAL_FIT_5, required: true },
  { type: 'scale', key: 'lyrics_quality', label: 'How would you rate the lyrics?', scale: QUALITY_RATING_5, required: true },
  { type: 'scale', key: 'cocreation_rating', label: 'How useful were the co-creation tools (mood + instruments)?', scale: USEFULNESS_5, required: true },
  { type: 'choice', key: 'expectations_met', label: 'Did Ekko meet your expectations?', options: EXPECTATIONS_MET, required: true },
  { type: 'scale', key: 'recommend_score', label: 'How likely are you to recommend Ekko to a friend?', scale: RECOMMEND_5, required: true },
  { type: 'scale', key: 'would_use_again', label: 'How likely are you to use Ekko again?', scale: USE_AGAIN_5, required: true },
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

export function validateSurveyForm(form, phase, locale = 'en') {
  const questions = phase === 'pre' ? getPreQuestions(locale) : getPostQuestions(locale)
  const suffix = locale === 'ar' ? 'مطلوب.' : 'is required.'
  for (const q of questions) {
    if (!q.required) continue
    const val = form[q.key]
    if ((q.type === 'scale' || q.type === 'likert') && (!val || val < 1)) return `${q.label} ${suffix}`
    if (q.type === 'choice' && !val) return `${q.label} ${suffix}`
    if (q.type === 'multi' && (!val?.length || val.length < (q.min || 1))) return `${q.label} ${suffix}`
    if (q.type === 'text' && q.required && !String(val || '').trim()) return `${q.label} ${suffix}`
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
export function labelFor(field, value, locale = 'en') {
  if (value == null || value === '') return '—'
  const scale = locale === 'ar' ? (SCALE_BY_FIELD_AR[field] || SCALE_BY_FIELD[field]) : SCALE_BY_FIELD[field]
  if (scale) {
    const n = Number(value)
    return scale.find(s => s.value === n)?.label || String(value)
  }
  const mapsEn = {
    age_group: AGE_GROUPS,
    used_mood_apps: MOOD_APP_USE,
    primary_goal: PRIMARY_GOALS,
    expectations_met: EXPECTATIONS_MET,
    strongest_aspect: ASPECTS,
    weakest_aspect: WEAKNESS_OPTIONS,
  }
  const mapsAr = {
    age_group: AGE_GROUPS_AR,
    used_mood_apps: MOOD_APP_USE_AR,
    primary_goal: PRIMARY_GOALS_AR,
    expectations_met: EXPECTATIONS_MET_AR,
    strongest_aspect: ASPECTS_AR,
    weakest_aspect: WEAKNESS_OPTIONS_AR,
  }
  const list = (locale === 'ar' ? mapsAr : mapsEn)[field]
  if (list) return list.find(o => o.id === value)?.label || value
  if (field === 'genre_preferences') {
    try {
      const ids = typeof value === 'string' ? JSON.parse(value) : value
      const genres = locale === 'ar' ? GENRES_AR : GENRES
      return ids.map(id => genres.find(g => g.id === id)?.label || id).join(', ')
    } catch { return value }
  }
  return String(value)
}
