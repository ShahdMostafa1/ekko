"""
Ekko — Layer 2: Real-Time Mood Engine
POST /mood/detect       → voice emotion detection (Gemini audio agent)
POST /mood/detect-text  → text emotion detection (any language)
GET  /mood/history/{user_id} → mood history

Pipeline:
  1. Gemini (via OpenRouter) receives raw audio + acoustic features
     — transcribes + detects emotion natively, no Whisper needed
     — handles dialectal Arabic, Egyptian, Levantine, Gulf, etc.
  2. librosa extracts acoustic features (energy, pitch, tempo)
  3. Parallel text analysis on transcript (blend acoustic + text)
  4. HuggingFace classifier as last-resort fallback (optional — graceful if not installed)
  5. Persisted to Supabase mood_logs
"""
from __future__ import annotations
import os
import json
import base64
import tempfile
import httpx
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/mood", tags=["Layer 2 — Mood Engine"])

_sentiment_pipe = None

AUDIO_MODELS = [
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5",
    "google/gemini-pro-1.5",
]
TEXT_MODELS = [
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5",
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-v3-base:free",
]

UNKNOWN_EMOTIONS = {"unknown", "UNKNOWN", "", None}


# FIX: graceful optional import — won't crash if transformers not installed
def _get_sentiment():
    global _sentiment_pipe
    if _sentiment_pipe is None:
        try:
            from transformers import pipeline
            _sentiment_pipe = pipeline(
                "text-classification",
                model="j-hartmann/emotion-english-distilroberta-base",
                top_k=None,
            )
        except ImportError:
            print("[mood] transformers not installed — HF fallback disabled")
            _sentiment_pipe = "unavailable"
    return _sentiment_pipe if _sentiment_pipe != "unavailable" else None


def _openrouter_headers(api_key: str) -> dict:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://ekko.app",
        "X-Title":       "Ekko Mood Engine",
    }


# ── Gemini Audio Agent ────────────────────────────────────────────────────────
def _gemini_audio_agent(
    audio_b64: str,
    mime_type: str,
    acoustic:  dict,
    region:    str = "",
) -> dict | None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("[mood:audio] No OPENROUTER_API_KEY")
        return None

    prompt = f"""You are an expert emotion detection agent for Ekko, a music mood app for teenagers.
Listen to this audio clip carefully. The speaker may use Arabic (including Egyptian عامية, Levantine, Gulf dialect), English, French, or any other language.

YOUR TASKS:
1. Transcribe exactly what was said (keep original language — do NOT translate)
2. Identify the language code (ar, en, fr, etc.)
3. Detect the emotional state using BOTH the words AND tone of voice

ACOUSTIC SIGNAL DATA:
- Energy: {acoustic.get('energy', 0):.4f} (higher = louder/more intense)
- Pitch: {acoustic.get('pitch', 0):.1f} Hz (higher = more stressed/excited)
- Tempo: {acoustic.get('tempo', 0):.1f} BPM (higher = faster/more agitated)
- Zero Crossing Rate: {acoustic.get('zcr', 0):.4f} (higher = more tension)

USER REGION: {region or 'unknown'}

ARABIC CULTURAL NOTES — READ CAREFULLY:
- "تعبان / تعبانة / تعبت" = emotionally drained, exhausted, burnt out → sadness
- "مش قادر / مش قادرة" = can't cope, overwhelmed, helpless → fear or sadness
- "زهقت / زهقان / زهقانة" = fed up, done with everything → disgust or sadness
- "محبط / محبطة / باحباط" = frustrated, deeply disappointed → sadness or anger
- "الدنيا مقفلة / كل حاجة مقفلة" = world feels closed/locked = deep despair → sadness
- "مش عارف أكمل" = can't continue = severe distress → fear
- "حاسه / حاسس" = I feel (Egyptian dialect) — look at WHAT follows
- "مبسوط / مبسوطة / مبسوطه" = happy, pleased, content → joy
- "اوي" = very/extremely (Egyptian intensifier) — amplifies whatever emotion precedes it
- "أنا مش كويس / مش تمام" = I'm not okay → sadness
- "كل حاجة غلط" = everything is wrong → sadness or anger
- Teenagers ALWAYS understate — "مش عارف" often means deep confusion/distress
- Flat/quiet voice + negative words = suppressed sadness, not neutral

EMOTION RULES:
- Prioritise WORDS over acoustics for emotion label
- Use acoustics to calibrate arousal intensity
- High energy + negative words = anger or anxious fear
- Low energy + negative words = sadness or disgust
- Any mention of hopelessness/world being closed = sadness

CRITICAL: You MUST always return one of these exact emotions: joy, sadness, anger, fear, surprise, disgust, neutral
NEVER return "unknown" or any other value for top_emotion.

Return ONLY valid JSON, no markdown, no preamble, no explanation:
{{
  "transcript": "<exact words spoken in ORIGINAL language>",
  "language": "<ISO 639-1 code e.g. ar, en, fr>",
  "top_emotion": "<joy|sadness|anger|fear|surprise|disgust|neutral>",
  "secondary_emotion": "<emotion or null>",
  "valence": <float -1.0 to 1.0>,
  "arousal": <float 0.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "reasoning": "<1-2 empathetic sentences in English>",
  "all_emotions": [
    {{"label": "joy",      "score": <float>}},
    {{"label": "sadness",  "score": <float>}},
    {{"label": "anger",    "score": <float>}},
    {{"label": "fear",     "score": <float>}},
    {{"label": "surprise", "score": <float>}},
    {{"label": "disgust",  "score": <float>}},
    {{"label": "neutral",  "score": <float>}}
  ]
}}"""

    for model in AUDIO_MODELS:
        try:
            print(f"[mood:audio] trying model={model}")
            response = httpx.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=_openrouter_headers(api_key),
                json={
                    "model": model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{audio_b64}"
                                }
                            },
                            {"type": "text", "text": prompt}
                        ]
                    }],
                    "max_tokens":  700,
                    "temperature": 0.1,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"].strip()

            if raw.startswith("```"):
                raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

            result = json.loads(raw)
            print(f"[mood:audio] model={model} transcript='{result.get('transcript')}'")
            print(f"[mood:audio] lang={result.get('language')} emotion={result['top_emotion']} "
                  f"valence={result['valence']} arousal={result['arousal']} "
                  f"confidence={result['confidence']}")
            print(f"[mood:audio] reasoning: {result.get('reasoning', '')}")
            return result

        except json.JSONDecodeError as e:
            print(f"[mood:audio] {model} JSON parse error: {e} | raw: {raw[:200]}")
        except Exception as e:
            print(f"[mood:audio] {model} failed: {e}")

    print("[mood:audio] all models failed")
    return None


