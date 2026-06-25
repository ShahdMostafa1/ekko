/**
 * LanguagePicker — shown after region selection, before mood input.
 * Lets the user choose which language they want the song lyrics in.
 */
import { useState, useMemo } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { filterByInstantSearch } from '../utils/searchFilter'

const REGION_LANGUAGES = {
  arabic: [
    { code: 'ar-eg', label: 'Egyptian Arabic',  native: 'عربي مصري',    emoji: '🇪🇬' },
    { code: 'ar-lv', label: 'Levantine Arabic', native: 'عربي شامي',    emoji: '🇱🇧' },
    { code: 'ar-gulf',label: 'Gulf Arabic',     native: 'عربي خليجي',   emoji: '🇸🇦' },
    { code: 'ar-ma', label: 'Moroccan Darija',  native: 'دارجة مغربية', emoji: '🇲🇦' },
    { code: 'en',    label: 'English',           native: 'English',       emoji: '🇬🇧' },
  ],
  west_africa: [
    { code: 'en',      label: 'English',          native: 'English',        emoji: '🇬🇧' },
    { code: 'pcm',     label: 'Nigerian Pidgin',  native: 'Naija Pidgin',   emoji: '🇳🇬' },
    { code: 'fr',      label: 'French',           native: 'Français',       emoji: '🇫🇷' },
    { code: 'yo',      label: 'Yoruba',           native: 'Yorùbá',         emoji: '🌍' },
    { code: 'ha',      label: 'Hausa',            native: 'Hausa',          emoji: '🌍' },
    { code: 'wo',      label: 'Wolof',            native: 'Wolof',          emoji: '🇸🇳' },
  ],
  india: [
    { code: 'hi',  label: 'Hindi',       native: 'हिन्दी',      emoji: '🇮🇳' },
    { code: 'ta',  label: 'Tamil',       native: 'தமிழ்',       emoji: '🌏' },
    { code: 'te',  label: 'Telugu',      native: 'తెలుగు',      emoji: '🌏' },
    { code: 'bn',  label: 'Bengali',     native: 'বাংলা',       emoji: '🇧🇩' },
    { code: 'en',  label: 'English',     native: 'English',     emoji: '🇬🇧' },
  ],
  east_asia: [
    { code: 'zh',  label: 'Mandarin',   native: '普通话',        emoji: '🇨🇳' },
    { code: 'ja',  label: 'Japanese',   native: '日本語',        emoji: '🇯🇵' },
    { code: 'ko',  label: 'Korean',     native: '한국어',        emoji: '🇰🇷' },
    { code: 'en',  label: 'English',    native: 'English',      emoji: '🇬🇧' },
  ],
  latin: [
    { code: 'es',  label: 'Spanish',    native: 'Español',      emoji: '🇪🇸' },
    { code: 'pt',  label: 'Portuguese', native: 'Português',    emoji: '🇧🇷' },
    { code: 'en',  label: 'English',    native: 'English',      emoji: '🇬🇧' },
  ],
  europe: [
    { code: 'en',  label: 'English',    native: 'English',      emoji: '🇬🇧' },
    { code: 'fr',  label: 'French',     native: 'Français',     emoji: '🇫🇷' },
    { code: 'de',  label: 'German',     native: 'Deutsch',      emoji: '🇩🇪' },
    { code: 'es',  label: 'Spanish',    native: 'Español',      emoji: '🇪🇸' },
    { code: 'it',  label: 'Italian',    native: 'Italiano',     emoji: '🇮🇹' },
  ],
  global: [
    { code: 'en',  label: 'English',    native: 'English',      emoji: '🌍' },
    { code: 'es',  label: 'Spanish',    native: 'Español',      emoji: '🇪🇸' },
    { code: 'fr',  label: 'French',     native: 'Français',     emoji: '🇫🇷' },
    { code: 'ar-eg',label: 'Arabic',    native: 'العربية',      emoji: '🌙' },
    { code: 'hi',  label: 'Hindi',      native: 'हिन्दी',       emoji: '🇮🇳' },
  ],
}

const REGION_COLOR = {
  arabic:      '#c9a84c',
  west_africa: '#e07b39',
  india:       '#d4518a',
  east_asia:   '#7eb8c9',
  latin:       '#e04f4f',
  europe:      '#6e8efb',
  global:      '#7c5ce7',
}

