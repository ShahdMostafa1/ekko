import { useState, useRef, useEffect, useMemo } from "react";
import { canDownload, hasPriorityQueue } from '../utils/planUtils';
import { proxiedAudioUrl, openAudioUrl } from '../utils/audioProxy';
import {
  applyAudioSource,
  fetchBlobAudioUrl,
  isMobileBrowser,
  mobileAudioElementProps,
  playFromUserGesture,
  revokeBlobAudioUrl,
} from '../utils/mobileAudio';

const POLL_INTERVAL_FREE = 4000;
const POLL_INTERVAL_PRIORITY = 2500;
const POLL_TIMEOUT  = 360000;

export default function MusicPlayer({ params, onSaved, onDone, userPlan = 'free', onUpgrade }) {
  const audioRef     = useRef(null);
  const pollRef      = useRef(null);
  const pollStartRef = useRef(null);
  const retryRef     = useRef(0);

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
  const [savedOk, setSavedOk]           = useState(false);
  const [copied, setCopied]             = useState(false);

  const lyrics      = params?.lyrics       || null;
  const promptUsed  = params?.prompt_used  || "";
  const region      = params?.region       || "";
  const regionLabel = params?.region_label || (region ? `🌍 ${region}` : "");
  const language    = params?.language     || "";
  const songTitle   = params?.title        || "Your Mood Song";
  const pollInterval = hasPriorityQueue(userPlan) || params?.priority_queue
    ? POLL_INTERVAL_PRIORITY
    : POLL_INTERVAL_FREE;
  const isPriority   = pollInterval === POLL_INTERVAL_PRIORITY;
  const playbackUrl  = useMemo(() => proxiedAudioUrl(audioUrl, taskId), [audioUrl, taskId]);
  const tabOpenUrl   = useMemo(() => openAudioUrl(audioUrl, taskId), [audioUrl, taskId]);
  const [srcOverride, setSrcOverride] = useState(null);
  const effectiveSrc = srcOverride || playbackUrl;

  useEffect(() => () => revokeBlobAudioUrl(), []);

  useEffect(() => {
    setSrcOverride(null);
    revokeBlobAudioUrl();
    retryRef.current = 0;
    if (!playbackUrl) return;
    setAudioLoading(true);
    setAudioError(null);

    let cancelled = false;
    const prime = async () => {
      if (isMobileBrowser()) {
        const blobUrl = await fetchBlobAudioUrl(playbackUrl);
        if (cancelled) return;
        if (blobUrl) {
          setSrcOverride(blobUrl);
          setAudioLoading(false);
          return;
        }
      }
      const el = audioRef.current;
      if (el && !cancelled) applyAudioSource(el, playbackUrl);
    };
    prime();
    return () => { cancelled = true; };
  }, [playbackUrl]);

  useEffect(() => {
    if (!srcOverride) return;
    const el = audioRef.current;
    if (el) {
      setAudioLoading(true);
      applyAudioSource(el, srcOverride);
    }
    const t = setTimeout(() => setAudioLoading(false), 12000);
    return () => clearTimeout(t);
  }, [srcOverride]);

  useEffect(() => {
    if (!playbackUrl || !audioLoading) return;
    const t = setTimeout(() => setAudioLoading(false), 20000);
    return () => clearTimeout(t);
  }, [playbackUrl, audioLoading]);

  // ── Poll for audio ────────────────────────────────────────
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
      if (isPriority && elapsed < 15) setPollStatus("Priority queue — writing lyrics…");
      else if (elapsed < 15)       setPollStatus("Writing your song lyrics…");
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
        console.error("[poll] error:", err);
      }
      pollRef.current = setTimeout(poll, pollInterval);
    };

    pollRef.current = setTimeout(poll, isPriority ? 1200 : 2000);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [taskId, audioUrl, pollInterval, isPriority]);

  // ── Save song once audio URL is ready ─────────────────────
  useEffect(() => {
    if (!audioUrl || savedOk || !params?.user_id || params?.mock) return;
    const stableKey = params?.task_id || params?.audio_url;
    const body = {
      user_id: params.user_id, region: params.region || "",
      region_label: params.region_label || "", mood_label: params.mood_label || "",
      emotion: params.emotion || "neutral", valence: params.valence ?? 0.5,
      energy: params.energy ?? 0.5, lyrics: params.lyrics || "",
      audio_url: audioUrl, task_id: taskId || '', prompt_used: params.prompt_used || "",
      language: params.language || "English", language_code: params.language_code || "",
      artist_style_id: params.artist_style_id || "", artist_label: params.artist_label || "",
      title: params.title || "",
    };
    fetch(`${import.meta.env.VITE_API_URL}/music/save`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(d => { if (d.saved) { setSavedOk(true); onSaved?.(stableKey); } })
      .catch(e => console.error("[save] error:", e));
  }, [audioUrl, savedOk]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio event handlers ───────────────────────────────────
  const onCanPlay        = () => setAudioLoading(false);
  const onLoadedMetadata = () => setDuration(audioRef.current?.duration || 0);
  const onTimeUpdate     = () => {
    const el = audioRef.current;
    if (el?.duration) setProgress(el.currentTime / el.duration);
  };
  const onEnded = () => {
    setPlaying(false); setProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };
  const onError = async () => {
    const el = audioRef.current;
    if (!el || !effectiveSrc) {
      setAudioLoading(false);
      setAudioError("Could not load audio. Try opening in a new tab.");
      return;
    }
    // Safari sometimes fires error while still playing — ignore if buffer is OK
    if (el.currentTime > 1 && !el.paused && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    retryRef.current += 1;
    if (playbackUrl && !srcOverride && retryRef.current <= 2) {
      const blobUrl = await fetchBlobAudioUrl(playbackUrl);
      if (blobUrl) {
        setSrcOverride(blobUrl);
        setAudioError(null);
        setAudioLoading(true);
        return;
      }
    }
    setAudioLoading(false);
    setAudioError("Could not load audio. Try opening in a new tab.");
  };

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    if (isMobileBrowser() && playbackUrl && !srcOverride) {
      setAudioLoading(true);
      const blobUrl = await fetchBlobAudioUrl(playbackUrl);
      if (blobUrl) {
        setSrcOverride(blobUrl);
        applyAudioSource(el, blobUrl);
        setAudioLoading(false);
      }
    }
    if (el.readyState < HTMLMediaElement.HAVE_METADATA && effectiveSrc) {
      applyAudioSource(el, effectiveSrc);
    }
    const ok = await playFromUserGesture(el);
    if (ok) {
      setPlaying(true);
      setAudioError(null);
    } else {
      setAudioError("Tap play to start.");
    }
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

  const handleShare = async () => {
    const text = `🎵 Just created "${songTitle}" on Ekko — an AI song made from my mood!\n${window.location.href}`;
    if (navigator.share) {
      try { await navigator.share({ title: songTitle, text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Generating screen ──────────────────────────────────────
  if (polling || (!audioUrl && taskId)) {
    return (
      <div className="mp-card" style={s.card}>
        <div style={s.orb} />
        <p style={s.pollLabel}>{pollStatus}</p>
        {lyrics && (
          <div style={s.lyricsPreview}>
            <p style={s.lyricsPreviewLabel}>✍️ Lyrics written</p>
            <p style={s.lyricsPreviewText}>{lyrics.split("\n").slice(0, 3).join("\n")}…</p>
          </div>
        )}
        <p style={s.pollSub}>AI is creating a full song just for your mood</p>
        <div style={s.dots}>
          {[0,1,2].map(i => <span key={i} style={{ ...s.dot, animationDelay: `${i * 0.2}s` }} />)}
        </div>
        <style>{keyframes}</style>
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="mp-card" style={s.card}>
        <p style={s.errorText}>{pollStatus || "No audio available."}</p>
        <style>{keyframes}</style>
      </div>
    );
  }

  // ── Player ─────────────────────────────────────────────────
  return (
    <div className="mp-card" style={s.card}>
      <audio
        ref={audioRef}
        src={effectiveSrc || undefined}
        onCanPlay={onCanPlay}
        onPlaying={() => { setAudioLoading(false); setAudioError(null); }}
        onError={onError}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        {...mobileAudioElementProps()}
      />

      {/* Header */}
      <div style={s.header}>
        <div style={s.albumArt}>
          <span style={{ fontSize: 28 }}>🎵</span>
          {playing && <div style={s.albumPulse} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={s.title}>{songTitle}</p>
          <p style={s.subtitle} title={promptUsed}>
            {regionLabel}{language ? ` · ${language} lyrics` : ""}
          </p>
        </div>
        {savedOk && <div style={s.savedBadge}>✓ Saved</div>}
      </div>

      {/* Waveform bars — animated while playing */}
      <div style={s.waveformWrap} onClick={seek} role="slider" aria-label="Seek">
        <div style={s.barsWrap} aria-hidden="true">
          {Array.from({ length: 40 }).map((_, i) => {
            const h = 10 + Math.sin(i * 0.55) * 14 + Math.cos(i * 0.28) * 9;
            const isPast = progress * 40 > i;
            return (
              <div key={i} style={{
                ...s.bar,
                height: `${h}px`,
                background: isPast
                  ? `linear-gradient(180deg,#c084fc,#7c5ce7)`
                  : "rgba(255,255,255,0.13)",
                animation: playing
                  ? `barPulse ${0.5 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite alternate`
                  : "none",
                transform: playing && isPast ? undefined : "scaleY(1)",
              }} />
            );
          })}
        </div>
        {/* Thin progress line underneath bars */}
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <p style={s.errorText}>{audioError}</p>
          <p style={{ ...s.subtitle, margin: 0, textAlign: "center" }}>
            Playback failed on this device — you can still continue below.
          </p>
          <a href={tabOpenUrl || audioUrl} target="_blank" rel="noreferrer" style={s.openLink}>Open audio in new tab ↗</a>
        </div>
      ) : (
        <button style={s.playBtn} onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <rect x="5" y="4" width="4" height="16" rx="1.5"/>
              <rect x="15" y="4" width="4" height="16" rx="1.5"/>
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <polygon points="6,3 20,12 6,21"/>
            </svg>
          )}
        </button>
      )}

      {/* Action row — Download + Share */}
      {!audioLoading && !audioError && (
        <div className="mp-action-row" style={s.actionRow}>
          {canDownload(userPlan) ? (
            <a href={tabOpenUrl || audioUrl} download target="_blank" rel="noreferrer" style={s.actionBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v13M6 11l6 6 6-6"/><path d="M3 20h18"/>
              </svg>
              Download
            </a>
          ) : (
            <button type="button" style={{ ...s.actionBtn, cursor: 'pointer', opacity: 0.85 }} onClick={() => onUpgrade?.()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              🔒 Download (Groove+)
            </button>
          )}
          <button style={{ ...s.actionBtn, cursor: "pointer", border: "none" }} onClick={handleShare}>
            {copied ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{ color: "#34d399" }}>Copied!</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share
              </>
            )}
          </button>
        </div>
      )}

      {onDone && audioUrl && (
        <button
          type="button"
          className="mp-done-btn"
          style={{
            ...s.doneBtn,
            marginTop: audioLoading || audioError ? 8 : 4,
            opacity: audioLoading ? 0.95 : 1,
          }}
          onClick={onDone}
        >
          Done — post-study survey →
        </button>
      )}

      {/* Lyrics */}
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
                  marginBottom: line.trim() === "" ? "14px" : "2px",
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

const s = {
  card: {
    background: "linear-gradient(145deg,#140d38,#2a1860 45%,#1a1040)",
    borderRadius: 28, padding: "32px 28px",
    // ── WIDER: was 420, now 480 ──
    maxWidth: 480,
    margin: "0 auto", boxShadow: "0 20px 60px rgba(92,63,199,.45)",
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 20, color: "#fff", fontFamily: "'DM Sans','Segoe UI',sans-serif",
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
    width: "100%", background: "rgba(255,255,255,.06)", borderRadius: 12, padding: "12px 16px",
  },
  lyricsPreviewLabel: { margin: "0 0 6px", fontSize: 11, color: "#a855f7", fontWeight: 600 },
  lyricsPreviewText: {
    margin: 0, fontSize: 13, color: "rgba(255,255,255,.7)",
    lineHeight: 1.7, whiteSpace: "pre-line", fontStyle: "italic",
  },
  // ── Header with album art circle ──
  header: { display: "flex", alignItems: "center", gap: 14, width: "100%" },
  albumArt: {
    width: 56, height: 56, borderRadius: 14, flexShrink: 0,
    background: "linear-gradient(135deg,#3b1f80,#6d28d9)",
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden",
    boxShadow: "0 4px 16px rgba(109,40,217,.4)",
  },
  albumPulse: {
    position: "absolute", inset: 0, borderRadius: 14,
    background: "rgba(168,85,247,.25)",
    animation: "albumGlow 1.8s ease-in-out infinite",
  },
  title: {
    margin: 0, fontSize: 19, fontWeight: 700, lineHeight: 1.25,
    // Allow 2 lines instead of clipping with ellipsis on one
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  subtitle: { margin: "5px 0 0", fontSize: 12, color: "rgba(255,255,255,.5)", lineHeight: 1.4 },
  savedBadge: {
    fontSize: 11, color: "#34d399", fontWeight: 700,
    background: "rgba(52,211,153,.12)", border: "1px solid rgba(52,211,153,.3)",
    borderRadius: 20, padding: "4px 10px", flexShrink: 0,
  },
  // ── Waveform ──
  waveformWrap: {
    width: "100%", cursor: "pointer", position: "relative",
    height: 58, display: "flex", alignItems: "center",
    userSelect: "none",
  },
  barsWrap: {
    display: "flex", alignItems: "center", gap: 2.5,
    width: "100%", height: 54,
  },
  bar: {
    flex: 1, borderRadius: 3, transformOrigin: "center",
    transition: "background .15s, transform .15s",
    minWidth: 2,
  },
  progressBg: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 2, background: "rgba(255,255,255,.1)", borderRadius: 1, overflow: "hidden",
  },
  progressFill: {
    height: "100%", background: "linear-gradient(90deg,#7c5ce7,#c084fc)",
    borderRadius: 1, transition: "width .1s linear",
  },
  timeRow:  { display: "flex", justifyContent: "space-between", width: "100%", marginTop: -10 },
  timeText: { fontSize: 11, color: "rgba(255,255,255,.38)", fontVariantNumeric: "tabular-nums" },
  playBtn: {
    width: 72, height: 72, borderRadius: "50%", border: "none",
    background: "linear-gradient(135deg,#7c5ce7,#a855f7)",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 8px 28px rgba(124,92,231,.55)", transition: "transform .15s, box-shadow .15s",
  },
  spinner: {
    width: 24, height: 24, border: "3px solid rgba(255,255,255,.15)",
    borderTop: "3px solid #a855f7", borderRadius: "50%",
    animation: "spin .9s linear infinite",
  },
  errorText: { fontSize: 13, color: "#f87171", margin: 0, textAlign: "center" },
  openLink:  { fontSize: 12, color: "#a855f7", textDecoration: "underline" },
  // ── NEW: action row for download + share ──
  actionRow: {
    display: "flex", gap: 10, width: "100%",
  },
  actionBtn: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    gap: 7, padding: "10px 0",
    fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.8)",
    background: "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.13)",
    borderRadius: 14, textDecoration: "none",
    transition: "background .2s, transform .12s",
  },
  doneBtn: {
    width: "100%",
    marginTop: 4,
    padding: "14px 0",
    border: "none",
    borderRadius: 14,
    background: "linear-gradient(135deg,#7c5ce7,#a855f7)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 6px 24px rgba(124,92,231,.45)",
    transition: "opacity .2s, transform .12s",
  },
  lyricsSection: { width: "100%", display: "flex", flexDirection: "column", gap: 8 },
  lyricsToggle: {
    background: "rgba(168,85,247,.12)", border: "1px solid rgba(168,85,247,.28)",
    borderRadius: 20, padding: "8px 18px", color: "#c084fc",
    fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "center",
    transition: "background .2s",
  },
  lyricsBox: {
    background: "rgba(255,255,255,.04)", borderRadius: 16,
    padding: "18px 20px", width: "100%", boxSizing: "border-box",
    // ── TALLER scroll area ──
    maxHeight: 300, overflowY: "auto",
    border: "1px solid rgba(255,255,255,.06)",
  },
  lyricLine: {
    margin: 0, fontSize: 14, color: "rgba(255,255,255,.82)",
    lineHeight: 1.85, whiteSpace: "pre-wrap",
  },
};

const keyframes = `
  @keyframes barPulse {
    from { transform: scaleY(0.45); }
    to   { transform: scaleY(1.55); }
  }
  @keyframes orbPulse {
    0%,100% { box-shadow: 0 0 40px rgba(168,85,247,.6); }
    50%      { box-shadow: 0 0 90px rgba(168,85,247,1); }
  }
  @keyframes dotBounce {
    from { transform: translateY(0); opacity: .4; }
    to   { transform: translateY(-8px); opacity: 1; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes albumGlow {
    0%,100% { opacity: .3; }
    50%      { opacity: .7; }
  }
  @media (max-width: 520px) {
    .mp-card {
      max-width: 100% !important;
      padding: 24px 16px !important;
      border-radius: 22px !important;
      gap: 16px !important;
    }
    .mp-action-row {
      flex-direction: column !important;
    }
  }
`;