# ── Gemini Text Agent ─────────────────────────────────────────────────────────
def _gemini_text_agent(
    text:   str,
    region: str = "",
) -> dict | None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None

    prompt = f"""You are an expert emotion detection agent for Ekko, a music mood app for teenagers.
Accurately detect the emotional state from what a teenager wrote. They may write in ANY language including Arabic dialects.

WHAT THEY WROTE:
"{text}"

USER REGION: {region or 'unknown'}

ARABIC CULTURAL NOTES — READ CAREFULLY:
- "تعبان / تعبانة / تعبت" = emotionally drained, exhausted → sadness
- "مش قادر / مش قادرة" = can't cope, overwhelmed → fear or sadness
- "زهقت / زهقان / زهقانة" = fed up, done with everything → disgust or sadness
- "محبط / محبطة / باحباط" = frustrated, deeply disappointed → sadness or anger
- "الدنيا مقفلة / كل حاجة مقفلة" = world feels closed = deep despair → sadness
- "مش عارف أكمل" = can't continue = severe distress → fear
- "مبسوط / مبسوطة / مبسوطه" = happy, pleased, content → joy
- "اوي" = very/extremely (Egyptian intensifier) — amplifies whatever precedes it
- "أنا مش كويس / مش تمام" = I'm not okay → sadness
- "كل حاجة غلط" = everything is wrong → sadness or anger
- "حاسه / حاسس" = I feel (Egyptian dialect) — look at WHAT follows
- Teenagers ALWAYS understate their negative feelings
- Any mention of world being closed/hopeless = sadness, NOT neutral

CRITICAL: You MUST always return one of these exact emotions: joy, sadness, anger, fear, surprise, disgust, neutral
NEVER return "unknown" or any other value for top_emotion.

Return ONLY valid JSON, no markdown, no preamble:
{{
  "top_emotion": "<joy|sadness|anger|fear|surprise|disgust|neutral>",
  "secondary_emotion": "<emotion or null>",
  "valence": <float -1.0 to 1.0>,
  "arousal": <float 0.0 to 1.0>,
  "confidence": <float 0.0 to 1.0>,
  "reasoning": "<1-2 empathetic sentences in English>",
  "all_emotions": [
    {{"label": "joy",      "score": <float>}},
    {{"label": "sadness",  "score": <float>}},
    {{"label": "anger",    "score": <float>}},
    {{"label": "fear",     "score": <float>}},
    {{"label": "surprise", "score": <float>}},
    {{"label": "disgust",  "score": <float>}},
    {{"label": "neutral",  "score": <float>}}
  ]
}}"""

    for model in TEXT_MODELS:
        try:
            print(f"[mood:text] trying model={model}")
            response = httpx.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=_openrouter_headers(api_key),
                json={
                    "model":       model,
                    "messages":    [{"role": "user", "content": prompt}],
                    "max_tokens":  500,
                    "temperature": 0.1,
                },
                timeout=15.0,
            )
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"].strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

            result = json.loads(raw)
            print(f"[mood:text] model={model} emotion={result['top_emotion']} "
                  f"valence={result['valence']} confidence={result['confidence']}")
            print(f"[mood:text] reasoning: {result.get('reasoning', '')}")
            return result

        except json.JSONDecodeError as e:
            print(f"[mood:text] {model} JSON parse error: {e}")
        except Exception as e:
            print(f"[mood:text] {model} failed: {e}")

    print("[mood:text] all models failed, using HF fallback")
    return None