export default function LanguagePicker({ region, onComplete }) {
  const { t, isRtl } = useI18n()
  const [search, setSearch] = useState('')
  const regionId  = region?.id || 'global'
  const regionLabel = t(`onboarding.regions.${regionId}`)
  const langs     = REGION_LANGUAGES[regionId] || REGION_LANGUAGES.global
  const accentColor = REGION_COLOR[regionId] || '#7c5ce7'
  const filteredLangs = useMemo(
    () => filterByInstantSearch(langs, search, l => [l.label, l.native, l.code]),
    [langs, search],
  )

  return (
    <div className="lp-root" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="lp-header">
        <p className="lp-eyebrow">
          {region?.emoji} {regionLabel}
        </p>
        <h2 className="lp-headline">
          {t('langPicker.title')}
        </h2>
        <p className="lp-sub">
          {t('langPicker.sub')}
        </p>
      </div>

      {langs.length > 4 && (
        <input
          type="search"
          className="lp-search"
          placeholder="Type to filter languages…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Filter languages"
        />
      )}

      <div className="lp-list">
        {filteredLangs.length === 0 ? (
          <p className="lp-empty">No languages match “{search}”</p>
        ) : filteredLangs.map((lang, i) => (
          <button
            key={lang.code}
            className="lp-item"
            style={{ '--ac': accentColor, animationDelay: `${i * 0.06}s` }}
            onClick={() => onComplete(lang)}
          >
            <span className="lp-flag">{lang.emoji}</span>
            <div className="lp-info">
              <span className="lp-label">{lang.label}</span>
              <span className="lp-native">{lang.native}</span>
            </div>
            <span className="lp-arrow">{isRtl ? '←' : '→'}</span>
          </button>
        ))}
      </div>

      <style>{`
        .lp-root {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 400px;
          margin: 0 auto;
          padding-bottom: 40px;
        }

        .lp-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .lp-eyebrow {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--ac, #7c5ce7);
          margin: 0 0 10px;
          opacity: .85;
        }

        .lp-headline {
          font-size: 33px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 10px;
          line-height: 1.25;
        }

        .lp-headline em {
          font-style: italic;
          color: #b09ee0;
        }

        .lp-sub {
          font-size: 18px;
          color: #8b7eb8;
          margin: 0;
        }

        .lp-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .lp-search {
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 14px;
          padding: 11px 14px;
          background: rgba(255,255,255,.06);
          border: 1.5px solid rgba(176,158,224,.15);
          border-radius: 12px;
          color: #e0d8ff;
          font-size: 18px;
          font-family: inherit;
          outline: none;
          transition: border-color .18s;
        }

        .lp-search:focus {
          border-color: color-mix(in srgb, var(--ac, #7c5ce7) 55%, transparent);
        }

        .lp-empty {
          text-align: center;
          color: #8b7eb8;
          font-size: 17px;
          padding: 20px 0;
          margin: 0;
        }

        .lp-item {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          padding: 16px 18px;
          background: rgba(255,255,255,.04);
          border: 1.5px solid rgba(176,158,224,.1);
          border-radius: 16px;
          cursor: pointer;
          transition: border-color .18s, background .18s, transform .18s;
          text-align: left;
          animation: lpSlideIn .35s ease both;
        }

        @keyframes lpSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .lp-item:hover {
          border-color: var(--ac);
          background: color-mix(in srgb, var(--ac) 10%, transparent);
          transform: translateX(3px);
        }

        .lp-flag {
          font-size: 31px;
          line-height: 1;
          flex-shrink: 0;
        }

        .lp-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .lp-label {
          font-size: 20px;
          font-weight: 700;
          color: #e0d8ff;
          line-height: 1;
        }

        .lp-native {
          font-size: 17px;
          color: #8b7eb8;
          font-weight: 500;
        }

        .lp-arrow {
          font-size: 19px;
          color: var(--ac);
          opacity: .6;
          transition: opacity .18s, transform .18s;
          flex-shrink: 0;
        }

        .lp-item:hover .lp-arrow {
          opacity: 1;
          transform: translateX(3px);
        }
      `}</style>
    </div>
  )
}