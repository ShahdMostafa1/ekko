import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import AuthScreen     from './components/AuthScreen'
import Onboarding     from './components/Onboarding'
import LanguagePicker from './components/LanguagePicker'
import MoodInput      from './components/MoodInput'
import CoCreation     from './components/CoCreation'
import MusicPlayer    from './components/MusicPlayer'
import SongHistory    from './components/SongHistory'
import RewardsScreen  from './components/RewardsScreen'
import RewardBadge    from './components/RewardBadge'
import BackButton     from './components/BackButton'
import AdminDashboard from './components/AdminDashboard'
import SubscribeButton from './components/SubscribeButton'
import BillingPortalButton from './components/BillingPortalButton'
import './App.css'

const STARS = Array.from({ length: 55 }).map((_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top:  `${Math.random() * 100}%`,
  animationDelay:    `${(Math.random() * 4).toFixed(2)}s`,
  animationDuration: `${(2 + Math.random() * 3).toFixed(2)}s`,
  width:  `${1 + Math.random() * 2}px`,
  height: `${1 + Math.random() * 2}px`,
}))

const REGION_DEFAULTS = {
  arabic:      { scale: 'D minor', instruments: ['oud', 'strings', 'piano'] },
  west_africa: { scale: 'F major', instruments: ['drums', 'bass', 'guitar'] },
  india:       { scale: 'A minor', instruments: ['strings', 'flute', 'piano'] },
  east_asia:   { scale: 'G major', instruments: ['flute', 'piano', 'strings'] },
  latin:       { scale: 'C major', instruments: ['guitar', 'bass', 'drums'] },
  europe:      { scale: 'C major', instruments: ['piano', 'strings', 'flute'] },
  global:      { scale: 'C major', instruments: ['piano', 'strings'] },
}

const BACK_MAP = {
  onboarding: { screen: 'auth',       label: 'Sign out'        },
  language:   { screen: 'onboarding', label: 'Change region'   },
  mood:       { screen: 'language',   label: 'Change language'  },
  cocreation: { screen: 'mood',       label: 'Change mood'      },
  player:     { screen: 'mood',       label: 'New mood'         },
  history:    { screen: 'mood',       label: 'Back'             },
  rewards:    { screen: 'mood',       label: 'Back'             },
}

const ADMIN_EMAIL = 'admin@ekko.app'