# ── Blend acoustic + text emotion signals ─────────────────────────────────────
def _blend_audio_and_text(
    audio_result: dict,
    text_result:  dict,
    acoustic:     dict,
) -> dict:
    audio_emotion    = audio_result.get("top_emotion", "")
    audio_confidence = audio_result.get("confidence", 0.0)
    text_emotion     = text_result.get("top_emotion", "neutral")
    text_confidence  = text_result.get("confidence", 0.8)

    is_audio_unknown = audio_emotion in UNKNOWN_EMOTIONS or audio_confidence < 0.5

    if is_audio_unknown:
        print(f"[mood:blend] audio UNKNOWN/low-conf ({audio_confidence:.2f}) → trusting text: {text_emotion}")
        ac_arousal = min(acoustic.get("energy", 0.005) * 20, 1.0)
        blended_arousal = round(0.4 * text_result.get("arousal", 0.5) + 0.6 * ac_arousal, 3)
        return {
            "top_emotion":       text_emotion,
            "secondary_emotion": text_result.get("secondary_emotion"),
            "valence":           text_result.get("valence", 0.0),
            "arousal":           blended_arousal,
            "confidence":        text_confidence,
            "reasoning":         text_result.get("reasoning", ""),
            "all_emotions":      text_result.get("all_emotions", []),
            "transcript":        audio_result.get("transcript", ""),
            "language":          audio_result.get("language", "unknown"),
            "method":            "text_dominant_blend",
        }

    if audio_emotion == text_emotion:
        print(f"[mood:blend] audio + text AGREE on: {audio_emotion} → boosting confidence")
        return {
            "top_emotion":       audio_emotion,
            "secondary_emotion": audio_result.get("secondary_emotion"),
            "valence":           round((audio_result.get("valence", 0) * 0.5 +
                                        text_result.get("valence", 0) * 0.5), 3),
            "arousal":           round((audio_result.get("arousal", 0.5) * 0.6 +
                                        text_result.get("arousal", 0.5) * 0.4), 3),
            "confidence":        round(min((audio_confidence + text_confidence) / 2 + 0.1, 1.0), 3),
            "reasoning":         audio_result.get("reasoning", ""),
            "all_emotions":      audio_result.get("all_emotions", []),
            "transcript":        audio_result.get("transcript", ""),
            "language":          audio_result.get("language", "unknown"),
            "method":            "full_blend_agree",
        }

    print(f"[mood:blend] audio={audio_emotion} vs text={text_emotion} → text wins (words > acoustics)")
    ac_arousal      = min(acoustic.get("energy", 0.005) * 20, 1.0)
    blended_arousal = round(0.5 * text_result.get("arousal", 0.5) + 0.5 * ac_arousal, 3)
    blended_valence = round(0.3 * audio_result.get("valence", 0) +
                            0.7 * text_result.get("valence", 0), 3)
    return {
        "top_emotion":       text_emotion,
        "secondary_emotion": audio_result.get("secondary_emotion") or text_result.get("secondary_emotion"),
        "valence":           blended_valence,
        "arousal":           blended_arousal,
        "confidence":        round((audio_confidence * 0.3 + text_confidence * 0.7), 3),
        "reasoning":         text_result.get("reasoning", ""),
        "all_emotions":      text_result.get("all_emotions", []),
        "transcript":        audio_result.get("transcript", ""),
        "language":          audio_result.get("language", "unknown"),
        "method":            "text_wins_blend",
    }


