import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import { filterByInstantSearch } from '../utils/searchFilter'
import {
  isArtistUnlockedFromApi,
  isPaidPlan,
  FREE_ARTISTS_PER_REGION,
  ARTIST_XP_UNLOCK_COST,
  XP_ELIGIBLE_ARTISTS_PER_REGION,
} from '../utils/planUtils'

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

// Which language codes are "Arabic-family" — match Arabic region artists
const ARABIC_CODES   = new Set(['ar', 'ar-eg', 'ar-lv', 'ar-gulf', 'ar-ma'])
const HINDI_CODES    = new Set(['hi', 'ta', 'te', 'bn'])
const EASTASIA_CODES = new Set(['zh', 'ja', 'ko'])
const LATIN_CODES    = new Set(['es', 'pt'])
const EUROPE_CODES   = new Set(['fr', 'de', 'it', 'en'])
const AFRICA_CODES   = new Set(['yo', 'ha', 'pcm', 'wo'])

// Given the selected language code, return which region's artist list fits best.
// Falls back to 'global' for English or anything unrecognised.
function bestRegionForLanguage(langCode, currentRegion) {
  if (!langCode) return currentRegion || 'global'
  if (ARABIC_CODES.has(langCode))   return 'arabic'
  if (HINDI_CODES.has(langCode))    return 'india'
  if (EASTASIA_CODES.has(langCode)) return 'east_asia'
  if (LATIN_CODES.has(langCode))    return 'latin'
  if (AFRICA_CODES.has(langCode))   return 'west_africa'
  // English or European — use 'global' artists which are all English-friendly,
  // unless the current region is europe (keep europe artists for European langs)
  if (EUROPE_CODES.has(langCode) && langCode !== 'en') return 'europe'
  return 'global'
}

