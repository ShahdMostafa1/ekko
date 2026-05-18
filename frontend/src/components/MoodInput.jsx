import { useState, useRef, useEffect } from "react";

// ── Emotion → mood card mapping ───────────────────────────────────────────
const EMOTION_CARDS = {
  joy: {
    label: "Joyful & bright",
    tags: ["Happy", "Light", "Free"],
    color: "#f5c842",
    emoji: "☀️",
  },
  sadness: {
    label: "Melancholic & introspective",
    tags: ["Sad", "Reflective", "Tender"],
    color: "#6e8efb",
    emoji: "🌧️",
  },
  anger: {
    label: "Intense & charged",
    tags: ["Fierce", "Driven", "Raw"],
    color: "#f56342",
    emoji: "🔥",
  },
  fear: {
    label: "Anxious & unsettled",
    tags: ["Restless", "Tense", "Searching"],
    color: "#9b59b6",
    emoji: "🌀",
  },
  surprise: {
    label: "Surprised & alert",
    tags: ["Alert", "Open", "Vivid"],
    color: "#2ecc71",
    emoji: "⚡",
  },
  neutral: {
    label: "Calm & centred",
    tags: ["Still", "Clear", "Balanced"],
    color: "#95a5a6",
    emoji: "🌿",
  },
  disgust: {
    label: "Unsettled & resistant",
    tags: ["Uneasy", "Tense", "Heavy"],
    color: "#27ae60",
    emoji: "🌫️",
  },
};

// ── Text keyword fallback ─────────────────────────────────────────────────
const TEXT_KEYWORDS = {
  joy:     ["happy", "great", "amazing", "love", "excited", "joyful", "wonderful", "fantastic", "awesome"],
  sadness: ["sad", "cry", "miss", "lonely", "depressed", "unhappy", "down", "blue", "heartbroken"],
  anger:   ["angry", "mad", "furious", "hate", "annoyed", "frustrated", "rage", "irritated"],
  fear:    ["scared", "anxious", "worried", "nervous", "afraid", "panic", "stress", "dread"],
  surprise:["surprised", "shocked", "wow", "unexpected", "amazed", "astonished"],
  disgust: ["disgusted", "gross", "awful", "terrible", "horrible", "repulsed"],
  neutral: ["okay", "fine", "alright", "meh", "so-so", "normal", "average"],
};

function detectEmotionFromText(text) {
  const lower = text.toLowerCase();
  let best = "neutral";
  let bestCount = 0;
  for (const [emotion, keywords] of Object.entries(TEXT_KEYWORDS)) {
    const count = keywords.filter((kw) => lower.includes(kw)).length;
    if (count > bestCount) { bestCount = count; best = emotion; }
  }
  return best;
}

// ── Quiz questions ────────────────────────────────────────────────────────
const QUIZ_QUESTIONS = [
  {
    question: "How does your body feel right now?",
    options: [
      { label: "Light & energised", emotion: "joy" },
      { label: "Heavy & tired",     emotion: "sadness" },
      { label: "Tense & restless",  emotion: "anger" },
      { label: "Calm & settled",    emotion: "neutral" },
    ],
  },
  {
    question: "If your mood were weather, it'd be…",
    options: [
      { label: "Sunny ☀️",    emotion: "joy" },
      { label: "Rainy 🌧️",   emotion: "sadness" },
      { label: "Stormy ⛈️",  emotion: "anger" },
      { label: "Overcast 🌥️",emotion: "neutral" },
    ],
  },
  {
    question: "What's pulling at you most right now?",
    options: [
      { label: "Something exciting",       emotion: "surprise" },
      { label: "Something worrying",       emotion: "fear" },
      { label: "Something that bothers me",emotion: "disgust" },
      { label: "Nothing in particular",    emotion: "neutral" },
    ],
  },
];

