/** Egyptian عامية phrases for local text mood fallback (keep in sync with backend/egyptian_mood.py). */

export function normalizeArabic(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Returns core emotion key if slang matched. */
export function matchEgyptianSlang(text) {
  const norm = normalizeArabic(text)
  if (!norm) return null

  const rules = [
    { phrases: ['طفشان', 'طفشانه', 'طفشانة', 'تفشان', 'تفشانه', 'تفشانه', 'ana tafshan', 'ana tafshana'], emotion: 'disgust', nuanced: 'fedup' },
    { phrases: ['زهقت', 'زهقان', 'زهقانه', 'زهقانة'], emotion: 'disgust', nuanced: 'fedup' },
  ]

  for (const { phrases, emotion, nuanced } of rules) {
    if (phrases.some(p => norm.includes(normalizeArabic(p)))) {
      return { emotion, nuanced }
    }
  }
  return null
}
