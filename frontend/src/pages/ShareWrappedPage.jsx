import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import WrappedDisplay from '../components/WrappedDisplay'
import { computeWrapped } from '../utils/insights'

const api = () => import.meta.env.VITE_API_URL

export default function ShareWrappedPage({ userId }) {
  const { t } = useI18n()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${api()}/share/wrapped/${encodeURIComponent(userId)}`)
        if (!res.ok) {
          setError(res.status === 404 ? t('share.notFound') : t('share.loadError'))
          return
        }
        const data = await res.json()
        if (!cancelled) setPayload(data)
      } catch {
        if (!cancelled) setError(t('share.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId, t])

  const wrapped = useMemo(() => {
    if (!payload) return null
    return computeWrapped({
      songs: payload.songs || [],
      moodLogs: payload.mood_logs || [],
      xp: payload.xp || 0,
      year: payload.year,
      displayName: payload?.display_name || '',
    })
  }, [payload])

  return (
    <div className="share-page share-page--wrapped">
      <div className="share-page__stars" aria-hidden="true" />
      <header className="share-page__header">
        <a href="/" className="share-page__brand">Ekko</a>
        <p className="share-page__tag">{t('share.wrappedTag')}</p>
      </header>
      <main className="share-page__main share-page__main--wide">
        {loading && <p className="share-page__status">{t('share.loading')}</p>}
        {error && (
          <div className="share-page__empty">
            <p>{error}</p>
            <a href="/" className="share-page__cta">{t('share.tryEkko')}</a>
          </div>
        )}
        {wrapped && !error && (
          <>
            <WrappedDisplay
              wrapped={wrapped}
              t={t}
              userId={userId}
              displayName={payload?.display_name || ''}
              showTapHint={false}
            />
            <a href="/" className="share-page__cta">{t('share.tryEkko')}</a>
          </>
        )}
      </main>
    </div>
  )
}
