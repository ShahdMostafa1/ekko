import { normalizeArabic } from './egyptianMoodWords'

/** Normalize text for instant substring search (Latin + Arabic). */
export function normalizeForSearch(text) {
  const s = String(text ?? '')
  if (!s.trim()) return ''
  if (/[\u0600-\u06FF]/.test(s)) return normalizeArabic(s)
  return s.toLowerCase().trim()
}

/** True once the user has typed at least one non-whitespace character. */
export function searchQueryActive(query) {
  return normalizeForSearch(query).length > 0
}

/** Match if query is empty or any value contains the query as a substring. */
export function matchesInstantSearch(query, ...values) {
  const q = normalizeForSearch(query)
  if (!q) return true
  return values.some(v => normalizeForSearch(v).includes(q))
}

/** Filter a list — runs on every keystroke; no minimum length. */
export function filterByInstantSearch(items, query, getValues) {
  const q = normalizeForSearch(query)
  if (!q) return items
  return items.filter(item => matchesInstantSearch(query, ...getValues(item)))
}
