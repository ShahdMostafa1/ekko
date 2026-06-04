/** Normalize Sonauto CDN paths to a full https URL. */
export function directSonautoUrl(audioUrl) {
  if (!audioUrl) return null
  const u = String(audioUrl).trim()
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('//')) return `https:${u}`
  if (u.startsWith('/')) return `https://cdn.sonauto.ai${u}`
  return `https://cdn.sonauto.ai/${u.replace(/^\//, '')}`
}

/** Play Sonauto CDN audio through our API (avoids CORS / mobile Safari & Android Chrome). */

export function proxiedAudioUrl(audioUrl, taskId) {
  const api = import.meta.env.VITE_API_URL
  if (!api) return directSonautoUrl(audioUrl) || null
  // Prefer CDN URL once we have it — avoids /stream/{task} while Sonauto is still GENERATING (409).
  const direct = directSonautoUrl(audioUrl)
  if (direct) {
    return `${api}/music/stream?url=${encodeURIComponent(direct)}`
  }
  if (taskId) {
    return `${api}/music/stream/${encodeURIComponent(taskId)}`
  }
  return null
}

/** URL for "open in new tab" — redirects to Sonauto CDN (works on iPhone Safari). */
export function openAudioUrl(audioUrl, taskId) {
  const api = import.meta.env.VITE_API_URL
  const direct = directSonautoUrl(audioUrl)
  if (direct && api) {
    return `${api}/music/open?url=${encodeURIComponent(direct)}`
  }
  if (taskId && api) {
    return `${api}/music/open/${encodeURIComponent(taskId)}`
  }
  return direct || proxiedAudioUrl(audioUrl, taskId)
}
