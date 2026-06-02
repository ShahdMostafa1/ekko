/** Play Sonauto CDN audio through our API (avoids CORS / mobile Safari & Android Chrome). */

export function proxiedAudioUrl(audioUrl, taskId) {
  const api = import.meta.env.VITE_API_URL
  if (!api) return audioUrl || null
  if (taskId) {
    return `${api}/music/stream/${encodeURIComponent(taskId)}`
  }
  if (audioUrl) {
    return `${api}/music/stream?url=${encodeURIComponent(audioUrl)}`
  }
  return null
}

/** URL for "open in new tab" — redirects to Sonauto CDN (works on iPhone Safari). */
export function openAudioUrl(audioUrl, taskId) {
  const api = import.meta.env.VITE_API_URL
  if (taskId && api) {
    return `${api}/music/open/${encodeURIComponent(taskId)}`
  }
  if (audioUrl && /^https?:\/\//i.test(audioUrl)) {
    if (api && !audioUrl.includes('/music/stream')) {
      return `${api}/music/open?url=${encodeURIComponent(audioUrl)}`
    }
    return audioUrl
  }
  return proxiedAudioUrl(audioUrl, taskId)
}
