import { useState, useEffect } from 'react'
import { isRegionUnlocked } from '../utils/planUtils'
import { useI18n } from '../i18n/I18nContext.jsx'

const REGIONS = [
  { id: 'arabic',      emoji: '🌙', label: 'Arabic',      desc: 'Maqam scales, oud, qanun',        color: '#c4954f', glow: 'rgba(196,149,79,0.35)'  },
  { id: 'west_africa', emoji: '🥁', label: 'West Africa', desc: 'Polyrhythm, kora, balafon',        color: '#c47b4f', glow: 'rgba(196,123,79,0.35)'  },
  { id: 'india',       emoji: '🪔', label: 'India',       desc: 'Ragas, sitar, tabla',              color: '#c4a04f', glow: 'rgba(196,160,79,0.35)'  },
  { id: 'east_asia',   emoji: '🏮', label: 'East Asia',   desc: 'Pentatonic, erhu, guzheng',        color: '#4f8fc4', glow: 'rgba(79,143,196,0.35)'  },
  { id: 'latin',       emoji: '🎺', label: 'Latin',       desc: 'Clave rhythms, brass, guitar',     color: '#c44f6b', glow: 'rgba(196,79,107,0.35)'  },
  { id: 'europe',      emoji: '🎻', label: 'Europe',      desc: 'Classical, strings, piano',        color: '#7b6faf', glow: 'rgba(123,111,175,0.35)' },
  { id: 'global',      emoji: '🌍', label: 'Global Mix',  desc: 'Blend of world music traditions',  color: '#4fa882', glow: 'rgba(79,168,130,0.35)'  },
]

// Floating music notes for visual atmosphere
const NOTES = ['♪', '♫', '♩', '♬', '𝄞', '♭', '♮']