export default function CoCreation({
  mood,
  regionDefaults,
  region,
  language,
  userPlan = 'free',
  userId = '',
  userXp = 0,
  onXpUpdate,
  onArtistUnlocked,
  onUpgrade,
  onGenerate,
}) {
  const { t } = useI18n()
  const [tempo, setTempo]               = useState(mood?.energy > 0.5 ? 110 : 72)
  const [selectedScale, setScale]       = useState(mood?.valence > 0.5 ? 'C major' : 'D minor')
  const [selectedInstr, setInstr]       = useState(regionDefaults?.instruments?.slice(0, 2) || ['piano', 'strings'])
  const [artistStyles, setArtistStyles] = useState([])
  const [selectedArtist, setArtist]     = useState('')
  const [loadingStyles, setLoadingStyles] = useState(false)
  const [unlockMeta, setUnlockMeta]     = useState({
    xp_unlock_cost: ARTIST_XP_UNLOCK_COST,
    xp_eligible_per_region: XP_ELIGIBLE_ARTISTS_PER_REGION,
    user_xp: userXp,
  })
  const [unlockModal, setUnlockModal]   = useState(null)
  const [unlockBusy, setUnlockBusy]       = useState(false)
  const [unlockError, setUnlockError]     = useState('')
  const [artistSearch, setArtistSearch]   = useState('')

  // Derive which region's artists to show based on the chosen language,
  // not just the cultural region the user picked.
  const artistRegion = bestRegionForLanguage(language?.code, region?.id)

  const loadArtistStyles = useCallback(() => {
    if (!artistRegion) return
    setLoadingStyles(true)
    const q = new URLSearchParams({
      region: artistRegion,
      plan: userPlan || 'free',
    })
    if (userId) q.set('user_id', userId)
    fetch(`${import.meta.env.VITE_API_URL}/music/artist-styles?${q}`)
      .then(r => r.json())
      .then(data => {
        setArtistStyles(data.styles || [])
        setUnlockMeta({
          xp_unlock_cost: data.xp_unlock_cost ?? ARTIST_XP_UNLOCK_COST,
          xp_eligible_per_region: data.xp_eligible_per_region ?? XP_ELIGIBLE_ARTISTS_PER_REGION,
          user_xp: data.user_xp ?? userXp,
        })
      })
      .catch(() => setArtistStyles([]))
      .finally(() => setLoadingStyles(false))
  }, [artistRegion, userPlan, userId, userXp])

  useEffect(() => {
    setArtist('')
    setArtistSearch('')
    loadArtistStyles()
  }, [loadArtistStyles])

  useEffect(() => {
    if (!selectedArtist) return
    const a = artistStyles.find(x => x.id === selectedArtist)
    const idx = artistStyles.findIndex(x => x.id === selectedArtist)
    if (a && !isArtistUnlockedFromApi(a, idx, userPlan)) setArtist('')
  }, [artistStyles, userPlan, selectedArtist])

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
  const tempoFillPct = `${((tempo - 40) / (180 - 40)) * 100}%`

  const paidPlan = isPaidPlan(userPlan)

  const handleGenerate = () => {
    const a = artistStyles.find(x => x.id === selectedArtist)
    const idx = artistStyles.findIndex(x => x.id === selectedArtist)
    const artistOk = !selectedArtist || isArtistUnlockedFromApi(a, idx, userPlan)
    onGenerate({
      tempo_bpm:       tempo,
      scale:           selectedScale,
      instruments:     selectedInstr,
      artist_style_id: artistOk ? selectedArtist : '',
    })
  }

  const handleArtistClick = (a, idx) => {
    if (isArtistUnlockedFromApi(a, idx, userPlan)) {
      setArtist(a.id)
      return
    }
    if (isPaidPlan(userPlan)) {
      onUpgrade?.()
      return
    }
    if (a.unlockable_with_xp) {
      const cost = unlockMeta.xp_unlock_cost || ARTIST_XP_UNLOCK_COST
      const xp = unlockMeta.user_xp ?? userXp
      if (xp < cost) {
        setUnlockModal({ type: 'earn', artist: a, cost, xp })
        return
      }
      setUnlockModal({ type: 'confirm', artist: a, cost, xp })
      return
    }
    setUnlockModal({ type: 'plan', artist: a })
  }

  const confirmUnlock = async () => {
    if (!unlockModal?.artist || !userId) return
    setUnlockBusy(true)
    setUnlockError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/rewards/unlock-artist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          artist_style_id: unlockModal.artist.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.detail?.message || data?.detail || data?.message || 'Unlock failed'
        if (data?.detail?.error === 'insufficient_xp') {
          setUnlockModal({
            type: 'earn',
            artist: unlockModal.artist,
            cost: data.detail.required || ARTIST_XP_UNLOCK_COST,
            xp: data.detail.current ?? userXp,
          })
          return
        }
        if (data?.detail?.error === 'plan_required') {
          setUnlockModal({ type: 'plan', artist: unlockModal.artist })
          return
        }
        setUnlockError(typeof msg === 'string' ? msg : 'Could not unlock artist')
        return
      }
      onXpUpdate?.(data.total_xp)
      onArtistUnlocked?.({
        totalXp: data.total_xp,
        label: data.artist_label || unlockModal.artist.label,
        spent: data.xp_spent,
      })
      setUnlockMeta(prev => ({ ...prev, user_xp: data.total_xp }))
      setUnlockModal(null)
      setArtist(data.artist_style_id)
      loadArtistStyles()
    } catch {
      setUnlockError('Could not unlock artist. Try again.')
    } finally {
      setUnlockBusy(false)
    }
  }

  const selectedArtistObj = artistStyles.find(a => a.id === selectedArtist)

  const visibleArtists = useMemo(
    () => filterByInstantSearch(artistStyles, artistSearch, a => [a.label, a.description, a.id, a.region]),
    [artistStyles, artistSearch],
  )

  // Label shown above the artist grid to explain the filtering
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

      {/* ── Artist Style (filtered by language) ── */}
      <div className="cc-section">
        <div className="cc-section-top">
          <span className="cc-label">{artistSectionLabel}</span>
          <span className="cc-value">
            {selectedArtistObj ? selectedArtistObj.label : 'Default style'}
          </span>
        </div>
        {!paidPlan && (
          <p className="cc-lock-note">
            {t('cocreate.artistUnlockNote', {
              count: unlockMeta.xp_eligible_per_region ?? XP_ELIGIBLE_ARTISTS_PER_REGION,
              cost: unlockMeta.xp_unlock_cost ?? ARTIST_XP_UNLOCK_COST,
            })}{' '}
            <button type="button" className="cc-upgrade-link" onClick={() => onUpgrade?.()}>
              Groove
            </button>
          </p>
        )}
        {loadingStyles ? (
          <div className="cc-artist-loading">Loading styles…</div>
        ) : (
          <>
            {artistStyles.length > 4 && (
              <input
                type="search"
                className="cc-artist-search"
                placeholder="Type to filter artists…"
                value={artistSearch}
                onChange={e => setArtistSearch(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label="Filter artist styles"
              />
            )}
          <div className="cc-artist-grid">
            <button
              className={`cc-artist-opt ${selectedArtist === '' ? 'sel' : ''}`}
              onClick={() => setArtist('')}
            >
              <span className="cao-emoji">🎵</span>
              <span className="cao-label">Default</span>
              <span className="cao-desc">AI chooses</span>
            </button>
            {visibleArtists.length === 0 && artistSearch ? (
              <p className="cc-artist-empty">No artists match “{artistSearch}”</p>
            ) : visibleArtists.map((a, idx) => {
              const globalIdx = artistStyles.findIndex(x => x.id === a.id)
              const unlocked = isArtistUnlockedFromApi(a, globalIdx, userPlan)
              const showXp = !unlocked && a.unlockable_with_xp
              return (
              <button
                key={a.id}
                type="button"
                className={`cc-artist-opt ${selectedArtist === a.id ? 'sel' : ''} ${unlocked ? '' : 'locked'}`}
                onClick={() => handleArtistClick(a, globalIdx)}
              >
                <span className="cao-emoji">{unlocked ? '🎤' : showXp ? '✨' : '🔒'}</span>
                <span className="cao-label">{a.label}</span>
                <span className="cao-desc">
                  {showXp
                    ? t('cocreate.artistXpBadge', { cost: a.xp_unlock_cost || ARTIST_XP_UNLOCK_COST })
                    : a.description}
                </span>
              </button>
            )})}
          </div>
          </>
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
            style={{ '--val': tempoFillPct }}
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

      {unlockModal && (
        <div className="cc-unlock-backdrop" role="dialog" aria-modal="true">
          <div className="cc-unlock-card">
            {unlockModal.type === 'confirm' && (
              <>
                <h3 className="cc-unlock-title">
                  {t('cocreate.unlockTitle', { name: unlockModal.artist.label })}
                </h3>
                <p className="cc-unlock-body">
                  {t('cocreate.unlockBody', {
                    cost: unlockModal.cost,
                    xp: unlockModal.xp,
                  })}
                </p>
                {unlockError && <p className="cc-unlock-err">{unlockError}</p>}
                <div className="cc-unlock-actions">
                  <button type="button" className="cc-unlock-secondary" onClick={() => setUnlockModal(null)} disabled={unlockBusy}>
                    {t('cocreate.unlockCancel')}
                  </button>
                  <button type="button" className="cc-unlock-primary" onClick={confirmUnlock} disabled={unlockBusy}>
                    {unlockBusy ? t('cocreate.unlocking') : t('cocreate.unlockConfirm', { cost: unlockModal.cost })}
                  </button>
                </div>
              </>
            )}
            {unlockModal.type === 'earn' && (
              <>
                <h3 className="cc-unlock-title">{t('cocreate.earnXpTitle')}</h3>
                <p className="cc-unlock-body">
                  {t('cocreate.earnXpBody', { cost: unlockModal.cost })}
                </p>
                <button type="button" className="cc-unlock-primary" onClick={() => setUnlockModal(null)}>
                  {t('cocreate.earnXpCta')}
                </button>
              </>
            )}
            {unlockModal.type === 'plan' && (
              <>
                <h3 className="cc-unlock-title">{t('cocreate.planOnlyTitle')}</h3>
                <p className="cc-unlock-body">
                  {t('cocreate.planOnlyBody', {
                    count: unlockMeta.xp_eligible_per_region ?? XP_ELIGIBLE_ARTISTS_PER_REGION,
                  })}
                </p>
                <div className="cc-unlock-actions">
                  <button type="button" className="cc-unlock-secondary" onClick={() => setUnlockModal(null)}>
                    {t('cocreate.unlockCancel')}
                  </button>
                  <button type="button" className="cc-unlock-primary" onClick={() => { setUnlockModal(null); onUpgrade?.() }}>
                    {t('cocreate.planOnlyCta')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
        .cc-artist-opt:hover {
          border-color: #7c5ce7;
          background: rgba(124,92,231,.08);
        }
        .cc-artist-opt.sel {
          border-color: #7c5ce7;
          background: rgba(124,92,231,.15);
          box-shadow: 0 0 0 1px #7c5ce7;
        }
        .cao-emoji { font-size: 23px; line-height: 1; }
        .cao-label {
          font-size: 17px; font-weight: 700;
          color: #e0d8ff; line-height: 1.2;
        }
        .cao-desc {
          font-size: 15px; color: #8b7eb8;
          line-height: 1.3; margin-top: 1px;
        }
        .cc-artist-loading {
          font-size: 18px; color: #8b7eb8;
          padding: 12px 0; text-align: center;
        }
        .cc-artist-search {
          width: 100%; box-sizing: border-box;
          margin-bottom: 10px;
          padding: 10px 14px;
          background: rgba(255,255,255,.06);
          border: 1.5px solid rgba(176,158,224,.15);
          border-radius: 12px;
          color: #e0d8ff;
          font-size: 17px;
          font-family: inherit;
          outline: none;
        }
        .cc-artist-search:focus { border-color: rgba(124,92,231,.5); }
        .cc-artist-empty {
          grid-column: 1 / -1;
          text-align: center;
          color: #8b7eb8;
          font-size: 17px;
          padding: 12px 0;
          margin: 0;
        }
        .cc-lock-note {
          font-size: 17px; color: #8b7eb8; margin: 0 0 8px;
        }
        .cc-upgrade-link {
          background: none; border: none; padding: 0; color: #a78bfa;
          font-weight: 600; cursor: pointer; text-decoration: underline;
        }
        .cc-artist-opt.locked { opacity: 0.55; cursor: pointer; }
        .cc-artist-grid--locked .cc-artist-opt:not(:first-child):hover {
          border-color: rgba(167, 139, 250, 0.4);
        }
        .cc-unlock-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(8, 6, 18, 0.72);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .cc-unlock-card {
          max-width: 360px; width: 100%;
          background: linear-gradient(160deg, #1a1430, #120e22);
          border: 1.5px solid rgba(124, 92, 231, 0.45);
          border-radius: 18px; padding: 22px 20px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.45);
        }
        .cc-unlock-title { margin: 0 0 10px; font-size: 23px; font-weight: 700; color: #e9d5ff; }
        .cc-unlock-body { margin: 0 0 16px; font-size: 19px; line-height: 1.55; color: #b09ee0; }
        .cc-unlock-err { margin: 0 0 10px; font-size: 17px; color: #fca5a5; }
        .cc-unlock-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
        .cc-unlock-primary, .cc-unlock-secondary {
          border-radius: 12px; padding: 10px 16px; font-size: 18px; font-weight: 700;
          cursor: pointer; font-family: inherit; border: none;
        }
        .cc-unlock-primary {
          background: #7c5ce7; color: #fff;
        }
        .cc-unlock-secondary {
          background: rgba(255,255,255,0.08); color: #c4b5f0;
          border: 1px solid rgba(176,158,224,.25);
        }
      `}</style>
    </div>
  )
}