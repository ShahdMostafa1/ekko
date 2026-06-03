import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from './en'
import ar from './ar'

const STORAGE_KEY = 'ekko_locale'
const locales = { en, ar }

const I18nContext = createContext(null)

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj)
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'ar' ? 'ar' : 'en'
  })

  const setLocale = useCallback((next) => {
    const l = next === 'ar' ? 'ar' : 'en'
    setLocaleState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }, [])

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar')
  }, [locale, setLocale])

  useEffect(() => {
    const root = document.documentElement
    root.lang = locale
    root.dir = locale === 'ar' ? 'rtl' : 'ltr'
    document.body.classList.toggle('ekko-rtl', locale === 'ar')
  }, [locale])

  const t = useCallback((key, vars) => {
    let s = get(locales[locale], key) ?? get(locales.en, key) ?? key
    if (vars && typeof s === 'string') {
      Object.entries(vars).forEach(([k, v]) => {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
    }
    return s
  }, [locale])

  const value = useMemo(() => ({
    locale,
    setLocale,
    toggleLocale,
    t,
    isRtl: locale === 'ar',
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    tagline: t('tagline'),
    hook: t('hook'),
    hookShort: t('hookShort'),
  }), [locale, setLocale, toggleLocale, t])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
