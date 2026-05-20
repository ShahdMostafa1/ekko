import { useState, useRef, useEffect } from "react";

// ── Expanded Emotion → mood card mapping (7 core + 13 nuanced = 20 total) ─────
const EMOTION_CARDS = {
  joy: {
    label: "Joyful & bright",
    labelAr: "مبسوط ومشرق",
    tags: ["Happy", "Light", "Free"],
    tagsAr: ["سعيد", "خفيف", "حر"],
    color: "#f5c842",
    emoji: "☀️",
  },
  sadness: {
    label: "Melancholic & introspective",
    labelAr: "حزين ومتأمل",
    tags: ["Sad", "Reflective", "Tender"],
    tagsAr: ["حزين", "متأمل", "حساس"],
    color: "#6e8efb",
    emoji: "🌧️",
  },
  anger: {
    label: "Intense & charged",
    labelAr: "غاضب ومشحون",
    tags: ["Fierce", "Driven", "Raw"],
    tagsAr: ["حاد", "مندفع", "خام"],
    color: "#f56342",
    emoji: "🔥",
  },
  fear: {
    label: "Anxious & unsettled",
    labelAr: "قلقان ومضطرب",
    tags: ["Restless", "Tense", "Searching"],
    tagsAr: ["مضطرب", "متوتر", "ضائع"],
    color: "#9b59b6",
    emoji: "🌀",
  },
  surprise: {
    label: "Surprised & alert",
    labelAr: "متفاجئ ومنتبه",
    tags: ["Alert", "Open", "Vivid"],
    tagsAr: ["منتبه", "منفتح", "حي"],
    color: "#2ecc71",
    emoji: "⚡",
  },
  neutral: {
    label: "Calm & centred",
    labelAr: "هادي ومتوازن",
    tags: ["Still", "Clear", "Balanced"],
    tagsAr: ["هادئ", "واضح", "متوازن"],
    color: "#95a5a6",
    emoji: "🌿",
  },
  disgust: {
    label: "Unsettled & resistant",
    labelAr: "منزعج ورافض",
    tags: ["Uneasy", "Tense", "Heavy"],
    tagsAr: ["متضايق", "متوتر", "ثقيل"],
    color: "#27ae60",
    emoji: "🌫️",
  },
  nostalgia: {
    label: "Nostalgic & longing",
    labelAr: "حنين وشوق",
    tags: ["Wistful", "Tender", "Distant"],
    tagsAr: ["مشتاق", "حنين", "بعيد"],
    color: "#e8a87c",
    emoji: "🌅",
  },
  grief: {
    label: "Grieving & heavy",
    labelAr: "حزن عميق وثقيل",
    tags: ["Lost", "Heavy", "Hollow"],
    tagsAr: ["ضائع", "ثقيل", "فارغ"],
    color: "#4a6fa5",
    emoji: "🌑",
  },
  exhaustion: {
    label: "Drained & worn out",
    labelAr: "تعبان وخلصت طاقتي",
    tags: ["Tired", "Empty", "Numb"],
    tagsAr: ["تعبان", "فارغ", "خدِر"],
    color: "#8e9eab",
    emoji: "🍂",
  },
  euphoria: {
    label: "Euphoric & electric",
    labelAr: "في قمة السعادة",
    tags: ["Radiant", "Alive", "Free"],
    tagsAr: ["مشع", "حي", "طاير"],
    color: "#ffd700",
    emoji: "✨",
  },
  tenderness: {
    label: "Tender & warm",
    labelAr: "حنان ودفء",
    tags: ["Warm", "Soft", "Loving"],
    tagsAr: ["دافئ", "ناعم", "محب"],
    color: "#ff8fab",
    emoji: "🌸",
  },
  frustration: {
    label: "Frustrated & stuck",
    labelAr: "محبط وواقف في مكاني",
    tags: ["Blocked", "Tense", "Restless"],
    tagsAr: ["مسدود", "متوتر", "مش قادر"],
    color: "#e67e22",
    emoji: "⛓️",
  },
  loneliness: {
    label: "Lonely & isolated",
    labelAr: "وحيد ومعزول",
    tags: ["Alone", "Distant", "Longing"],
    tagsAr: ["لوحدي", "بعيد", "مشتاق"],
    color: "#7f8c8d",
    emoji: "🌙",
  },
  wonder: {
    label: "In awe & wonder",
    labelAr: "مبهور ومندهش",
    tags: ["Open", "Curious", "Expanded"],
    tagsAr: ["منبهر", "فضولي", "منفتح"],
    color: "#1abc9c",
    emoji: "🔭",
  },
  hope: {
    label: "Hopeful & rising",
    labelAr: "متفائل وعايز أكمل",
    tags: ["Forward", "Light", "Possible"],
    tagsAr: ["للأمام", "نور", "ممكن"],
    color: "#f9ca24",
    emoji: "🌱",
  },
  fedup: {
    label: "Fed up & done",
    labelAr: "زهقت وما عادش قادر",
    tags: ["Done", "Over it", "Hollow"],
    tagsAr: ["زهقت", "خلص", "ما عادش"],
    color: "#b8860b",
    emoji: "🚪",
  },
  passion: {
    label: "Passionate & driven",
    labelAr: "متحمس وعنده هدف",
    tags: ["Fired up", "Focused", "Burning"],
    tagsAr: ["مشتعل", "مركز", "مصمم"],
    color: "#c0392b",
    emoji: "🎯",
  },
  bittersweet: {
    label: "Bittersweet & mixed",
    labelAr: "حلو ومر في نفس الوقت",
    tags: ["Mixed", "Poignant", "Complex"],
    tagsAr: ["مختلط", "مؤلم", "معقد"],
    color: "#9b6b9b",
    emoji: "🌗",
  },
  calm: {
    label: "Peaceful & still",
    labelAr: "مرتاح وفي سلام",
    tags: ["Peaceful", "Grounded", "Present"],
    tagsAr: ["مرتاح", "ثابت", "حاضر"],
    color: "#48c9b0",
    emoji: "🏔️",
  },
};

