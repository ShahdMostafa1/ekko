import { useState } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { copyToClipboard } from '../utils/shareLinks'

/**
 * Copy link + optional native share for outbound sharing.
 * @param {string} url — full https link to open the shared view
 * @param {string} [title] — native share title
 * @param {string} [text] — extra line before URL in share sheet / clipboard
 */
export default function ShareActions({
  url,
  title = 'Ekko',
  text = '',
  disabled = false,
  compact = false,
  onCopied,
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const shareBody = text ? `${text}\n\n${url}` : url

  const handleCopy = async () => {
    if (!url || disabled) return
    setBusy(true)
    const ok = await copyToClipboard(url)
    setBusy(false)
    if (ok) {
      setCopied(true)
      onCopied?.()
      setTimeout(() => setCopied(false), 2200)
    }
  }

  const handleNativeShare = async () => {
    if (!url || disabled) return
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareBody, url })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    await handleCopy()
  }

  const btnStyle = compact
    ? { padding: '8px 12px', fontSize: 17 }
    : { padding: '12px 16px', fontSize: 19 }

  return (
    <div className={`share-actions${compact ? ' share-actions--compact' : ''}`}>
      <button
        type="button"
        className="share-actions__btn share-actions__btn--primary"
        style={btnStyle}
        onClick={handleCopy}
        disabled={disabled || busy || !url}
      >
        {copied ? t('share.linkCopied') : t('share.copyLink')}
      </button>
      {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
        <button
          type="button"
          className="share-actions__btn"
          style={btnStyle}
          onClick={handleNativeShare}
          disabled={disabled || !url}
        >
          {t('share.share')}
        </button>
      )}
    </div>
  )
}