# ── HuggingFace fallback (optional — graceful if transformers not installed) ──
def _classifier_emotion(transcript: str, acoustic: dict | None = None) -> dict:
    EMOTION_TO_VA = {
        "joy":      ( 0.8,  0.7),
        "surprise": ( 0.6,  0.6),
        "neutral":  ( 0.0,  0.4),
        "sadness":  (-0.6,  0.3),
        "anger":    (-0.5,  0.8),
        "disgust":  (-0.6,  0.3),
        "fear":     (-0.4,  0.7),
    }

    pipe = _get_sentiment()
    if pipe is not None:
        try:
            scores = pipe(transcript)[0]
        except Exception:
            scores = [{"label": "neutral", "score": 1.0}]
    else:
        # transformers not available — acoustic-only fallback
        scores = [{"label": "neutral", "score": 1.0}]

    top = max(scores, key=lambda x: x["score"])
    nlp_v, nlp_a = EMOTION_TO_VA.get(top["label"], (0.0, 0.5))

    if acoustic:
        ac_arousal  = min(acoustic.get("energy", 0) * 20, 1.0)
        ac_valence  = min((acoustic.get("pitch", 150) - 80) / 320, 1.0)
        raw_valence = 0.6 * nlp_v + 0.4 * ac_valence
        raw_arousal = 0.6 * nlp_a + 0.4 * ac_arousal
    else:
        raw_valence = nlp_v
        raw_arousal = nlp_a

    return {
        "top_emotion":       top["label"],
        "secondary_emotion": None,
        "valence":           raw_valence,
        "arousal":           round(raw_arousal, 3),
        "confidence":        round(top["score"], 3),
        "reasoning":         "Detected via acoustic analysis.",
        "all_emotions":      scores,
    }


def normalise(v: float) -> float:
    return round((v + 1) / 2, 3)


def extract_acoustic_features(audio_bytes: bytes, suffix: str = ".webm") -> dict:
    import librosa
    import numpy as np

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        y, sr    = librosa.load(tmp_path, sr=16000)
        energy   = float(np.mean(librosa.feature.rms(y=y)))
        pitch    = float(np.nanmean(librosa.yin(y, fmin=80, fmax=400)))
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        zcr      = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        return {
            "energy": round(energy, 4),
            "pitch":  round(pitch,  2),
            "tempo":  round(float(tempo), 2),
            "zcr":    round(zcr,    4),
        }
    except Exception as e:
        print(f"[mood] acoustic extraction failed: {e}")
        return {"energy": 0.005, "pitch": 150.0, "tempo": 120.0, "zcr": 0.05}
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def _get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_KEY")
    )
    if not url or not key:
        return None
    return create_client(url, key)


def _persist_mood_log(
    user_id:    str,
    valence:    float,
    arousal:    float,
    emotion:    str,
    transcript: str,
    confidence: float,
    acoustic:   dict,
    region:     str = "",
    language:   str = "",
    reasoning:  str = "",
) -> None:
    sb = _get_supabase()
    if not sb or not user_id:
        return
    try:
        sb.table("mood_logs").insert({
            "user_id":    user_id,
            "valence":    valence,
            "arousal":    arousal,
            "emotion":    emotion,
            "transcript": transcript,
            "confidence": confidence,
            "acoustic":   acoustic,
            "region":     region,
            "language":   language,
        }).execute()
    except Exception as e:
        print(f"[mood] persist failed: {e}")


# ── Request models ────────────────────────────────────────────────────────────
class TextMoodRequest(BaseModel):
    text:    str
    user_id: str = ""
    region:  str = ""


