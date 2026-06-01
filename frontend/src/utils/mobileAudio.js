/** Mobile (iOS Safari, Android Chrome/WebView) audio playback helpers. */

export function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /MacIntel/.test(navigator.platform))
}

export function isMobileBrowser() {
  return isAndroid() || isIOS()
}

/** True when VITE_API_URL is a different origin than the page (needs CORS + crossOrigin). */
export function audioNeedsCrossOrigin() {
  const api = import.meta.env.VITE_API_URL
  if (!api || typeof window === 'undefined') return false
  try {
    return new URL(api).origin !== window.location.origin
  } catch {
    return false
  }
}

/** Props for <audio> — playsInline (incl. legacy WebKit), preload tuned for Android. */
export function mobileAudioElementProps() {
  const props = {
    playsInline: true,
    preload: isAndroid() ? 'metadata' : isMobileBrowser() ? 'metadata' : 'auto',
  }
  if (audioNeedsCrossOrigin()) {
    props.crossOrigin = 'anonymous'
  }
  return props
}

/** Apply src and call load() — required on Android when src changes. */
export function applyAudioSource(el, src) {
  if (!el || !src) return
  let resolved = src
  try {
    resolved = new URL(src, window.location.href).href
  } catch { /* keep src */ }
  const current = el.currentSrc || el.src || ''
  if (current === resolved || current === src) return
  el.src = src
  el.load()
}

/** Play after a user gesture; returns false if blocked. */
export async function playFromUserGesture(el) {
  if (!el) return false
  try {
    await el.play()
    return true
  } catch {
    return false
  }
}

let _blobUrl = null

export function revokeBlobAudioUrl() {
  if (_blobUrl) {
    URL.revokeObjectURL(_blobUrl)
    _blobUrl = null
  }
}

/**
 * Android fallback: fetch proxied stream into a blob URL (same CORS rules as <audio>).
 * Returns blob URL or null on failure.
 */
export async function fetchBlobAudioUrl(streamUrl) {
  if (!streamUrl || !isAndroid()) return null
  revokeBlobAudioUrl()
  try {
    const res = await fetch(streamUrl, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.size) return null
    _blobUrl = URL.createObjectURL(blob)
    return _blobUrl
  } catch {
    return null
  }
}

/** Configure a programmatic Audio() instance for mobile playback. */
export function configureMobileAudio(audio, url) {
  if (!audio || !url) return audio
  audio.preload = isAndroid() ? 'metadata' : 'auto'
  if (audioNeedsCrossOrigin()) {
    audio.crossOrigin = 'anonymous'
  }
  applyAudioSource(audio, url)
  return audio
}
