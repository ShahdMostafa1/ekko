import { useState, useRef, useEffect } from "react";

const POLL_INTERVAL = 4000;
const POLL_TIMEOUT  = 360000; // 6 min

export default function MusicPlayer({ params, onSaved }) {
  const audioRef     = useRef(null);
  const pollRef      = useRef(null);
  const pollStartRef = useRef(null);
  const savedRef     = useRef(false);   // ← prevents double-save

  const [audioUrl, setAudioUrl]         = useState(params?.audio_url || null);
  const [taskId]                        = useState(params?.task_id || null);
  const [polling, setPolling]           = useState(false);
  const [pollStatus, setPollStatus]     = useState("Writing your song lyrics…");
  const [playing, setPlaying]           = useState(false);
  const [progress, setProgress]         = useState(0);
  const [duration, setDuration]         = useState(0);
  const [audioLoading, setAudioLoading] = useState(true);
  const [audioError, setAudioError]     = useState(null);
  const [showLyrics, setShowLyrics]     = useState(false);

  const lyrics      = params?.lyrics       || null;
  const promptUsed  = params?.prompt_used  || "";
  const region      = params?.region       || "";
  const regionLabel = params?.region_label || (region ? `🌍 ${region}` : "");
  const language    = params?.language     || "";

  // ── Poll for audio if we have task_id but no audio_url ──────────────
  useEffect(() => {
    if (audioUrl || !taskId || taskId === "mock") return;

    setPolling(true);
    pollStartRef.current = Date.now();

    const poll = async () => {
      const elapsed = Math.round((Date.now() - pollStartRef.current) / 1000);

      if (elapsed * 1000 > POLL_TIMEOUT) {
        setPolling(false);
        setPollStatus("Took too long. Please try again.");
        return;
      }

      if (elapsed < 15)       setPollStatus("Writing your song lyrics…");
      else if (elapsed < 30)  setPollStatus("Composing the melody…");
      else if (elapsed < 60)  setPollStatus("Recording vocals…");
      else if (elapsed < 120) setPollStatus("Mixing the track…");
      else                    setPollStatus(`Almost there… ${elapsed}s`);

      try {
        const res  = await fetch(`${import.meta.env.VITE_API_URL}/music/status/${taskId}`);
        const data = await res.json();

        if (data.status === "SUCCESS" && data.audio_url) {
          setAudioUrl(data.audio_url);
          setPolling(false);
          return;
        }
        if (data.status === "FAILED") {
          setPolling(false);
          setPollStatus(`Generation failed: ${data.error || "Unknown error"}`);
          return;
        }
      } catch (err) {
        console.error("Poll error:", err);
      }

      pollRef.current = setTimeout(poll, POLL_INTERVAL);
    };

    pollRef.current = setTimeout(poll, 2000);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [taskId, audioUrl]);

  // ── Save song once audio URL is confirmed ────────────────────────────
  useEffect(() => {
    if (!audioUrl)             return;   // no audio yet
    if (savedRef.current)      return;   // already saved
    if (!params?.user_id)      return;   // no user — skip silently
    if (params?.mock)          return;   // don't save mock songs

    savedRef.current = true;

    const body = {
      user_id:         params.user_id,
      region:          params.region          || "",
      region_label:    params.region_label    || "",
      mood_label:      params.mood_label      || "",
      emotion:         params.emotion         || "neutral",
      valence:         params.valence         ?? 0.5,
      energy:          params.energy          ?? 0.5,
      lyrics:          params.lyrics          || "",
      audio_url:       audioUrl,
      prompt_used:     params.prompt_used     || "",
      language:        params.language        || "English",
      language_code:   params.language_code   || "",
      artist_style_id: params.artist_style_id || "",
      artist_label:    params.artist_label    || "",
    };

    console.log("[save] Saving song for user:", params.user_id, "audio:", audioUrl);

    fetch("${import.meta.env.VITE_API_URL}/music/save", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    })
      .then(r => r.json())
      .then(d => {
        if (d.saved) {
          console.log("[save] ✅ Song saved to history");
          onSaved?.();
        } else {
          console.error("[save] ❌ Save failed:", d.reason);
        }
      })
      .catch(e => console.error("[save] ❌ Network error:", e));
  }, [audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio handlers ────────────────────────────────────────────────────
  const onCanPlay        = () => setAudioLoading(false);
  const onError          = () => { setAudioLoading(false); setAudioError("Could not load audio. Try again."); };
  const onLoadedMetadata = () => setDuration(audioRef.current?.duration || 0);
  const onTimeUpdate     = () => {
    const el = audioRef.current;
    if (el?.duration) setProgress(el.currentTime / el.duration);
  };
  const onEnded = () => {
    setPlaying(false); setProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().catch(() => setAudioError("Tap play to start.")); setPlaying(true); }
  };

  const seek = (e) => {
    const el = audioRef.current;
    if (!el?.duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
    setProgress(ratio);
  };

  const fmt = (sec) => {
    if (!sec || isNaN(sec)) return "0:00";
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;
  };

  // ── Generating screen ─────────────────────────────────────────────────
  if (polling || (!audioUrl && taskId)) {
    return (
      <div style={s.card}>
        <div style={s.orb} />
        <p style={s.pollLabel}>{pollStatus}</p>
        {lyrics && (
          <div style={s.lyricsPreview}>
            <p style={s.lyricsPreviewLabel}>✍️ Lyrics written</p>
            <p style={s.lyricsPreviewText}>
              {lyrics.split("\n").slice(0, 3).join("\n")}…
            </p>
          </div>
        )}
        <p style={s.pollSub}>AI is creating a full song just for your mood</p>
        <div style={s.dots}>
          {[0,1,2].map(i => (
            <span key={i} style={{ ...s.dot, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <style>{keyframes}</style>
      </div>
    );
  }

  // ── Error / no audio ──────────────────────────────────────────────────
  if (!audioUrl) {
    return (
      <div style={s.card}>
        <p style={s.errorText}>{pollStatus || "No audio available."}</p>
        <style>{keyframes}</style>
      </div>
    );
  }

  // ── Player ────────────────────────────────────────────────────────────
  return (
    <div style={s.card}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onCanPlay={onCanPlay}
        onError={onError}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        preload="auto"
        crossOrigin="anonymous"
      />

      {/* Header */}
      <div style={s.header}>
        <span style={{ fontSize: 36 }}>🎵</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={s.title}>Your Mood Song</p>
          <p style={s.subtitle} title={promptUsed}>
            {regionLabel} · AI-generated{language ? ` · ${language} lyrics` : ""}
          </p>
        </div>
      </div>

      {/* Waveform bars + seek */}
      <div style={s.progressWrap} onClick={seek}>
        <div style={s.barsWrap} aria-hidden="true">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} style={{
              ...s.bar,
              height: `${16 + Math.sin(i * 0.7) * 12 + Math.cos(i * 0.3) * 8}px`,
              opacity: progress * 32 > i ? 1 : 0.25,
              animation: playing
                ? `barPulse ${0.6 + (i % 3) * 0.15}s ease-in-out ${i * 0.04}s infinite alternate`
                : "none",
            }} />
          ))}
        </div>
        <div style={s.progressBg}>
          <div style={{ ...s.progressFill, width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* Time row */}
      <div style={s.timeRow}>
        <span style={s.timeText}>{fmt(duration * progress)}</span>
        <span style={s.timeText}>{fmt(duration)}</span>
      </div>

      {/* Play button */}
      {audioLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={s.spinner} />
          <span style={s.subtitle}>Loading audio…</span>
        </div>
      ) : audioError ? (
        <p style={s.errorText}>{audioError}</p>
      ) : (
        <button style={s.playBtn} onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <rect x="5" y="4" width="4" height="16" rx="1"/>
              <rect x="15" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>
      )}

      {/* Lyrics toggle */}
      {lyrics && (
        <div style={s.lyricsSection}>
          <button style={s.lyricsToggle} onClick={() => setShowLyrics(v => !v)}>
            {showLyrics ? "▲ Hide lyrics" : "✍️ Show lyrics"}
          </button>
          {showLyrics && (
            <div style={s.lyricsBox}>
              {lyrics.split("\n").map((line, i) => (
                <p key={i} style={{
                  ...s.lyricLine,
                  opacity: line.trim() === "" ? 0 : 1,
                  marginBottom: line.trim() === "" ? "12px" : "2px",
                }}>
                  {line || "\u00A0"}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{keyframes}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  card: {
    background: "linear-gradient(135deg,#1a1040,#2d1b69 50%,#1a1040)",
    borderRadius: 24,
    padding: "28px 24px",
    maxWidth: 380,
    margin: "0 auto",
    boxShadow: "0 16px 48px rgba(92,63,199,.4)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 18,
    color: "#fff",
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
  },
  orb: {
    width: 80, height: 80, borderRadius: "50%",
    background: "radial-gradient(circle,#a855f7,#7c5ce7)",
    boxShadow: "0 0 40px rgba(168,85,247,.6)",
    animation: "orbPulse 2s ease-in-out infinite",
  },
  pollLabel:  { margin: 0, fontSize: 16, fontWeight: 700, textAlign: "center" },
  pollSub:    { margin: 0, fontSize: 12, color: "rgba(255,255,255,.5)", textAlign: "center" },
  dots:       { display: "flex", gap: 6 },
  dot: {
    width: 8, height: 8, borderRadius: "50%", background: "#a855f7",
    display: "inline-block", animation: "dotBounce .8s ease-in-out infinite alternate",
  },
  lyricsPreview: {
    width: "100%", background: "rgba(255,255,255,.06)",
    borderRadius: 12, padding: "12px 16px",
  },
  lyricsPreviewLabel: { margin: "0 0 6px", fontSize: 11, color: "#a855f7", fontWeight: 600 },
  lyricsPreviewText: {
    margin: 0, fontSize: 13, color: "rgba(255,255,255,.7)",
    lineHeight: 1.7, whiteSpace: "pre-line", fontStyle: "italic",
  },
  header:   { display: "flex", alignItems: "center", gap: 14, width: "100%" },
  title:    { margin: 0, fontSize: 17, fontWeight: 700 },
  subtitle: { margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,.5)", lineHeight: 1.4 },
  progressWrap: {
    width: "100%", cursor: "pointer", position: "relative",
    height: 52, display: "flex", alignItems: "center",
  },
  barsWrap: { display: "flex", alignItems: "center", gap: 2, width: "100%", height: 48 },
  bar: {
    flex: 1,
    background: "linear-gradient(180deg,#a855f7,#7c5ce7)",
    borderRadius: 2, transformOrigin: "bottom", transition: "opacity .2s",
  },
  progressBg: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 3, background: "rgba(255,255,255,.12)", borderRadius: 2, overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg,#7c5ce7,#a855f7)",
    borderRadius: 2, transition: "width .1s linear",
  },
  timeRow:  { display: "flex", justifyContent: "space-between", width: "100%", marginTop: -10 },
  timeText: { fontSize: 11, color: "rgba(255,255,255,.4)", fontVariantNumeric: "tabular-nums" },
  playBtn: {
    width: 68, height: 68, borderRadius: "50%", border: "none",
    background: "linear-gradient(135deg,#7c5ce7,#a855f7)",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 8px 24px rgba(124,92,231,.5)",
    transition: "transform .15s",
  },
  spinner: {
    width: 24, height: 24,
    border: "3px solid rgba(255,255,255,.15)",
    borderTop: "3px solid #a855f7",
    borderRadius: "50%", animation: "spin .9s linear infinite",
  },
  errorText: { fontSize: 13, color: "#f87171", margin: 0, textAlign: "center" },
  lyricsSection: { width: "100%", display: "flex", flexDirection: "column", gap: 8 },
  lyricsToggle: {
    background: "rgba(168,85,247,.15)", border: "1px solid rgba(168,85,247,.3)",
    borderRadius: 20, padding: "7px 16px", color: "#c084fc",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    alignSelf: "center", transition: "background .18s",
  },
  lyricsBox: {
    background: "rgba(255,255,255,.05)", borderRadius: 14,
    padding: "16px 18px", width: "100%", boxSizing: "border-box",
    maxHeight: 240, overflowY: "auto",
  },
  lyricLine: {
    margin: 0, fontSize: 14, color: "rgba(255,255,255,.85)",
    lineHeight: 1.8, whiteSpace: "pre-wrap",
  },
};

const keyframes = `
  @keyframes barPulse {
    from { transform: scaleY(0.5); }
    to   { transform: scaleY(1.4); }
  }
  @keyframes orbPulse {
    0%,100% { box-shadow: 0 0 40px rgba(168,85,247,.6); }
    50%      { box-shadow: 0 0 80px rgba(168,85,247,.95); }
  }
  @keyframes dotBounce {
    from { transform: translateY(0); opacity: .5; }
    to   { transform: translateY(-8px); opacity: 1; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;