# ── Voice endpoint ────────────────────────────────────────────────────────────
@router.post("/detect", summary="Detect mood from audio — Gemini audio agent + text blend")
async def detect_mood(
    audio:   UploadFile = File(...),
    user_id: str = Form(default=""),
    region:  str = Form(default=""),
):
    audio_bytes = await audio.read()
    filename  = audio.filename or "mood.webm"
    suffix    = "." + filename.rsplit(".", 1)[-1] if "." in filename else ".webm"
    mime_type = (
        "audio/mp4"  if suffix == ".mp4"  else
        "audio/ogg"  if suffix == ".ogg"  else
        "audio/webm"
    )

    print(f"[mood] received audio: {filename} ({len(audio_bytes)} bytes) mime={mime_type}")

    feats = extract_acoustic_features(audio_bytes, suffix=suffix)
    print(f"[mood] acoustic: {feats}")

    audio_b64    = base64.b64encode(audio_bytes).decode("utf-8")
    audio_result = _gemini_audio_agent(
        audio_b64 = audio_b64,
        mime_type = mime_type,
        acoustic  = feats,
        region    = region,
    )

    final = None

    if audio_result:
        transcript    = audio_result.get("transcript", "")
        detected_lang = audio_result.get("language", "unknown")
        audio_emotion = audio_result.get("top_emotion", "")

        text_result = None
        if transcript and transcript.strip():
            print(f"[mood] running text agent on transcript: '{transcript}'")
            text_result = _gemini_text_agent(text=transcript, region=region)

        if text_result:
            blended = _blend_audio_and_text(audio_result, text_result, feats)
            top_emotion   = blended["top_emotion"]
            raw_valence   = blended["valence"]
            arousal       = blended["arousal"]
            confidence    = blended["confidence"]
            reasoning     = blended["reasoning"]
            all_emotions  = blended["all_emotions"]
            transcript    = blended.get("transcript", transcript)
            detected_lang = blended.get("language", detected_lang)
            method        = blended["method"]
            print(f"[mood] blend result: {method} → emotion={top_emotion} confidence={confidence}")
        else:
            if audio_emotion in UNKNOWN_EMOTIONS:
                print("[mood] audio UNKNOWN + text failed → HF fallback")
                fb           = _classifier_emotion("I feel something", feats)
                top_emotion  = fb["top_emotion"]
                raw_valence  = fb["valence"]
                arousal      = fb["arousal"]
                confidence   = fb["confidence"]
                reasoning    = fb["reasoning"]
                all_emotions = fb["all_emotions"]
                method       = "hf_fallback"
            else:
                top_emotion  = audio_emotion
                raw_valence  = audio_result["valence"]
                arousal      = round(audio_result["arousal"], 3)
                confidence   = round(audio_result["confidence"], 3)
                reasoning    = audio_result.get("reasoning", "")
                all_emotions = audio_result.get("all_emotions", [])
                method       = "gemini_audio_only"

    else:
        print("[mood] Gemini audio failed — using HF fallback")
        fb            = _classifier_emotion("I feel something", feats)
        transcript    = ""
        detected_lang = "unknown"
        top_emotion   = fb["top_emotion"]
        raw_valence   = fb["valence"]
        arousal       = fb["arousal"]
        confidence    = fb["confidence"]
        reasoning     = fb["reasoning"]
        all_emotions  = fb["all_emotions"]
        method        = "hf_fallback"

    valence = normalise(raw_valence)

    _persist_mood_log(
        user_id, valence, arousal, top_emotion,
        transcript, confidence, feats,
        region, detected_lang, reasoning,
    )

    return {
        "transcript":   transcript,
        "language":     detected_lang,
        "top_emotion":  top_emotion,
        "confidence":   confidence,
        "valence":      valence,
        "arousal":      arousal,
        "acoustic":     feats,
        "reasoning":    reasoning,
        "method":       method,
        "all_emotions": all_emotions,
    }


# ── Text endpoint ─────────────────────────────────────────────────────────────
@router.post("/detect-text", summary="Detect mood from typed text — Gemini agent")
async def detect_mood_text(req: TextMoodRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    print(f"[mood] text input: {req.text}")

    agent_result = _gemini_text_agent(
        text   = req.text,
        region = req.region,
    )

    if agent_result:
        top_emotion  = agent_result["top_emotion"]
        raw_valence  = agent_result["valence"]
        arousal      = round(agent_result["arousal"], 3)
        confidence   = round(agent_result["confidence"], 3)
        reasoning    = agent_result.get("reasoning", "")
        all_emotions = agent_result.get("all_emotions", [])
        method       = "gemini_text"
    else:
        fb           = _classifier_emotion(req.text)
        top_emotion  = fb["top_emotion"]
        raw_valence  = fb["valence"]
        arousal      = round(fb["arousal"], 3)
        confidence   = round(fb["confidence"], 3)
        reasoning    = fb["reasoning"]
        all_emotions = fb["all_emotions"]
        method       = "hf_classifier"

    valence = normalise(raw_valence)

    _persist_mood_log(
        req.user_id, valence, arousal, top_emotion,
        req.text, confidence, {}, req.region, "text", reasoning,
    )

    return {
        "transcript":   req.text,
        "language":     "text",
        "top_emotion":  top_emotion,
        "confidence":   confidence,
        "valence":      valence,
        "arousal":      arousal,
        "reasoning":    reasoning,
        "method":       method,
        "all_emotions": all_emotions,
    }


# ── History endpoint ──────────────────────────────────────────────────────────
@router.get("/history/{user_id}", summary="Mood history for calendar")
async def get_mood_history(user_id: str):
    sb = _get_supabase()
    if not sb:
        return {"logs": [], "message": "Supabase not configured"}

    resp = (
        sb.table("mood_logs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"logs": resp.data}