// ── Nuanced emotion resolver ──────────────────────────────────────────────────
function resolveNuancedEmotion(topEmotion, valence, arousal) {
  if (topEmotion === "joy") {
    if (valence > 0.85 && arousal > 0.7)  return "euphoria";
    if (valence > 0.7  && arousal < 0.4)  return "calm";
    if (arousal > 0.6)                    return "passion";
    return "joy";
  }
  if (topEmotion === "sadness") {
    if (arousal < 0.25)                   return "grief";
    if (valence < 0.3 && arousal < 0.35)  return "exhaustion";
    if (valence > 0.35 && arousal < 0.4)  return "nostalgia";
    if (arousal < 0.4)                    return "loneliness";
    return "sadness";
  }
  if (topEmotion === "anger") {
    if (arousal < 0.45)                   return "frustration";
    if (valence < 0.25 && arousal > 0.7)  return "anger";
    return "frustration";
  }
  if (topEmotion === "disgust") {
    if (arousal < 0.35)                   return "fedup";
    return "disgust";
  }
  if (topEmotion === "fear") {
    if (valence > 0.4)                    return "wonder";
    return "fear";
  }
  if (topEmotion === "surprise") {
    if (valence > 0.6)                    return "wonder";
    if (valence < 0.4)                    return "fear";
    return "surprise";
  }
  if (topEmotion === "neutral") {
    if (valence > 0.55 && arousal < 0.4)  return "calm";
    if (valence < 0.4  && arousal < 0.35) return "exhaustion";
    if (valence > 0.5  && arousal > 0.5)  return "hope";
    return "neutral";
  }
  return topEmotion;
}

// ── Text keyword fallback (English + Arabic) ──────────────────────────────────
const TEXT_KEYWORDS = {
  joy:      [
    "happy", "great", "amazing", "love", "excited", "joyful", "wonderful", "fantastic", "awesome", "elated",
    "مبسوط", "مبسوطة", "سعيد", "سعيدة", "فرحان", "فرحانة", "تمام", "عظيم", "رائع",
  ],
  sadness:  [
    "sad", "cry", "miss", "lonely", "depressed", "unhappy", "down", "blue", "heartbroken", "grief", "weeping",
    "حزين", "حزينة", "زعلان", "زعلانة", "بكي", "وحيد", "وحيدة", "مش كويس", "مش تمام", "حسرة", "فارق",
    "تعبان", "تعبانة", "تعبت", "مكتئب", "مكتئبة",
  ],
  anger:    [
    "angry", "mad", "furious", "hate", "annoyed", "frustrated", "rage", "irritated", "outraged",
    "غاضب", "غاضبة", "زعلان", "غيظ", "غضبان", "بغيظ", "اتنرفزت", "نرفزة", "معصب", "معصبة",
  ],
  fear:     [
    "scared", "anxious", "worried", "nervous", "afraid", "panic", "stress", "dread", "terrified",
    "خايف", "خايفة", "قلقان", "قلقانة", "متوتر", "متوترة", "مش قادر", "خوف", "هلع", "مرعوب",
  ],
  surprise: [
    "surprised", "shocked", "wow", "unexpected", "amazed", "astonished", "unbelievable",
    "مصدوم", "مصدومة", "مفاجأة", "ما توقعتش", "واو", "مبهور", "مبهورة", "دهشة",
  ],
  disgust:  [
    "disgusted", "gross", "awful", "terrible", "horrible", "repulsed", "fed up", "done",
    "زهقت", "زهقان", "زهقانة", "اشمأز", "قرف", "بقرف", "مقرف", "خلاص بقا",
  ],
  neutral:  [
    "okay", "fine", "alright", "meh", "so-so", "normal", "average", "nothing",
    "عادي", "تمام شوية", "مش عارف", "عادية", "اوكي", "ماشي",
  ],
  nostalgia: [
    "miss", "remember", "used to", "childhood", "old days", "back then",
    "حنين", "بحن", "أيام زمان", "ذكريات", "أشتاق", "فاتكر", "زمان",
  ],
  exhaustion: [
    "tired", "exhausted", "drained", "burnt out", "can't anymore", "done",
    "تعبت", "مش قادر", "مش قادرة", "خلصت", "نفسيتي تعبانة", "ما عادش", "تقيل",
  ],
  loneliness: [
    "alone", "lonely", "no one", "isolated", "left out",
    "لوحدي", "محدش", "وحيد", "وحيدة", "معزول", "معزولة", "محدش فاهمني",
  ],
  frustration: [
    "frustrated", "stuck", "blocked", "can't", "nothing works", "impossible",
    "محبط", "محبطة", "مسدود", "واقف في مكاني", "مش شايل", "مش ماشي",
  ],
};

