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
