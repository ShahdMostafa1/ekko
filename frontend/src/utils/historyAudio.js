/** Single <audio> for song history — avoids duplicate elements (Strict Mode / remounts). */

let _el = null

export function getHistoryAudio() {
  if (typeof document === 'undefined') return null
  if (!_el) {
    _el = document.createElement('audio')
    _el.setAttribute('playsinline', 'true')
    _el.preload = 'auto'
    _el.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none'
    document.body.appendChild(_el)
  }
  return _el
}