// ── Idempotent XP helper ──────────────────────────────────────────────────────
async function awardXpIdempotent(userId, action, sessionKey) {
  if (!userId) return null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_API_URL}/rewards/xp`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
      },
      body: JSON.stringify({ user_id: userId, action, session_key: sessionKey }),
    })
    const data = await res.json()
    return data
  } catch (err) {
    console.warn('[ekko] XP award failed silently:', err)
    return null
  }
}

export default function App() {
  const [screen, setScreen]           = useState('loading')
  const [user, setUser]               = useState(null)
  const [region, setRegion]           = useState(null)
  const [language, setLanguage]       = useState(null)
  const [moodData, setMoodData]       = useState(null)
  const [musicParams, setMusicParams] = useState(null)
  const [xp, setXp]                   = useState(0)
  const [reward, setReward]           = useState(null)

  // Tracks in memory whether region XP was already given this session.
  // The real source of truth is profiles.region_xp_awarded in Supabase.
  const regionXpAwardedRef = useRef(false)

  const moodSessionIdRef = useRef(null)
  const songSessionIdRef = useRef(null)
  const pendingGenRef    = useRef(null)
  const moodDataRef      = useRef(null)
  const regionRef        = useRef(null)
  const languageRef      = useRef(null)
  const userRef          = useRef(null)

  useEffect(() => { moodDataRef.current  = moodData  }, [moodData])
  useEffect(() => { regionRef.current    = region    }, [region])
  useEffect(() => { languageRef.current  = language  }, [language])
  useEffect(() => { userRef.current      = user      }, [user])

  // ── Helpers ───────────────────────────────────────────────────────────
  const showReward = (label, sub) => {
    setReward({ label, sub })
    setTimeout(() => setReward(null), 3000)
  }

  const addXp = async (action, sessionKey) => {
    const currentUser = userRef.current
    if (!currentUser) return

    const result = await awardXpIdempotent(currentUser.id, action, sessionKey)
    if (!result) return

    if (result.awarded) {
      setXp(result.total_xp)
      showReward(`+${result.xp_awarded} XP`, action.replace(/_/g, ' '))
    }
  }

  // ── Core music fetch ──────────────────────────────────────────────────
  // music_cocreated XP is NOT awarded here — only in handleSongSaved.
  const generateMusic = useCallback(async (params, finalScale, finalInstr) => {
    const mood        = moodDataRef.current
    const reg         = regionRef.current
    const lang        = languageRef.current
    const currentUser = userRef.current

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/music/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          mood_text:       mood?.text    || mood?.label || '',
          valence:         mood?.valence  ?? 0.5,
          energy:          mood?.energy   ?? 0.5,
          tempo_bpm:       params.tempo_bpm,
          scale:           finalScale,
          instruments:     finalInstr,
          region:          reg?.id || 'global',
          emotion:         mood?.emotion || 'neutral',
          mood_label:      mood?.label   || '',
          language_code:   lang?.code    || '',
          artist_style_id: params.artist_style_id || '',
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const songId = data.song_id || data.task_id || `song_${Date.now()}`
      songSessionIdRef.current = songId

      setMusicParams({
        ...data,
        user_id:       currentUser?.id || '',
        region:        reg?.id         || 'global',
        mood_label:    mood?.label     || '',
        emotion:       mood?.emotion   || 'neutral',
        valence:       mood?.valence   ?? 0.5,
        energy:        mood?.energy    ?? 0.5,
        language_code: lang?.code      || '',
      })

    } catch (err) {
      console.error('[ekko] Music generation failed, using mock:', err)
      const songId = `mock_${Date.now()}`
      songSessionIdRef.current = songId
      setMusicParams({
        audio_url:   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        prompt_used: `${moodDataRef.current?.label} music for ${regionRef.current?.id || 'global'} region`,
        region:      regionRef.current?.id || 'global',
        mock:        true,
      })
    }

    pendingGenRef.current = null
    setScreen('player')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Called by MusicPlayer only after song is confirmed saved ──────────
  const handleSongSaved = useCallback(async (savedSongId) => {
    console.log('[ekko] ✅ Song saved to history')
    const songKey = savedSongId || songSessionIdRef.current
    if (!songKey) return
    await addXp('music_cocreated', `music_cocreated:${songKey}`)

    // After a song is generated and actually saved, allow region XP to be
    // awarded again on the next region+language selection cycle.
    const currentUser = userRef.current
    if (currentUser) {
      try {
        await supabase
          .from('profiles')
          .update({ region_xp_awarded: false })
          .eq('id', currentUser.id)
        regionXpAwardedRef.current = false
        console.log('[ekko] Region XP guard reset after saved song')
      } catch (err) {
        console.warn('[ekko] Failed to reset region_xp_awarded:', err)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Page Visibility API ───────────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pendingGenRef.current) {
        console.log('[ekko] Tab resumed — retrying music generation')
        const { params, finalScale, finalInstr } = pendingGenRef.current
        generateMusic(params, finalScale, finalInstr)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [generateMusic])

  // ── Auth ──────────────────────────────────────────────────────────────
  const loadProfile = async (authUser) => {
    setUser(authUser)
    userRef.current = authUser

    if (authUser.email === ADMIN_EMAIL) {
      setScreen('admin')
      return
    }

    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (!profile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({ id: authUser.id, xp: 0, region: null, region_xp_awarded: false })
        .select()
        .single()
      profile = newProfile
    }

    if (profile) {
      setXp(profile.xp || 0)
      // Restore the region XP flag from DB into memory ref
      regionXpAwardedRef.current = !!profile.region_xp_awarded

      if (profile.region && profile.region !== 'global') {
        setRegion({ id: profile.region, emoji: '🌍', label: profile.region })
        setScreen('language')
      } else {
        setScreen('onboarding')
      }
    } else {
      setScreen('onboarding')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user)
      else setScreen('auth')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        userRef.current          = null
        regionXpAwardedRef.current = false
        setXp(0)
        setRegion(null)
        setLanguage(null)
        setMoodData(null)
        setMusicParams(null)
        pendingGenRef.current    = null
        moodSessionIdRef.current = null
        songSessionIdRef.current = null
        setScreen('auth')
        return
      }
      if (session?.user) loadProfile(session.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Screen handlers ───────────────────────────────────────────────────
  const handleAuth = ({ user: authUser, profile }) => {
    setUser(authUser)
    userRef.current = authUser

    if (authUser.email === ADMIN_EMAIL) {
      setScreen('admin')
      return
    }

    setXp(profile?.xp || 0)
    regionXpAwardedRef.current = !!profile?.region_xp_awarded

    if (profile?.region && profile.region !== 'global') {
      setRegion({ id: profile.region, emoji: '🌍', label: profile.region })
      setScreen('language')
    } else {
      setScreen('onboarding')
    }
  }

  const handleOnboard = async (selectedRegion) => {
    setRegion(selectedRegion)

    if (userRef.current) {
      await supabase
        .from('profiles')
        .update({ region: selectedRegion.id })
        .eq('id', userRef.current.id)
    }

    setScreen('language')
  }

  // Changing language gives NO XP — just move to mood screen.
  const handleLanguagePick = async (selectedLanguage) => {
    setLanguage(selectedLanguage)

    // Award the region+language bonus once per cycle (persisted in DB).
    // Only award if user has a non-global region and hasn't been awarded yet.
    const currentUser = userRef.current
    const currentRegion = regionRef.current
    if (currentUser && currentRegion && currentRegion.id !== 'global' && !regionXpAwardedRef.current) {
      regionXpAwardedRef.current = true // block races
      try {
        await supabase
          .from('profiles')
          .update({ region_xp_awarded: true })
          .eq('id', currentUser.id)
        await addXp('region_selected', `region_selected:${currentUser.id}`)
      } catch (err) {
        console.warn('[ekko] Failed to persist region_xp_awarded:', err)
      }
    } else {
      console.log('[ekko] Region XP already awarded or no region — skipping')
    }

    setScreen('mood')
  }

  const handleMoodSubmit = async (mood) => {
    setMoodData(mood)

    const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    moodSessionIdRef.current = sessionId
    songSessionIdRef.current = null

    if (userRef.current) {
      await addXp('mood_shared', `mood_shared:${sessionId}`)
    }

    const currentUser = userRef.current
    if (currentUser) {
      fetch(`${import.meta.env.VITE_API_URL}/rewards/checkin`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: currentUser.id }),
      }).catch(err => console.warn('[ekko] Checkin failed silently:', err))
    }

    setScreen('cocreation')
  }

  const handleCoCreate = async (params) => {
    setScreen('generating')
    const regionDef  = REGION_DEFAULTS[region?.id] || REGION_DEFAULTS.global
    const finalScale = params.scale || regionDef.scale
    const finalInstr = params.instruments?.length ? params.instruments : regionDef.instruments

    pendingGenRef.current = { params, finalScale, finalInstr }

    if (user) {
      await supabase.from('mood_sessions').insert({
        user_id:     user.id,
        mood_label:  moodData.label,
        valence:     moodData.valence,
        energy:      moodData.energy,
        region:      region?.id || 'global',
        scale:       finalScale,
        tempo_bpm:   params.tempo_bpm,
        instruments: finalInstr,
      })
    }

    await generateMusic(params, finalScale, finalInstr)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const goBack = () => {
    const dest = BACK_MAP[screen]
    if (!dest) return
    if (dest.screen === 'auth') { handleSignOut(); return }
    if (screen === 'player' || dest.screen === 'onboarding') {
      setMusicParams(null)
    }
    setScreen(dest.screen)
  }

  const backInfo  = BACK_MAP[screen]
  const regionDef = REGION_DEFAULTS[region?.id] || REGION_DEFAULTS.global

  // ── Render ────────────────────────────────────────────────────────────
  if (screen === 'loading') return (
    <div className="ekko-root" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="gen-orb" />
    </div>
  )

  if (screen === 'admin') return (
    <AdminDashboard onExit={handleSignOut} />
  )

  return (
    <div className="ekko-root">
      <div className="stars-bg" aria-hidden="true">
        {STARS.map(s => (
          <span key={s.id} className="star" style={{
            left: s.left, top: s.top,
            animationDelay:    s.animationDelay,
            animationDuration: s.animationDuration,
            width: s.width, height: s.height,
          }} />
        ))}
      </div>

      {screen !== 'auth' && screen !== 'loading' && (
        <header className="ekko-header">
          <div className="ekko-logo" onClick={() => setScreen('mood')} style={{ cursor: 'pointer' }}>
            Ekko
            {region && (
              <span className="ekko-region-tag">
                {region.emoji} {region.label}
                {language && <span className="ekko-lang-tag"> · {language.native}</span>}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {xp > 0 && <div className="xp-chip">{xp} XP</div>}
            <button className="nav-history-btn" onClick={() => setScreen('history')}>🎵 Songs</button>
            <button className="nav-history-btn" onClick={() => setScreen('rewards')}>🏅 Rewards</button>
+           {/* Pricing / billing actions */}
+           <SubscribeButton plan="groove" userId={userRef.current?.id} email={userRef.current?.email}>
+             Subscribe: Groove
+           </SubscribeButton>
+           <SubscribeButton plan="studio" userId={userRef.current?.id} email={userRef.current?.email}>
+             Subscribe: Studio
+           </SubscribeButton>
+           <BillingPortalButton userId={userRef.current?.id}>Billing</BillingPortalButton>
            <button className="nav-history-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        </header>
      )}
      <main className="ekko-main">
        {backInfo && screen !== 'generating' && screen !== 'auth' && (
          <div className="back-btn-wrap">
            <BackButton onClick={goBack} label={backInfo.label} />
          </div>
        )}

        {screen === 'auth'       && <AuthScreen onAuth={handleAuth} />}
        {screen === 'onboarding' && <Onboarding onComplete={handleOnboard} />}
        {screen === 'language'   && <LanguagePicker region={region} onComplete={handleLanguagePick} />}
        {screen === 'mood'       && (
          <MoodInput
            onSubmit={handleMoodSubmit}
            onMoodDetected={() => {}}
            userId={userRef.current?.id}
            region={region}
          />
        )}
        {screen === 'cocreation' && (
          <CoCreation
            mood={moodData}
            regionDefaults={regionDef}
            region={region}
            onGenerate={handleCoCreate}
          />
        )}
        {screen === 'generating' && (
          <div className="generating-screen">
            <div className="gen-orb" />
            <p className="gen-label">Composing your music…</p>
            <p className="gen-sub">Translating emotion into sound</p>
          </div>
        )}
        {screen === 'player' && musicParams && (
          <div className="player-screen">
            <MusicPlayer
              params={musicParams}
              onSaved={(savedSongId) => handleSongSaved(savedSongId || songSessionIdRef.current)}
            />
          </div>
        )}
        {screen === 'history' && <SongHistory  userId={userRef.current?.id} />}
        {screen === 'rewards' && <RewardsScreen xp={xp} userId={userRef.current?.id} />}
      </main>

      {reward && <RewardBadge label={reward.label} sub={reward.sub} />}
    </div>
  )
}