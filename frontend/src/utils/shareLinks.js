/** Build canonical share URLs for the current app origin. */

export function getShareOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '')
  }
  const site = import.meta.env.VITE_SITE_URL
  if (site) return String(site).replace(/\/$/, '')
  return ''
}

export function songShareUrl(songId) {
  if (!songId) return ''
  return `${getShareOrigin()}/s/${encodeURIComponent(songId)}`
}

export function memoryShareUrl(songId) {
  if (!songId) return ''
  return `${getShareOrigin()}/m/${encodeURIComponent(songId)}`
}

export function wrappedShareUrl(userId) {
  if (!userId) return ''
  return `${getShareOrigin()}/wrapped/${encodeURIComponent(userId)}`
}

export async function copyToClipboard(text) {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}
