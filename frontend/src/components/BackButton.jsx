import { useI18n } from '../i18n/I18nContext.jsx'

export default function BackButton({ onClick, label }) {
  const { t, isRtl } = useI18n()
  const text = label ?? t('back.back')
  return (
    <button className="back-button" onClick={onClick}>
      <span className="back-arrow">{isRtl ? '→' : '←'}</span>
      <span className="back-label">{text}</span>
    </button>
  )
}