// ── Language flag helper ──────────────────────────────────────────────────
const LANG_FLAGS = {
  ar: "🇸🇦", en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸",
  de: "🇩🇪", hi: "🇮🇳", tr: "🇹🇷", pt: "🇵🇹",
  zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", ru: "🇷🇺",
  it: "🇮🇹", nl: "🇳🇱", pl: "🇵🇱", uk: "🇺🇦",
};

// ── Main Component ────────────────────────────────────────────────────────
export default function MoodInput({ userId = "", region = null, onMoodDetected, onSubmit }) {
  const [tab, setTab] = useState("voice");

  // Voice state
  const [recording, setRecording]     = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("idle");
  const [transcript, setTranscript]   = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const [detectedMood, setDetectedMood] = useState(null);
  const [textAnalysing, setTextAnalysing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const mimeTypeRef      = useRef("audio/webm");

  // Text state
  const [textInput, setTextInput] = useState("");
  const [textMood, setTextMood]   = useState(null);

  // Quiz state
  const [quizStep, setQuizStep]       = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizMood, setQuizMood]       = useState(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // ── Voice: toggle record ────────────────────────────────────────────────
  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick best supported mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      mimeTypeRef.current = mimeType || "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setVoiceStatus("analysing");
        setDetectedMood(null);
        setTranscript("");
        setDetectedLang("");

        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        await analyzeVoice(blob, mimeTypeRef.current);
      };

      mediaRecorder.start();
      setRecording(true);
      setVoiceStatus("recording");
      setDetectedMood(null);
      setTranscript("");
      setDetectedLang("");

    } catch (err) {
      console.error("Mic error:", err);
      setVoiceStatus("error");
    }
  };

  // ── Voice: send to backend ──────────────────────────────────────────────
  const analyzeVoice = async (audioBlob, mimeType = "audio/webm") => {
    try {
      const ext = mimeType.includes("mp4") ? "mp4"
                : mimeType.includes("ogg") ? "ogg"
                : "webm";

      const formData = new FormData();
      formData.append("audio",   audioBlob, `mood.${ext}`);
      formData.append("user_id", userId || "");
      formData.append("region",  region?.id || "");

      const res = await fetch("http://localhost:8000/mood/detect", {
        method: "POST",
        body:   formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const card = EMOTION_CARDS[data.top_emotion] || {
        label: data.top_emotion,
        tags:  [],
        color: "#b09ee0",
        emoji: "💭",
      };

      const mood = {
        ...card,
        valence:    data.valence,
        energy:     data.arousal,
        confidence: data.confidence,
        emotion:    data.top_emotion,
        reasoning:  data.reasoning,   
        text:       data.transcript,
      }

      setDetectedMood(mood);
      setTranscript(data.transcript);
      setDetectedLang(data.language || "");
      setVoiceStatus("done");
      onMoodDetected?.(mood);

    } catch (err) {
      console.error("Voice analysis failed:", err);
      setVoiceStatus("error");
    }
  };

  // ── Text: analyse via real AI ───────────────────────────────────────────
  const analyzeText = async () => {
    if (!textInput.trim()) return;
    setTextMood(null);
    setTextAnalysing(true);

    try {
      const res = await fetch("http://localhost:8000/mood/detect-text", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          text:    textInput,
          user_id: userId || "",
          region:  region?.id || "",
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const card = EMOTION_CARDS[data.top_emotion] || {
        label: data.top_emotion,
        tags:  [],
        color: "#b09ee0",
        emoji: "💭",
      };

      const mood = {
        ...card,
        valence:    data.valence,
        energy:     data.arousal || 0.5,
        confidence: data.confidence,
        emotion:    data.top_emotion,
        text:       textInput,
      };

      setTextMood(mood);
      onMoodDetected?.(mood);

    } catch (err) {
      console.error("Text analysis failed, using fallback:", err);
      // Fallback to client-side keyword matching
      const emotion = detectEmotionFromText(textInput);
      const card    = EMOTION_CARDS[emotion];
      const mood    = { ...card, emotion, valence: 0.5, energy: 0.5, text: textInput };
      setTextMood(mood);
      onMoodDetected?.(mood);
    } finally {
      setTextAnalysing(false);
    }
  };

  // ── Quiz: answer ────────────────────────────────────────────────────────
  const answerQuiz = (emotion) => {
    const answers = [...quizAnswers, emotion];
    setQuizAnswers(answers);
    if (quizStep + 1 < QUIZ_QUESTIONS.length) {
      setQuizStep(quizStep + 1);
    } else {
      const counts = answers.reduce((acc, e) => {
        acc[e] = (acc[e] || 0) + 1;
        return acc;
      }, {});
      const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      const card   = EMOTION_CARDS[winner];
      const mood   = { ...card, emotion: winner, valence: 0.5, energy: 0.5, text: winner };
      setQuizMood(mood);
      onMoodDetected?.(mood);
    }
  };

  const resetQuiz = () => {
    setQuizStep(0);
    setQuizAnswers([]);
    setQuizMood(null);
  };

  // ── Continue to co-creation ─────────────────────────────────────────────
  const handleContinue = (mood) => {
    onSubmit?.({
      label:   mood.label,
      tags:    mood.tags,
      valence: mood.valence,
      energy:  mood.energy,
      emotion: mood.emotion,
      text:    mood.text || mood.label,
    });
  };

  // ── Mood result card ────────────────────────────────────────────────────
  const MoodCard = ({ mood, showValence = false }) => (
  <div className="mood-result-card" style={{ "--accent": mood.color }}>
    <div className="mood-emoji">{mood.emoji}</div>
    <h3 className="mood-label">{mood.label}</h3>
    <div className="mood-tags">
      {mood.tags.map((t) => (
        <span key={t} className="mood-tag">{t}</span>
      ))}
    </div>
    {mood.reasoning && (
      <p className="mood-reasoning">
        💭 {mood.reasoning}
      </p>
    )}
    {showValence && mood.valence !== undefined && (
      <div className="mood-meters">
        <div className="meter-row">
          <span className="meter-lbl">Valence</span>
          <div className="meter-bar">
            <div className="meter-fill" style={{ width: `${mood.valence * 100}%`, background: mood.color }} />
          </div>
          <span className="meter-val">{Math.round(mood.valence * 100)}%</span>
        </div>
        <div className="meter-row">
          <span className="meter-lbl">Energy</span>
          <div className="meter-bar">
            <div className="meter-fill" style={{ width: `${(mood.energy || 0) * 100}%`, background: mood.color }} />
          </div>
          <span className="meter-val">{Math.round((mood.energy || 0) * 100)}%</span>
        </div>
      </div>
    )}
  </div>
);

  // ── Voice status label ──────────────────────────────────────────────────
  const voiceLabel = () => {
    if (recording)                  return "Listening… tap when you're done speaking";
    if (voiceStatus === "analysing") return "Analysing your voice…";
    if (voiceStatus === "done")      return "Tap to speak again";
    if (voiceStatus === "error")     return "Could not detect — try again";
    return "Tap to speak — any language";
  };

  return (
    <div className="mi-root">
      {/* ── Tab bar ── */}
      <div className="mi-tabs">
        {["voice", "text", "quiz"].map((t) => (
          <button
            key={t}
            className={`mi-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "voice" ? "🎙 Voice" : t === "text" ? "✍️ Text" : "🎯 Quiz"}
          </button>
        ))}
      </div>

      {/* ══ VOICE TAB ══ */}
      {tab === "voice" && (
        <div className="mi-panel">
          <div className="voice-wrap">
            <button
              className={`mic-ring ${recording ? "rec" : ""} ${voiceStatus === "analysing" ? "spin" : ""}`}
              onClick={toggleRecord}
              disabled={voiceStatus === "analysing"}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              <span className="mic-ico">
                {voiceStatus === "analysing" ? "⏳" : recording ? "⏹" : "🎙"}
              </span>
              {recording && <span className="mic-pulse" />}
            </button>

            <p className="voice-lbl">{voiceLabel()}</p>

            {/* Detected language badge */}
            {detectedLang && voiceStatus === "done" && (
              <p className="lang-badge">
                {LANG_FLAGS[detectedLang] || "🌐"} Detected: {detectedLang.toUpperCase()}
              </p>
            )}

            {/* Transcript */}
            {transcript && (
              <p className="voice-transcript">"{transcript}"</p>
            )}

            {/* Waveform */}
            {recording && (
              <div className="waveform" aria-hidden="true">
                {[10, 18, 22, 28, 22, 18, 10, 14, 24, 14].map((h, i) => (
                  <span key={i} className="wbar"
                    style={{ "--h": `${h}px`, animationDelay: `${i * 0.07}s` }} />
                ))}
              </div>
            )}

            {/* Analysing dots */}
            {voiceStatus === "analysing" && (
              <div className="analysing-dots" aria-label="Analysing">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="dot" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            )}

            {/* Error */}
            {voiceStatus === "error" && (
              <p className="voice-error">
                ⚠️ Make sure your mic is allowed and the backend is running on port 8000.
              </p>
            )}
          </div>

          {/* Result card + continue */}
          {detectedMood && voiceStatus === "done" && (
            <div className="result-area">
              <MoodCard mood={detectedMood} showValence />
              {detectedMood.confidence !== undefined && (
                <p className="confidence-note">
                  Confidence: {Math.round(detectedMood.confidence * 100)}%
                </p>
              )}
              <button className="continue-btn" onClick={() => handleContinue(detectedMood)}>
                Create my music →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ TEXT TAB ══ */}
      {tab === "text" && (
        <div className="mi-panel">
          <div className="text-wrap">
            <p className="text-prompt">
              How are you feeling? Write in any language.
            </p>
            <textarea
              className="text-area"
              rows={4}
              placeholder="I feel… / أنا أشعر… / Je me sens…"
              value={textInput}
              onChange={(e) => { setTextInput(e.target.value); setTextMood(null); }}
            />
            <button
              className="analyse-btn"
              onClick={analyzeText}
              disabled={!textInput.trim() || textAnalysing}
            >
              {textAnalysing ? "Analysing…" : "Analyse my mood"}
            </button>
          </div>

          {textMood && (
            <div className="result-area">
              <MoodCard mood={textMood} showValence />
              {textMood.confidence !== undefined && (
                <p className="confidence-note">
                  Confidence: {Math.round(textMood.confidence * 100)}%
                </p>
              )}
              <button className="continue-btn" onClick={() => handleContinue(textMood)}>
                Create my music →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ QUIZ TAB ══ */}
      {tab === "quiz" && (
        <div className="mi-panel">
          {!quizMood ? (
            <div className="quiz-wrap">
              <div className="quiz-progress">
                {QUIZ_QUESTIONS.map((_, i) => (
                  <div key={i}
                    className={`quiz-pip ${i < quizStep ? "done" : i === quizStep ? "active" : ""}`} />
                ))}
              </div>
              <p className="quiz-q">{QUIZ_QUESTIONS[quizStep].question}</p>
              <div className="quiz-options">
                {QUIZ_QUESTIONS[quizStep].options.map((opt) => (
                  <button key={opt.label} className="quiz-opt"
                    onClick={() => answerQuiz(opt.emotion)}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="quiz-counter">{quizStep + 1} / {QUIZ_QUESTIONS.length}</p>
            </div>
          ) : (
            <div className="result-area">
              <MoodCard mood={quizMood} />
              <button className="reset-btn" onClick={resetQuiz}>Retake quiz</button>
              <button className="continue-btn" onClick={() => handleContinue(quizMood)}>
                Create my music →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Styles ── */}
      <style>{`
        .mi-root {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 360px;
          margin: 0 auto;
          background: #faf8ff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(120,90,200,.13);
        }
        .mi-tabs {
          display: flex;
          background: #f0ecff;
          padding: 6px;
          gap: 4px;
          border-bottom: 1px solid #e4dff5;
        }
        .mi-tab {
          flex: 1;
          padding: 9px 4px;
          border: none;
          border-radius: 12px;
          background: transparent;
          font-size: 13px;
          font-weight: 600;
          color: #8b7eb8;
          cursor: pointer;
          transition: background .18s, color .18s;
        }
        .mi-tab.active {
          background: #fff;
          color: #5c3fc7;
          box-shadow: 0 2px 8px rgba(92,63,199,.12);
        }
        .mi-panel {
          padding: 24px 20px;
          min-height: 320px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .voice-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          width: 100%;
        }
        .mic-ring {
          position: relative;
          width: 88px;
          height: 88px;
          border-radius: 50%;
          border: 3px solid #c4b5f0;
          background: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color .2s, box-shadow .2s, transform .15s;
          box-shadow: 0 4px 16px rgba(120,90,200,.15);
        }
        .mic-ring:hover:not(:disabled) {
          border-color: #7c5ce7;
          box-shadow: 0 6px 24px rgba(120,90,200,.25);
          transform: scale(1.04);
        }
        .mic-ring.rec {
          border-color: #e74c3c;
          box-shadow: 0 0 0 6px rgba(231,76,60,.12);
          animation: recPulse 1.4s ease-in-out infinite;
        }
        .mic-ring.spin .mic-ico { animation: spin 1.2s linear infinite; }
        .mic-ring:disabled { cursor: default; opacity: .7; }
        .mic-ico { font-size: 32px; line-height: 1; display: block; }
        .mic-pulse {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          border: 2px solid rgba(231,76,60,.35);
          animation: pulsRing 1.4s ease-out infinite;
          pointer-events: none;
        }
        @keyframes recPulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(231,76,60,.12); }
          50%       { box-shadow: 0 0 0 10px rgba(231,76,60,.2); }
        }
        @keyframes pulsRing {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .voice-lbl {
          font-size: 14px;
          color: #7b6fa8;
          text-align: center;
          margin: 0;
          font-weight: 500;
        }
        .lang-badge {
          font-size: 12px;
          color: #7c5ce7;
          font-weight: 600;
          margin: 0;
          background: rgba(124,92,231,.08);
          padding: 4px 12px;
          border-radius: 20px;
        }
        .voice-transcript {
          font-size: 12px;
          color: #5c5575;
          font-style: italic;
          margin: 0;
          padding: 8px 14px;
          background: rgba(176,158,224,.08);
          border-radius: 10px;
          max-width: 280px;
          text-align: center;
          line-height: 1.6;
          border: 1px solid rgba(176,158,224,.2);
        }
        .voice-error {
          font-size: 12px;
          color: #e74c3c;
          text-align: center;
          max-width: 260px;
          margin: 0;
          line-height: 1.5;
        }
        .waveform {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 36px;
        }
        .wbar {
          display: block;
          width: 3px;
          height: var(--h, 10px);
          border-radius: 2px;
          background: #7c5ce7;
          animation: wave .8s ease-in-out infinite alternate;
        }
        @keyframes wave {
          from { transform: scaleY(.4); opacity: .6; }
          to   { transform: scaleY(1.4); opacity: 1; }
        }
        .analysing-dots { display: flex; gap: 6px; align-items: center; }
        .dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #7c5ce7;
          animation: dotBounce .8s ease-in-out infinite alternate;
        }
        @keyframes dotBounce {
          from { transform: translateY(0); opacity: .5; }
          to   { transform: translateY(-6px); opacity: 1; }
        }
        .text-wrap { width: 100%; display: flex; flex-direction: column; gap: 12px; }
        .text-prompt { font-size: 14px; color: #7b6fa8; margin: 0; font-weight: 500; }
        .text-area {
          width: 100%;
          box-sizing: border-box;
          border: 1.5px solid #d4caf0;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
          font-family: inherit;
          color: #3d2e6b;
          background: #fff;
          resize: none;
          transition: border-color .2s;
          outline: none;
          line-height: 1.6;
        }
        .text-area:focus {
          border-color: #7c5ce7;
          box-shadow: 0 0 0 3px rgba(124,92,231,.1);
        }
        .analyse-btn {
          align-self: flex-end;
          padding: 10px 20px;
          border: none;
          border-radius: 12px;
          background: #7c5ce7;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background .18s, transform .12s;
        }
        .analyse-btn:hover:not(:disabled) { background: #6347cc; transform: translateY(-1px); }
        .analyse-btn:disabled { opacity: .45; cursor: default; }
        .quiz-wrap {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
        }
        .quiz-progress { display: flex; gap: 6px; }
        .quiz-pip {
          width: 28px; height: 5px;
          border-radius: 3px;
          background: #e0d8f5;
          transition: background .25s;
        }
        .quiz-pip.active { background: #7c5ce7; }
        .quiz-pip.done   { background: #b09ee0; }
        .quiz-q {
          font-size: 16px;
          font-weight: 600;
          color: #3d2e6b;
          text-align: center;
          margin: 0;
          line-height: 1.5;
        }
        .quiz-options { width: 100%; display: flex; flex-direction: column; gap: 8px; }
        .quiz-opt {
          width: 100%;
          padding: 13px 16px;
          border: 1.5px solid #d4caf0;
          border-radius: 12px;
          background: #fff;
          font-size: 14px;
          font-weight: 500;
          color: #3d2e6b;
          cursor: pointer;
          text-align: left;
          transition: border-color .18s, background .18s, transform .12s;
        }
        .quiz-opt:hover {
          border-color: #7c5ce7;
          background: #f5f1ff;
          transform: translateX(3px);
        }
        .quiz-counter { font-size: 12px; color: #b09ee0; margin: 0; }
        .reset-btn {
          margin-top: 8px;
          padding: 9px 20px;
          border: 1.5px solid #c4b5f0;
          border-radius: 12px;
          background: transparent;
          color: #7c5ce7;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background .18s;
        }
        .reset-btn:hover { background: #f0ecff; }
        .result-area {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          animation: fadeUp .35s ease;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mood-result-card {
          width: 100%;
          box-sizing: border-box;
          background: linear-gradient(135deg, #fff 60%, color-mix(in srgb, var(--accent) 10%, #fff));
          border: 2px solid var(--accent);
          border-radius: 16px;
          padding: 20px 16px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0,0,0,.07);
        }
        .mood-emoji { font-size: 36px; margin-bottom: 8px; line-height: 1; }
        .mood-label { font-size: 16px; font-weight: 700; color: #3d2e6b; margin: 0 0 10px; }
        .mood-tags {
          display: flex;
          justify-content: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .mood-tag {
          padding: 4px 11px;
          border-radius: 20px;
          background: color-mix(in srgb, var(--accent) 15%, #fff);
          color: color-mix(in srgb, var(--accent) 80%, #000);
          font-size: 12px;
          font-weight: 600;
        }
        .mood-meters { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
        .meter-row { display: flex; align-items: center; gap: 8px; }
        .meter-lbl {
          font-size: 11px; font-weight: 600;
          color: #8b7eb8; width: 52px; text-align: right;
        }
        .meter-bar {
          flex: 1; height: 6px;
          background: #ede9f8;
          border-radius: 3px;
          overflow: hidden;
        }
        .meter-fill { height: 100%; border-radius: 3px; transition: width .6s ease; }
        .meter-val { font-size: 11px; font-weight: 600; color: #8b7eb8; width: 30px; }
        .confidence-note { font-size: 11px; color: #b09ee0; margin: 0; }
        .continue-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #7c5ce7, #a855f7);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: transform .15s, box-shadow .15s;
          box-shadow: 0 4px 16px rgba(124,92,231,.35);
          margin-top: 4px;
        }
        .continue-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(124,92,231,.45);
        }
      `}</style>
    </div>
  );
}