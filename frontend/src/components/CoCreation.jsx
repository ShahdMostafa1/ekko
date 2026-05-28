import { useState, useEffect } from 'react'

const INSTRUMENTS = [
  { id: 'piano',   emoji: '🎹', label: 'Piano'   },
  { id: 'strings', emoji: '🎻', label: 'Strings' },
  { id: 'guitar',  emoji: '🎸', label: 'Guitar'  },
  { id: 'flute',   emoji: '🪈', label: 'Flute'   },
  { id: 'synth',   emoji: '🎛️', label: 'Synth'   },
  { id: 'drums',   emoji: '🥁', label: 'Drums'   },
  { id: 'bass',    emoji: '🎵', label: 'Bass'    },
  { id: 'oud',     emoji: '🪕', label: 'Oud'     },
]

const SCALES = [
  { id: 'C major', label: 'C Major', feel: 'Bright & clear'  },
  { id: 'D minor', label: 'D Minor', feel: 'Melancholic'     },
  { id: 'G major', label: 'G Major', feel: 'Warm & open'     },
  { id: 'A minor', label: 'A Minor', feel: 'Emotional'       },
  { id: 'F major', label: 'F Major', feel: 'Gentle & soft'   },
  { id: 'B minor', label: 'B Minor', feel: 'Dark & deep'     },
]

const ARABIC_CODES   = new Set(['ar', 'ar-eg', 'ar-lv', 'ar-gulf', 'ar-ma'])
const HINDI_CODES    = new Set(['hi', 'ta', 'te', 'bn'])
const EASTASIA_CODES = new Set(['zh', 'ja', 'ko'])
const LATIN_CODES    = new Set(['es', 'pt'])
const EUROPE_CODES   = new Set(['fr', 'de', 'it', 'en'])
const AFRICA_CODES   = new Set(['yo', 'ha', 'pcm', 'wo'])

function bestRegionForLanguage(langCode, currentRegion) {
  if (!langCode) return currentRegion || 'global'
  if (ARABIC_CODES.has(langCode))   return 'arabic'
  if (HINDI_CODES.has(langCode))    return 'india'
  if (EASTASIA_CODES.has(langCode)) return 'east_asia'
  if (LATIN_CODES.has(langCode))    return 'latin'
  if (AFRICA_CODES.has(langCode))   return 'west_africa'
  if (EUROPE_CODES.has(langCode) && langCode !== 'en') return 'europe'
  return 'global'
}

// ── Plan gate helpers ─────────────────────────────────────────────────────────
const PAID_PLANS = new Set(['groove', 'studio'])
const isPaid = (plan) => PAID_PLANS.has(plan)