function detectEmotionFromText(text) {
  const lower = text.toLowerCase();
  let best = "neutral";
  let bestCount = 0;
  for (const [emotion, keywords] of Object.entries(TEXT_KEYWORDS)) {
    const count = keywords.filter((kw) => lower.includes(kw)).length;
    if (count > bestCount) { bestCount = count; best = emotion; }
  }
  const NUANCED_TO_CORE = {
    nostalgia: "sadness", exhaustion: "sadness", loneliness: "sadness",
    frustration: "anger",
  };
  return NUANCED_TO_CORE[best] || best;
}

// ── Quiz questions (bilingual) ────────────────────────────────────────────────
const QUIZ_QUESTIONS = [
  {
    question:   "How does your body feel right now?",
    questionAr: "جسمك حاسس بإيه دلوقتي؟",
    options: [
      { label: "Light & energised 💃",  labelAr: "خفيف وعندي طاقة",    emotion: "joy",     valence: 0.8, arousal: 0.7 },
      { label: "Heavy & tired 😮‍💨",      labelAr: "تقيل وتعبان",        emotion: "sadness", valence: 0.2, arousal: 0.2 },
      { label: "Tense & restless 😤",   labelAr: "متوتر ومش قادر أهدى", emotion: "anger",   valence: 0.3, arousal: 0.7 },
      { label: "Calm & settled 🌿",     labelAr: "هادي ومرتاح",         emotion: "neutral", valence: 0.6, arousal: 0.3 },
    ],
  },
  {
    question:   "If your mood were weather, it'd be…",
    questionAr: "لو مزاجك كان طقس، يبقى إيه؟",
    options: [
      { label: "Sunny ☀️",      labelAr: "مشمس ودافئ",    emotion: "joy",      valence: 0.85, arousal: 0.6 },
      { label: "Rainy 🌧️",     labelAr: "ممطر ومعتم",     emotion: "sadness",  valence: 0.25, arousal: 0.35 },
      { label: "Stormy ⛈️",    labelAr: "عواصف وبرق",     emotion: "anger",    valence: 0.2,  arousal: 0.85 },
      { label: "Foggy 🌫️",     labelAr: "ضبابي ما بشوفش",  emotion: "disgust",  valence: 0.3,  arousal: 0.25 },
      { label: "Overcast 🌥️",  labelAr: "غايم بس ساكت",   emotion: "neutral",  valence: 0.5,  arousal: 0.3 },
    ],
  },
  {
    question:   "What's pulling at you most right now?",
    questionAr: "إيه اللي بيشغل دماغك أكتر دلوقتي؟",
    options: [
      { label: "Something exciting ⚡",        labelAr: "حاجة بتحمسني",        emotion: "surprise", valence: 0.75, arousal: 0.75 },
      { label: "Something worrying 😰",        labelAr: "حاجة بتقلقني",        emotion: "fear",     valence: 0.25, arousal: 0.65 },
      { label: "Old memories 🌅",              labelAr: "ذكريات قديمة",        emotion: "sadness",  valence: 0.45, arousal: 0.3 },
      { label: "Something that bothers me 😒", labelAr: "حاجة بتضايقني",       emotion: "disgust",  valence: 0.25, arousal: 0.4 },
      { label: "Nothing in particular 🌿",     labelAr: "مش عارف، مفيش حاجة", emotion: "neutral",  valence: 0.5,  arousal: 0.3 },
    ],
  },
  {
    question:   "When you think about tomorrow, you feel…",
    questionAr: "لما بتفكر في بكرة، بتحس بإيه؟",
    options: [
      { label: "Excited & ready 🚀",     labelAr: "متحمس وجاهز",         emotion: "joy",     valence: 0.85, arousal: 0.8 },
      { label: "Anxious & unsure 😟",    labelAr: "قلقان ومش عارف",      emotion: "fear",    valence: 0.25, arousal: 0.6 },
      { label: "Hopeful but tired 🌱",   labelAr: "متفائل بس تعبان",     emotion: "neutral", valence: 0.6,  arousal: 0.35 },
      { label: "Indifferent, who cares", labelAr: "مش مهم، على ما يأتي", emotion: "disgust", valence: 0.3,  arousal: 0.2 },
    ],
  },
];