export default function Onboarding({ onComplete, userPlan = 'free', onUpgrade }) {
  const { t, isRtl } = useI18n()
  const [mounted, setMounted]       = useState(false)
  const [hovered, setHovered]       = useState(null)
  const [selected, setSelected]     = useState(null)
  const [particles]                 = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id:       i,
      note:     NOTES[i % NOTES.length],
      left:     `${Math.random() * 100}%`,
      top:      `${Math.random() * 100}%`,
      delay:    `${(Math.random() * 6).toFixed(2)}s`,
      duration: `${(8 + Math.random() * 8).toFixed(2)}s`,
      size:     `${10 + Math.random() * 14}px`,
      opacity:  (0.06 + Math.random() * 0.12).toFixed(2),
    }))
  )

  useEffect(() => {
    // Stagger mount animation
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const handleSelect = (region) => {
    if (!isRegionUnlocked(region.id, userPlan)) {
      onUpgrade?.()
      return
    }
    setSelected(region.id)
    setTimeout(() => onComplete(region), 320)
  }

  return (
    <div className="ob-root" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── Floating ambient notes ── */}
      <div className="ob-particles" aria-hidden="true">
        {particles.map(p => (
          <span
            key={p.id}
            className="ob-note"
            style={{
              left:             p.left,
              top:              p.top,
              fontSize:         p.size,
              opacity:          p.opacity,
              animationDelay:   p.delay,
              animationDuration: p.duration,
            }}
          >
            {p.note}
          </span>
        ))}
      </div>

      {/* ── Header ── */}
      <div
        className="ob-header"
        style={{
          opacity:   mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-18px)',
          transition: 'opacity .55s ease, transform .55s ease',
        }}
      >
        <h1 className="ob-headline">
          {t('onboarding.headline')}
        </h1>
        <p className="ob-sub">
          <span className="ob-sub-accent">{t('onboarding.sub')}</span>
        </p>
      </div>

      {/* ── Region grid ── */}
      <div className="ob-regions">
        {REGIONS.map((r, i) => {
          const isHov = hovered === r.id
          const isSel = selected === r.id
          const locked = !isRegionUnlocked(r.id, userPlan)
          return (
            <button
              key={r.id}
              className={`ob-region ${isSel ? 'ob-region--selected' : ''} ${locked ? 'ob-region--locked' : ''}`}
              style={{
                '--rc':       r.color,
                '--rg':       r.glow,
                opacity:      mounted ? (locked ? 0.48 : 1) : 0,
                transform:    mounted
                  ? (isSel ? 'scale(0.97)' : !locked && isHov ? 'translateX(5px)' : 'translateX(0)')
                  : 'translateX(-22px)',
                transition: isSel
                  ? 'transform .18s ease, opacity .1s'
                  : `opacity .45s ease ${(i * 0.055).toFixed(2)}s, transform .3s ease`,
              }}
              onMouseEnter={() => setHovered(r.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => handleSelect(r)}
            >
              {/* Glow layer */}
              <span
                className="ob-region-glow"
                style={{ opacity: !locked && (isHov || isSel) ? 1 : 0 }}
              />

              {/* Emoji */}
              <span
                className="ob-emoji"
                style={{
                  transform: isHov ? 'scale(1.18) rotate(-4deg)' : 'scale(1) rotate(0deg)',
                  transition: 'transform .25s cubic-bezier(.34,1.56,.64,1)',
                }}
              >
                {r.emoji}
              </span>

              {/* Info */}
              <div className="ob-info">
                <span className="ob-region-label">
                  {t(`onboarding.regions.${r.id}`)}{locked ? ' 🔒' : ''}
                </span>
                <span className="ob-region-desc">
                  {locked ? t('onboarding.upgradeUnlock') : t(`onboarding.regionDesc.${r.id}`)}
                </span>
              </div>

              {/* Arrow */}
              <span
                className="ob-arrow"
                style={{
                  transform:  isHov ? 'translateX(4px)' : 'translateX(0)',
                  opacity:    isHov ? 1 : 0.35,
                  color:      r.color,
                  transition: 'transform .22s ease, opacity .22s ease',
                }}
              >
                {isRtl ? '←' : '→'}
              </span>

              {/* Active bar */}
              <span
                className="ob-region-bar"
                style={{ background: r.color, transform: isHov || isSel ? 'scaleY(1)' : 'scaleY(0)' }}
              />
            </button>
          )
        })}
      </div>

      {/* ── Skip ── */}
      <p
        className="ob-skip"
        style={{
          opacity:   mounted ? 1 : 0,
          transition: 'opacity .6s ease .5s',
        }}
        onClick={() => handleSelect(REGIONS.find(r => r.id === 'global'))}
      >
        {t('onboarding.skip')}
      </p>

      <style>{`
        .ob-root {
          position: relative;
          width: 100%;
          max-width: 340px;
          margin: 0 auto;
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          overflow: hidden;
        }

        /* ── Particles ── */
        .ob-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }
        .ob-note {
          position: absolute;
          color: #a78bfa;
          animation: obNoteFloat linear infinite;
          user-select: none;
        }
        @keyframes obNoteFloat {
          0%   { transform: translateY(0px) rotate(0deg);   opacity: var(--op, 0.08); }
          40%  { transform: translateY(-28px) rotate(12deg); opacity: calc(var(--op, 0.08) * 1.6); }
          100% { transform: translateY(0px) rotate(-6deg);   opacity: var(--op, 0.08); }
        }

        /* ── Header ── */
        .ob-header {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 0 8px 20px;
        }
        .ob-logo-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
          background: rgba(124, 92, 231, 0.12);
          border: 1px solid rgba(124, 92, 231, 0.25);
          border-radius: 99px;
          padding: 4px 14px 4px 10px;
        }
        .ob-logo-icon { font-size: 20px; }
        .ob-logo-text {
          font-size: 18px;
          font-weight: 800;
          color: #a78bfa;
          letter-spacing: .06em;
        }
        .ob-headline {
          font-size: 1.65rem;
          font-weight: 800;
          color: #e0d8ff;
          margin: 0 0 8px;
          line-height: 1.2;
          letter-spacing: -.02em;
        }
        .ob-headline em {
          font-style: italic;
          background: linear-gradient(120deg, #a78bfa, #67e8f9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ob-sub {
          font-size: 18px;
          color: #8b7eb8;
          margin: 0;
          line-height: 1.55;
        }
        .ob-sub-accent {
          color: #a395c8;
        }

        /* ── Regions ── */
        .ob-regions {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .ob-region {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          overflow: hidden;
          transition: border-color .22s ease, background .22s ease;
          width: 100%;
        }
        .ob-region::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, var(--rg, rgba(124,92,231,0.25)) 0%, transparent 55%);
          transform: translateX(-102%);
          transition: transform .35s ease;
          pointer-events: none;
          border-radius: inherit;
        }
        .ob-region:hover::before {
          transform: translateX(0);
        }
        .ob-region:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(var(--rc), 0.4);
        }
        .ob-region--locked {
          cursor: pointer;
          filter: saturate(0.55) brightness(0.72);
          background: rgba(255, 255, 255, 0.015);
          border-color: rgba(255, 255, 255, 0.04);
        }
        .ob-region--locked:hover {
          filter: saturate(0.65) brightness(0.78);
          border-color: rgba(245, 158, 11, 0.35);
          background: rgba(255, 255, 255, 0.025);
        }
        .ob-region--locked:hover::before {
          transform: translateX(-102%);
        }
        .ob-region--locked .ob-region-label {
          color: rgba(224, 216, 255, 0.55);
        }
        .ob-region--locked .ob-region-desc {
          color: rgba(107, 95, 138, 0.7);
        }
        .ob-region--locked .ob-emoji {
          filter: grayscale(0.35);
        }
        .ob-region--selected {
          border-color: var(--rc) !important;
          background: rgba(255, 255, 255, 0.07) !important;
        }

        /* Glow bg layer */
        .ob-region-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at left center, var(--rg, rgba(124,92,231,0.2)) 0%, transparent 65%);
          pointer-events: none;
          transition: opacity .25s ease;
          border-radius: inherit;
        }

        /* Left active bar */
        .ob-region-bar {
          position: absolute;
          left: 0; top: 12%; bottom: 12%;
          width: 3px;
          border-radius: 0 3px 3px 0;
          transform-origin: center;
          transition: transform .22s cubic-bezier(.34,1.56,.64,1);
        }

        .ob-emoji {
          font-size: 27px;
          flex-shrink: 0;
          display: block;
          line-height: 1;
          position: relative;
          z-index: 1;
        }
        .ob-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          position: relative;
          z-index: 1;
        }
        .ob-region-label {
          font-size: 19px;
          font-weight: 700;
          color: #e0d8ff;
          line-height: 1.2;
        }
        .ob-region-desc {
          font-size: 16px;
          color: #6b5f8a;
          line-height: 1.3;
        }
        .ob-arrow {
          font-size: 21px;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
          font-weight: 700;
        }

        /* ── Skip ── */
        .ob-skip {
          position: relative;
          z-index: 1;
          text-align: center;
          font-size: 17px;
          color: #4b4570;
          margin: 14px 0 0;
          cursor: pointer;
          transition: color .2s;
          padding: 4px;
        }
        .ob-skip:hover { color: #7c5ce7; }
      `}</style>
    </div>
  )
}