export default function CoCreation({ mood, regionDefaults, region, language, onGenerate, userPlan = 'free', onUpgrade }) {
  const [tempo, setTempo]               = useState(mood?.energy > 0.5 ? 110 : 72)
  const [selectedScale, setScale]       = useState(mood?.valence > 0.5 ? 'C major' : 'D minor')
  const [selectedInstr, setInstr]       = useState(regionDefaults?.instruments?.slice(0, 2) || ['piano', 'strings'])
  const [artistStyles, setArtistStyles] = useState([])
  const [selectedArtist, setArtist]     = useState('')
  const [loadingStyles, setLoadingStyles] = useState(false)
  const [showUpgradeNudge, setShowUpgradeNudge] = useState(false)

  const canUseArtistStyles = isPaid(userPlan)
  const artistRegion = bestRegionForLanguage(language?.code, region?.id)

  useEffect(() => {
    if (!artistRegion || !canUseArtistStyles) return
    setLoadingStyles(true)
    setArtist('')
    fetch(`${import.meta.env.VITE_API_URL}/music/artist-styles?region=${artistRegion}`)
      .then(r => r.json())
      .then(data => setArtistStyles(data.styles || []))
      .catch(() => setArtistStyles([]))
      .finally(() => setLoadingStyles(false))
  }, [artistRegion, canUseArtistStyles])

  const toggleInstr = (id) => {
    setInstr(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(i => i !== id) : prev
        : prev.length < 3 ? [...prev, id] : prev
    )
  }

  const tempoLabel = (
    tempo < 70  ? 'Very slow' :
    tempo < 90  ? 'Slow'      :
    tempo < 110 ? 'Moderate'  :
    tempo < 130 ? 'Upbeat'    : 'Fast'
  )

  const handleGenerate = () => {
    onGenerate({
      tempo_bpm:       tempo,
      scale:           selectedScale,
      instruments:     selectedInstr,
      artist_style_id: canUseArtistStyles ? selectedArtist : '',
    })
  }

  const selectedArtistObj = canUseArtistStyles
    ? artistStyles.find(a => a.id === selectedArtist)
    : null

  const langLabel = language?.label || ''
  const artistSectionLabel = langLabel
    ? `🎤 Artist Style — matching ${langLabel}`
    : '🎤 Artist Style'

  return (
    <div className="cocreate">
      <div className="cc-header">
        <p className="cc-mood-tag">{mood?.label || 'Your mood'}</p>
        <h2 className="cc-headline">Shape your <em>sound</em></h2>
        <p className="cc-sub">Customise your music before generating</p>
      </div>

      {/* ── Artist Style — GATED to Groove+ ── */}
      <div className="cc-section">
        <div className="cc-section-top">
          <span className="cc-label">{artistSectionLabel}</span>
          <span className="cc-value">
            {canUseArtistStyles
              ? (selectedArtistObj ? selectedArtistObj.label : 'Default style')
              : <span style={{ color: '#f59e0b', fontWeight: 700 }}>🌊 Groove+ only</span>
            }
          </span>
        </div>

        {!canUseArtistStyles ? (
          /* ── Locked state ── */
          <div
            onClick={() => setShowUpgradeNudge(v => !v)}
            style={{
              position:     'relative',
              borderRadius: 14,
              border:       '1.5px dashed rgba(245,158,11,0.35)',
              background:   'rgba(245,158,11,0.04)',
              padding:      '18px 16px',
              cursor:       'pointer',
              textAlign:    'center',
              transition:   'border-color .2s, background .2s',
            }}
          >
            {/* Blurred artist grid preview */}
            <div style={{
              display:        'grid',
              gridTemplateColumns: 'repeat(2,1fr)',
              gap:            8,
              filter:         'blur(4px)',
              opacity:        0.35,
              pointerEvents:  'none',
              marginBottom:   12,
            }}>
              {['Amr Diab','Fairuz','Burna Boy','IU','Shakira','Adele','BTS','Ed Sheeran'].map(name => (
                <div key={name} style={{ padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', fontSize:12, color:'#e0d8ff', fontWeight:600, textAlign:'left' }}>
                  🎤 {name}
                </div>
              ))}
            </div>

            {/* Lock overlay */}
            <div style={{
              position:       'absolute',
              inset:          0,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            8,
              borderRadius:   'inherit',
            }}>
              <div style={{ fontSize: 28 }}>🔒</div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fde68a' }}>
                80+ Artist Styles
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>
                Unlock with Groove or Studio plan
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); onUpgrade?.() }}
                style={{
                  marginTop:    4,
                  padding:      '8px 20px',
                  background:   'linear-gradient(135deg, #f59e0b, #fbbf24)',
                  border:       'none',
                  borderRadius: 10,
                  color:        '#1a0f00',
                  fontSize:     13,
                  fontWeight:   800,
                  cursor:       'pointer',
                  boxShadow:    '0 4px 16px rgba(245,158,11,0.35)',
                  fontFamily:   "'DM Sans',sans-serif",
                }}
              >
                Upgrade to Groove →
              </button>
            </div>
          </div>
        ) : loadingStyles ? (
          <div className="cc-artist-loading">Loading styles…</div>
        ) : (
          <div className="cc-artist-grid">
            <button
              className={`cc-artist-opt ${selectedArtist === '' ? 'sel' : ''}`}
              onClick={() => setArtist('')}
            >
              <span className="cao-emoji">🎵</span>
              <span className="cao-label">Default</span>
              <span className="cao-desc">AI chooses</span>
            </button>
            {artistStyles.map(a => (
              <button
                key={a.id}
                className={`cc-artist-opt ${selectedArtist === a.id ? 'sel' : ''}`}
                onClick={() => setArtist(a.id)}
              >
                <span className="cao-emoji">🎤</span>
                <span className="cao-label">{a.label}</span>
                <span className="cao-desc">{a.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Tempo ── */}
      <div className="cc-section">
        <div className="cc-section-top">
          <span className="cc-label">Tempo</span>
          <span className="cc-value">{tempo} BPM · <em>{tempoLabel}</em></span>
        </div>
        <div className="cc-slider-wrap">
          <input
            type="range" min={40} max={180} value={tempo}
            onChange={e => setTempo(Number(e.target.value))}
            className="cc-slider"
          />
          <div className="cc-slider-ticks">
            {['40', '80', '120', '180'].map(t => <span key={t}>{t}</span>)}
          </div>
        </div>
      </div>

      {/* ── Scale ── */}
      <div className="cc-section">
        <div className="cc-section-top">
          <span className="cc-label">Scale</span>
        </div>
        <div className="cc-scale-grid">
          {SCALES.map(s => (
            <button
              key={s.id}
              className={`cc-scale-opt ${selectedScale === s.id ? 'sel' : ''}`}
              onClick={() => setScale(s.id)}
            >
              <span className="cso-name">{s.label}</span>
              <span className="cso-feel">{s.feel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Instruments ── */}
      <div className="cc-section">
        <div className="cc-section-top">
          <span className="cc-label">Instruments</span>
          <span className="cc-value">{selectedInstr.length}/3 selected</span>
        </div>
        <div className="cc-instr-grid">
          {INSTRUMENTS.map(ins => (
            <button
              key={ins.id}
              className={`cc-instr ${selectedInstr.includes(ins.id) ? 'sel' : ''}`}
              onClick={() => toggleInstr(ins.id)}
            >
              <span className="ci-emoji">{ins.emoji}</span>
              <span className="ci-label">{ins.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="cc-cta" onClick={handleGenerate}>
        {selectedArtistObj
          ? `Generate in ${selectedArtistObj.label} style →`
          : 'Generate my music →'
        }
      </button>
      <p className="cc-xp">+20 XP when your song is saved</p>

      <style>{`
        .cc-artist-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-top: 4px;
        }
        .cc-artist-opt {
          display: flex; flex-direction: column; align-items: flex-start;
          gap: 2px; padding: 10px 12px;
          border: 1.5px solid rgba(176,158,224,.2);
          border-radius: 12px; background: rgba(255,255,255,.03);
          cursor: pointer; text-align: left;
          transition: all .18s;
        }
        .cc-artist-opt:hover { border-color: #7c5ce7; background: rgba(124,92,231,.08); }
        .cc-artist-opt.sel  { border-color: #7c5ce7; background: rgba(124,92,231,.15); box-shadow: 0 0 0 1px #7c5ce7; }
        .cao-emoji { font-size: 18px; line-height: 1; }
        .cao-label { font-size: 12px; font-weight: 700; color: #e0d8ff; line-height: 1.2; }
        .cao-desc  { font-size: 10px; color: #8b7eb8; line-height: 1.3; margin-top: 1px; }
        .cc-artist-loading { font-size: 13px; color: #8b7eb8; padding: 12px 0; text-align: center; }
      `}</style>
    </div>
  )
}