// ── Language flag helper ──────────────────────────────────────────────────────
const LANG_FLAGS = {
  ar: "🇪🇬", en: "🇬🇧", fr: "🇫🇷", es: "🇪🇸",
  de: "🇩🇪", hi: "🇮🇳", tr: "🇹🇷", pt: "🇵🇹",
  zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", ru: "🇷🇺",
  it: "🇮🇹", nl: "🇳🇱", pl: "🇵🇱", uk: "🇺🇦",
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function MoodInput({ userId = "", region = null, onMoodDetected, onSubmit }) {
  const [tab, setTab]       = useState("voice");
  const [lang, setLang]     = useState("en");

  // Voice state
  const [recording, setRecording]         = useState(false);
  const [voiceStatus, setVoiceStatus]     = useState("idle");
  const [transcript, setTranscript]       = useState("");
  const [detectedLang, setDetectedLang]   = useState("");
  const [detectedMood, setDetectedMood]   = useState(null);
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

  const isAr = lang === "ar";

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // ── Voice: toggle record ──────────────────────────────────────────────────
  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      mimeTypeRef.current = mimeType || "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
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

  // ── Build mood object from backend response ───────────────────────────────
  const buildMood = (data, inputText = "") => {
    const nuanced = resolveNuancedEmotion(data.top_emotion, data.valence, data.arousal);
    const card    = EMOTION_CARDS[nuanced] || EMOTION_CARDS[data.top_emotion] || {
      label: data.top_emotion, labelAr: data.top_emotion,
      tags: [], tagsAr: [], color: "#b09ee0", emoji: "💭",
    };
    return {
      ...card,
      valence:    data.valence,
      energy:     data.arousal,
      confidence: data.confidence,
      emotion:    data.top_emotion,
      nuancedKey: nuanced,
      reasoning:  data.reasoning,
      text:       inputText || data.transcript || "",
    };
  };

  // ── Voice: send to backend ────────────────────────────────────────────────
  const analyzeVoice = async (audioBlob, mimeType = "audio/webm") => {
    try {
      const ext      = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const formData = new FormData();
      formData.append("audio",   audioBlob, `mood.${ext}`);
      formData.append("user_id", userId || "");
      formData.append("region",  region?.id || "");

      const res = await fetch(`${import.meta.env.VITE_API_URL}/mood/detect`, {
        method: "POST", body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.language === "ar") setLang("ar");

      const mood = buildMood(data, data.transcript);
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

  // ── Text: analyse via AI ──────────────────────────────────────────────────
  const analyzeText = async () => {
    if (!textInput.trim()) return;
    setTextMood(null);
    setTextAnalysing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/mood/detect-text`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: textInput, user_id: userId || "", region: region?.id || "" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mood = buildMood(data, textInput);
      setTextMood(mood);
      onMoodDetected?.(mood);
    } catch (err) {
      console.error("Text analysis failed, using fallback:", err);
      const emotion = detectEmotionFromText(textInput);
      const card    = EMOTION_CARDS[emotion];
      const mood    = { ...card, emotion, nuancedKey: emotion, valence: 0.5, energy: 0.5, text: textInput };
      setTextMood(mood);
      onMoodDetected?.(mood);
    } finally {
      setTextAnalysing(false);
    }
  };

  // ── Quiz: answer a question ───────────────────────────────────────────────
  const answerQuiz = (option) => {
    // Replace answer for current step if going back and re-answering,
    // otherwise append
    const answers = [...quizAnswers.slice(0, quizStep), option];
    setQuizAnswers(answers);

    if (quizStep + 1 < QUIZ_QUESTIONS.length) {
      setQuizStep(quizStep + 1);
    } else {
      // All questions answered — tally result
      const counts = {};
      let totalValence = 0, totalArousal = 0;
      answers.forEach(({ emotion, valence, arousal }) => {
        counts[emotion] = (counts[emotion] || 0) + 1;
        totalValence += valence;
        totalArousal += arousal;
      });
      const winner  = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      const avgV    = totalValence / answers.length;
      const avgA    = totalArousal / answers.length;
      const nuanced = resolveNuancedEmotion(winner, avgV, avgA);
      const card    = EMOTION_CARDS[nuanced] || EMOTION_CARDS[winner];
      const mood    = { ...card, emotion: winner, nuancedKey: nuanced, valence: avgV, energy: avgA, text: winner };
      setQuizMood(mood);
      onMoodDetected?.(mood);
    }
  };

  const resetQuiz = () => { setQuizStep(0); setQuizAnswers([]); setQuizMood(null); };

  // ── Continue to co-creation ───────────────────────────────────────────────
  const handleContinue = (mood) => {
    onSubmit?.({
      label:   isAr ? mood.labelAr : mood.label,
      tags:    isAr ? mood.tagsAr  : mood.tags,
      valence: mood.valence,
      energy:  mood.energy,
      emotion: mood.emotion,
      text:    mood.text || mood.label,
    });
  };

  // ── Mood result card ──────────────────────────────────────────────────────
  const MoodCard = ({ mood, showValence = false }) => (
    <div className="mood-result-card" style={{ "--accent": mood.color }} dir={isAr ? "rtl" : "ltr"}>
      <div className="mood-emoji">{mood.emoji}</div>
      <h3 className="mood-label">{isAr ? mood.labelAr : mood.label}</h3>
      <div className="mood-tags">
        {(isAr ? mood.tagsAr : mood.tags).map((t) => (
          <span key={t} className="mood-tag">{t}</span>
        ))}
      </div>
      {mood.reasoning && (
        <p className="mood-reasoning">💭 {mood.reasoning}</p>
      )}
      {showValence && mood.valence !== undefined && (
        <div className="mood-meters">
          <div className="meter-row">
            <span className="meter-lbl">{isAr ? "إيجابية" : "Valence"}</span>
            <div className="meter-bar">
              <div className="meter-fill" style={{ width: `${mood.valence * 100}%`, background: mood.color }} />
            </div>
            <span className="meter-val">{Math.round(mood.valence * 100)}%</span>
          </div>
          <div className="meter-row">
            <span className="meter-lbl">{isAr ? "طاقة" : "Energy"}</span>
            <div className="meter-bar">
              <div className="meter-fill" style={{ width: `${(mood.energy || 0) * 100}%`, background: mood.color }} />
            </div>
            <span className="meter-val">{Math.round((mood.energy || 0) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );

  const voiceLabel = () => {
    if (isAr) {
      if (recording)                   return "بيسمعك… اضغط لما تخلص";
      if (voiceStatus === "analysing") return "بيحلل صوتك…";
      if (voiceStatus === "done")      return "اضغط تاني للتسجيل";
      if (voiceStatus === "error")     return "مش قادر يسمع — حاول تاني";
      return "اضغط وقول مزاجك بأي لغة";
    }
    if (recording)                   return "Listening… tap when you're done";
    if (voiceStatus === "analysing") return "Analysing your voice…";
    if (voiceStatus === "done")      return "Tap to speak again";
    if (voiceStatus === "error")     return "Could not detect — try again";
    return "Tap to speak — any language";
  };

  return (
    <div className="mi-root" dir={isAr ? "rtl" : "ltr"}>

      {/* ── Language toggle ── */}
      <div className="mi-lang-toggle">
        <button className={`lang-btn ${!isAr ? "active" : ""}`} onClick={() => setLang("en")}>EN</button>
        <button className={`lang-btn ${isAr  ? "active" : ""}`} onClick={() => setLang("ar")}>ع</button>
      </div>

      {/* ── Tab bar ── */}
      <div className="mi-tabs">
        {["voice", "text", "quiz"].map((t) => (
          <button key={t} className={`mi-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "voice"
              ? isAr ? "🎙 صوت"    : "🎙 Voice"
              : t === "text"
              ? isAr ? "✍️ نص"    : "✍️ Text"
              : isAr ? "🎯 اختبار" : "🎯 Quiz"}
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
              aria-label={recording ? "Stop" : "Start"}
            >
              <span className="mic-ico">
                {voiceStatus === "analysing" ? "⏳" : recording ? "⏹" : "🎙"}
              </span>
              {recording && <span className="mic-pulse" />}
            </button>

            <p className="voice-lbl">{voiceLabel()}</p>

            {detectedLang && voiceStatus === "done" && (
              <p className="lang-badge">
                {LANG_FLAGS[detectedLang] || "🌐"} {detectedLang.toUpperCase()}
              </p>
            )}

            {transcript && <p className="voice-transcript">"{transcript}"</p>}

            {recording && (
              <div className="waveform" aria-hidden="true">
                {[10, 18, 22, 28, 22, 18, 10, 14, 24, 14].map((h, i) => (
                  <span key={i} className="wbar" style={{ "--h": `${h}px`, animationDelay: `${i * 0.07}s` }} />
                ))}
              </div>
            )}

            {voiceStatus === "analysing" && (
              <div className="analysing-dots">
                {[0, 1, 2].map((i) => <span key={i} className="dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
              </div>
            )}

            {voiceStatus === "error" && (
              <p className="voice-error">
                {isAr ? "⚠️ تأكد إن الميكروفون شغال" : "⚠️ Make sure your mic is allowed."}
              </p>
            )}
          </div>

          {detectedMood && voiceStatus === "done" && (
            <div className="result-area">
              <MoodCard mood={detectedMood} showValence />
              {detectedMood.confidence !== undefined && (
                <p className="confidence-note">
                  {isAr ? "الدقة" : "Confidence"}: {Math.round(detectedMood.confidence * 100)}%
                </p>
              )}
              <button className="continue-btn" onClick={() => handleContinue(detectedMood)}>
                {isAr ? "← ابدأ الموسيقى" : "Create my music →"}
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
              {isAr ? "قول مزاجك بأي لغة…" : "How are you feeling? Write in any language."}
            </p>
            <textarea
              className="text-area"
              rows={4}
              placeholder={isAr ? "أنا حاسس… / I feel… / Je me sens…" : "I feel… / أنا أشعر… / Je me sens…"}
              value={textInput}
              onChange={(e) => { setTextInput(e.target.value); setTextMood(null); }}
              dir="auto"
            />
            <button
              className="analyse-btn"
              onClick={analyzeText}
              disabled={!textInput.trim() || textAnalysing}
            >
              {textAnalysing
                ? (isAr ? "بيحلل…" : "Analysing…")
                : (isAr ? "حلل مزاجي" : "Analyse my mood")}
            </button>
          </div>

          {textMood && (
            <div className="result-area">
              <MoodCard mood={textMood} showValence />
              {textMood.confidence !== undefined && (
                <p className="confidence-note">
                  {isAr ? "الدقة" : "Confidence"}: {Math.round(textMood.confidence * 100)}%
                </p>
              )}
              <button className="continue-btn" onClick={() => handleContinue(textMood)}>
                {isAr ? "← ابدأ الموسيقى" : "Create my music →"}
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

              {/* Progress pips — clicking a completed pip jumps back */}
              <div className="quiz-progress">
                {QUIZ_QUESTIONS.map((_, i) => (
                  <div
                    key={i}
                    className={`quiz-pip ${i < quizStep ? "done" : i === quizStep ? "active" : ""}`}
                    onClick={() => {
                      if (i < quizStep) {
                        setQuizStep(i);
                        setQuizAnswers((prev) => prev.slice(0, i));
                      }
                    }}
                    style={{ cursor: i < quizStep ? "pointer" : "default" }}
                  />
                ))}
              </div>

              <p className="quiz-q">
                {isAr ? QUIZ_QUESTIONS[quizStep].questionAr : QUIZ_QUESTIONS[quizStep].question}
              </p>

              {/* Show previously selected answer highlighted */}
              <div className="quiz-options">
                {QUIZ_QUESTIONS[quizStep].options.map((opt) => {
                  const isSelected =
                    quizAnswers[quizStep] &&
                    quizAnswers[quizStep].label === opt.label;
                  return (
                    <button
                      key={opt.label}
                      className={`quiz-opt ${isSelected ? "selected" : ""}`}
                      onClick={() => answerQuiz(opt)}
                    >
                      {isAr ? opt.labelAr : opt.label}
                    </button>
                  );
                })}
              </div>

              {/* ── Previous / counter / Next row ── */}
              <div className="quiz-nav">
                {/* Previous button */}
                <button
                  className="quiz-nav-btn"
                  onClick={() => {
                    if (quizStep > 0) {
                      setQuizStep(quizStep - 1);
                    }
                  }}
                  disabled={quizStep === 0}
                >
                  {isAr ? "التالي →" : "← Previous"}
                </button>

                <p className="quiz-counter">{quizStep + 1} / {QUIZ_QUESTIONS.length}</p>

                {/* Next button — only enabled if this step already has an answer */}
                <button
                  className="quiz-nav-btn"
                  onClick={() => {
                    if (quizStep < quizAnswers.length) {
                      setQuizStep(quizStep + 1);
                    }
                  }}
                  disabled={quizStep >= quizAnswers.length}
                >
                  {isAr ? "← السابق" : "Next →"}
                </button>
              </div>

            </div>
          ) : (
            <div className="result-area">
              <MoodCard mood={quizMood} showValence />
              <button className="reset-btn" onClick={resetQuiz}>
                {isAr ? "حل الاختبار تاني" : "Retake quiz"}
              </button>
              <button className="continue-btn" onClick={() => handleContinue(quizMood)}>
                {isAr ? "← ابدأ الموسيقى" : "Create my music →"}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .mi-root {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 380px;
          margin: 0 auto;
          background: #faf8ff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(120,90,200,.13);
        }
        .mi-lang-toggle {
          display: flex;
          justify-content: flex-end;
          gap: 4px;
          padding: 8px 10px 0;
        }
        .lang-btn {
          padding: 4px 10px;
          border: 1.5px solid #d4caf0;
          border-radius: 20px;
          background: transparent;
          font-size: 12px;
          font-weight: 700;
          color: #8b7eb8;
          cursor: pointer;
          transition: all .18s;
        }
        .lang-btn.active {
          background: #7c5ce7;
          color: #fff;
          border-color: #7c5ce7;
        }
        .mi-tabs {
          display: flex;
          background: #f0ecff;
          padding: 6px;
          gap: 4px;
          border-bottom: 1px solid #e4dff5;
          margin-top: 6px;
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

        /* ── Voice ── */
        .voice-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          width: 100%;
        }
        .mic-ring {
          position: relative;
          width: 88px; height: 88px;
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
        .mic-ring:hover:not(:disabled) { border-color: #7c5ce7; box-shadow: 0 6px 24px rgba(120,90,200,.25); transform: scale(1.04); }
        .mic-ring.rec { border-color: #e74c3c; box-shadow: 0 0 0 6px rgba(231,76,60,.12); animation: recPulse 1.4s ease-in-out infinite; }
        .mic-ring.spin .mic-ico { animation: spin 1.2s linear infinite; }
        .mic-ring:disabled { cursor: default; opacity: .7; }
        .mic-ico { font-size: 32px; line-height: 1; display: block; }
        .mic-pulse { position: absolute; inset: -10px; border-radius: 50%; border: 2px solid rgba(231,76,60,.35); animation: pulsRing 1.4s ease-out infinite; pointer-events: none; }
        @keyframes recPulse { 0%,100%{box-shadow:0 0 0 6px rgba(231,76,60,.12)}50%{box-shadow:0 0 0 10px rgba(231,76,60,.2)} }
        @keyframes pulsRing { 0%{transform:scale(1);opacity:1}100%{transform:scale(1.5);opacity:0} }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        .voice-lbl { font-size: 14px; color: #7b6fa8; text-align: center; margin: 0; font-weight: 500; }
        .lang-badge { font-size: 12px; color: #7c5ce7; font-weight: 600; margin: 0; background: rgba(124,92,231,.08); padding: 4px 12px; border-radius: 20px; }
        .voice-transcript { font-size: 12px; color: #5c5575; font-style: italic; margin: 0; padding: 8px 14px; background: rgba(176,158,224,.08); border-radius: 10px; max-width: 300px; text-align: center; line-height: 1.6; border: 1px solid rgba(176,158,224,.2); }
        .voice-error { font-size: 12px; color: #e74c3c; text-align: center; max-width: 260px; margin: 0; line-height: 1.5; }
        .waveform { display: flex; align-items: center; gap: 3px; height: 36px; }
        .wbar { display: block; width: 3px; height: var(--h,10px); border-radius: 2px; background: #7c5ce7; animation: wave .8s ease-in-out infinite alternate; }
        @keyframes wave { from{transform:scaleY(.4);opacity:.6}to{transform:scaleY(1.4);opacity:1} }
        .analysing-dots { display: flex; gap: 6px; align-items: center; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #7c5ce7; animation: dotBounce .8s ease-in-out infinite alternate; }
        @keyframes dotBounce { from{transform:translateY(0);opacity:.5}to{transform:translateY(-6px);opacity:1} }

        /* ── Text ── */
        .text-wrap { width: 100%; display: flex; flex-direction: column; gap: 12px; }
        .text-prompt { font-size: 14px; color: #7b6fa8; margin: 0; font-weight: 500; }
        .text-area { width: 100%; box-sizing: border-box; border: 1.5px solid #d4caf0; border-radius: 12px; padding: 12px 14px; font-size: 14px; font-family: inherit; color: #3d2e6b; background: #fff; resize: none; transition: border-color .2s; outline: none; line-height: 1.6; }
        .text-area:focus { border-color: #7c5ce7; box-shadow: 0 0 0 3px rgba(124,92,231,.1); }
        .analyse-btn { align-self: flex-end; padding: 10px 20px; border: none; border-radius: 12px; background: #7c5ce7; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .18s, transform .12s; }
        .analyse-btn:hover:not(:disabled) { background: #6347cc; transform: translateY(-1px); }
        .analyse-btn:disabled { opacity: .45; cursor: default; }

        /* ── Quiz ── */
        .quiz-wrap { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 18px; }
        .quiz-progress { display: flex; gap: 6px; }
        .quiz-pip { width: 22px; height: 5px; border-radius: 3px; background: #e0d8f5; transition: background .25s; }
        .quiz-pip.active { background: #7c5ce7; }
        .quiz-pip.done   { background: #b09ee0; }
        .quiz-q { font-size: 15px; font-weight: 600; color: #3d2e6b; text-align: center; margin: 0; line-height: 1.5; }
        .quiz-options { width: 100%; display: flex; flex-direction: column; gap: 8px; }

        /* FIX 1 — hover text color: explicit color: #3d2e6b on both base and hover states */
        .quiz-opt {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid #d4caf0;
          border-radius: 12px;
          background: #fff;
          font-size: 13px;
          font-weight: 500;
          color: #3d2e6b;
          cursor: pointer;
          text-align: left;
          transition: border-color .18s, background .18s, transform .12s, color .18s;
        }
        .quiz-opt:hover {
          border-color: #7c5ce7;
          background: #f5f1ff;
          color: #3d2e6b;
          transform: translateX(3px);
        }
        /* Selected state — highlights the previously chosen answer when navigating back */
        .quiz-opt.selected {
          border-color: #7c5ce7;
          background: #ede8ff;
          color: #3d2e6b;
          font-weight: 700;
        }

        /* FIX 2 — Previous + Next nav row */
        .quiz-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-top: 4px;
        }
        .quiz-nav-btn {
          padding: 7px 16px;
          border: 1.5px solid #d4caf0;
          border-radius: 20px;
          background: transparent;
          color: #7c5ce7;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background .18s, border-color .18s;
        }
        .quiz-nav-btn:hover:not(:disabled) {
          background: #f0ecff;
          border-color: #7c5ce7;
        }
        .quiz-nav-btn:disabled {
          opacity: 0.35;
          cursor: default;
        }
        .quiz-counter { font-size: 12px; color: #b09ee0; margin: 0; }

        /* ── Result / shared ── */
        .reset-btn { margin-top: 8px; padding: 9px 20px; border: 1.5px solid #c4b5f0; border-radius: 12px; background: transparent; color: #7c5ce7; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .18s; }
        .reset-btn:hover { background: #f0ecff; }
        .result-area { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; animation: fadeUp .35s ease; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        .mood-result-card { width: 100%; box-sizing: border-box; background: linear-gradient(135deg,#fff 60%,color-mix(in srgb,var(--accent) 10%,#fff)); border: 2px solid var(--accent); border-radius: 16px; padding: 20px 16px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,.07); }
        .mood-emoji { font-size: 36px; margin-bottom: 8px; line-height: 1; }
        .mood-label { font-size: 16px; font-weight: 700; color: #3d2e6b; margin: 0 0 10px; }
        .mood-tags { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .mood-tag { padding: 4px 11px; border-radius: 20px; background: color-mix(in srgb,var(--accent) 15%,#fff); color: color-mix(in srgb,var(--accent) 80%,#000); font-size: 12px; font-weight: 600; }
        .mood-reasoning { font-size: 12px; color: #5c5575; font-style: italic; margin: 4px 0 0; line-height: 1.5; }
        .mood-meters { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
        .meter-row { display: flex; align-items: center; gap: 8px; }
        .meter-lbl { font-size: 11px; font-weight: 600; color: #8b7eb8; width: 52px; text-align: right; }
        .meter-bar { flex: 1; height: 6px; background: #ede9f8; border-radius: 3px; overflow: hidden; }
        .meter-fill { height: 100%; border-radius: 3px; transition: width .6s ease; }
        .meter-val { font-size: 11px; font-weight: 600; color: #8b7eb8; width: 30px; }
        .confidence-note { font-size: 11px; color: #b09ee0; margin: 0; }
        .continue-btn { width: 100%; padding: 14px; border: none; border-radius: 14px; background: linear-gradient(135deg,#7c5ce7,#a855f7); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; transition: transform .15s, box-shadow .15s; box-shadow: 0 4px 16px rgba(124,92,231,.35); margin-top: 4px; }
        .continue-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(124,92,231,.45); }
      `}</style>
    </div>
  );
}