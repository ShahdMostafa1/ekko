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

_whisper_model     = None
_whisper_failed    = False
_openrouter_audio_blocked = False

AUDIO_MODELS = [
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5",
    "google/gemini-pro-1.5",
]
STT_MODELS = [
    "qwen/qwen3-asr-flash-2026-02-10",
    "openai/whisper-large-v3",
    "google/chirp-3",
    "openai/gpt-4o-mini-transcribe",
    "openai/whisper-large-v3-turbo",
    "mistralai/voxtral-mini-transcribe",
    "openai/whisper-1",
]
STT_CHAT_MODELS = [
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5",
    "qwen/qwen3-asr-flash-2026-02-10",
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


def _audio_format_from_suffix(suffix: str) -> str:
    ext = suffix.lower().lstrip(".")
    return {
        "mp4":  "m4a",
        "m4a":  "m4a",
        "ogg":  "ogg",
        "webm": "webm",
        "wav":  "wav",
        "mp3":  "mp3",
        "flac": "flac",
        "aac":  "aac",
    }.get(ext, "webm")


def _convert_to_wav(audio_bytes: bytes, suffix: str = ".webm") -> tuple[bytes, str, str]:
    """Normalise browser recordings to 16 kHz mono WAV for reliable STT."""
    import io
    import subprocess
    import librosa
    import soundfile as sf

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_in = f.name
    tmp_out = tmp_in + ".wav"
    try:
        proc = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_in, "-ar", "16000", "-ac", "1", "-f", "wav", tmp_out],
            capture_output=True,
            timeout=30,
        )
        if proc.returncode == 0 and os.path.exists(tmp_out):
            with open(tmp_out, "rb") as wf:
                wav_bytes = wf.read()
            if len(wav_bytes) > 44:
                return wav_bytes, base64.b64encode(wav_bytes).decode("utf-8"), "wav"
        if proc.stderr:
            print(f"[mood:ffmpeg] {proc.stderr.decode()[:200]}")
    except FileNotFoundError:
        print("[mood:ffmpeg] not installed — using librosa")
    except Exception as e:
        print(f"[mood:ffmpeg] error: {e}")
    finally:
        for p in (tmp_in, tmp_out):
            try:
                if os.path.exists(p):
                    os.unlink(p)
            except Exception:
                pass

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_in = f.name
    try:
        y, _ = librosa.load(tmp_in, sr=16000, mono=True)
        buf = io.BytesIO()
        sf.write(buf, y, 16000, format="WAV", subtype="PCM_16")
        wav_bytes = buf.getvalue()
        return wav_bytes, base64.b64encode(wav_bytes).decode("utf-8"), "wav"
    except Exception as e:
        print(f"[mood:stt] wav conversion failed, using raw audio: {e}")
        raw = audio_bytes
        return raw, base64.b64encode(raw).decode("utf-8"), _audio_format_from_suffix(suffix)
    finally:
        try:
            os.unlink(tmp_in)
        except Exception:
            pass


def _parse_stt_response(data: dict) -> str:
    """Normalise transcription text from various provider response shapes."""
    for key in ("text", "transcript", "transcription"):
        val = data.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    if isinstance(data.get("choices"), list) and data["choices"]:
        msg = data["choices"][0].get("message", {})
        content = msg.get("content", "")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return ""


def _transcribe_local_whisper(wav_bytes: bytes) -> dict | None:
    """Free on-device Whisper — no API key, works offline after first model download."""
    global _whisper_model, _whisper_failed
    if _whisper_failed:
        return None
    try:
        if _whisper_model is None:
            from faster_whisper import WhisperModel
            print("[mood:whisper] loading local model (first run downloads ~150 MB)...")
            _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    except Exception as e:
        print(f"[mood:whisper] unavailable: {e}")
        _whisper_failed = True
        return None

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        path = f.name
    try:
        segments, info = _whisper_model.transcribe(
            path, beam_size=5, vad_filter=True, task="transcribe",
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        if text:
            lang = getattr(info, "language", None) or "unknown"
            print(f"[mood:whisper] lang={lang} transcript='{text}'")
            return {
                "transcript": text,
                "model":      "faster-whisper-base",
                "source":     "local_whisper",
                "language":   lang,
            }
    except Exception as e:
        print(f"[mood:whisper] transcribe failed: {e}")
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass
    return None


def _transcribe_groq(wav_bytes: bytes) -> dict | None:
    """Groq free-tier Whisper — set GROQ_API_KEY (free at console.groq.com)."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        print("[mood:stt:groq] trying whisper-large-v3")
        response = httpx.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": ("audio.wav", wav_bytes, "audio/wav")},
            data={"model": "whisper-large-v3", "response_format": "json", "temperature": "0"},
            timeout=60.0,
        )
        if response.status_code >= 400:
            print(f"[mood:stt:groq] HTTP {response.status_code}: {response.text[:400]}")
            return None
        text = _parse_stt_response(response.json())
        if text:
            print(f"[mood:stt:groq] transcript='{text}'")
            return {"transcript": text, "model": "whisper-large-v3", "source": "groq_whisper"}
    except Exception as e:
        print(f"[mood:stt:groq] failed: {e}")
    return None


def _transcribe_openrouter_stt(audio_b64: str, audio_format: str) -> dict | None:
    """Dedicated /audio/transcriptions endpoint — requires OpenRouter audio credits ($0.50+)."""
    global _openrouter_audio_blocked
    if _openrouter_audio_blocked:
        return None
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("[mood:stt] No OPENROUTER_API_KEY")
        return None

    for model in STT_MODELS:
        try:
            print(f"[mood:stt] trying model={model} format={audio_format}")
            response = httpx.post(
                "https://openrouter.ai/api/v1/audio/transcriptions",
                headers=_openrouter_headers(api_key),
                json={
                    "model":       model,
                    "input_audio": {"data": audio_b64, "format": audio_format},
                    "temperature": 0,
                },
                timeout=60.0,
            )
            if response.status_code >= 400:
                print(f"[mood:stt] {model} HTTP {response.status_code}: {response.text[:400]}")
                if response.status_code == 402:
                    _openrouter_audio_blocked = True
                    print("[mood:stt] OpenRouter audio blocked (402) — skipping paid audio for this session")
                    return None
                continue
            data = response.json()
            text = _parse_stt_response(data)
            if text:
                print(f"[mood:stt] model={model} transcript='{text}'")
                return {"transcript": text, "model": model, "source": "openrouter_stt"}
        except Exception as e:
            print(f"[mood:stt] {model} failed: {e}")

    return None


def _transcribe_via_chat(audio_b64: str, audio_format: str) -> dict | None:
    """Multimodal chat fallback — requires OpenRouter audio credits."""
    global _openrouter_audio_blocked
    if _openrouter_audio_blocked:
        return None
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None

    prompt = """You are a professional multilingual speech-to-text transcriber.

Listen to this audio and write EXACTLY what the person said.

RULES:
- Use the original language and writing system (Arabic, Devanagari, Latin, CJK, etc.)
- Do NOT translate to English
- Do NOT paraphrase, summarize, or explain
- If no speech is detected, respond with exactly: [silence]

Return ONLY the spoken words as plain text. No JSON, no markdown, no quotes."""

    for model in STT_CHAT_MODELS:
        try:
            print(f"[mood:stt:chat] trying model={model}")
            response = httpx.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=_openrouter_headers(api_key),
                json={
                    "model": model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "input_audio",
                                "input_audio": {"data": audio_b64, "format": audio_format},
                            },
                        ],
                    }],
                    "max_tokens":  400,
                    "temperature": 0,
                },
                timeout=60.0,
            )
            if response.status_code >= 400:
                print(f"[mood:stt:chat] {model} HTTP {response.status_code}: {response.text[:400]}")
                if response.status_code == 402:
                    _openrouter_audio_blocked = True
                    return None
                continue
            text = response.json()["choices"][0]["message"]["content"].strip()
            if text.startswith("```"):
                text = text.split("```")[1].strip()
                if text.startswith("text"):
                    text = text[4:].strip()
            if text.startswith('"') and text.endswith('"'):
                text = text[1:-1].strip()
            if text and text != "[silence]" and len(text) > 1:
                print(f"[mood:stt:chat] model={model} transcript='{text}'")
                return {"transcript": text, "model": model, "source": "chat_stt"}
        except Exception as e:
            print(f"[mood:stt:chat] {model} failed: {e}")

    return None


def _transcribe_openai_direct(wav_bytes: bytes) -> dict | None:
    """Optional direct OpenAI Whisper if OPENAI_API_KEY is set."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    for model in ("whisper-1",):
        try:
            print(f"[mood:stt:openai] trying model={model}")
            response = httpx.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": ("audio.wav", wav_bytes, "audio/wav")},
                data={"model": model, "response_format": "json", "temperature": "0"},
                timeout=60.0,
            )
            if response.status_code >= 400:
                print(f"[mood:stt:openai] HTTP {response.status_code}: {response.text[:400]}")
                continue
            text = _parse_stt_response(response.json())
            if text:
                print(f"[mood:stt:openai] transcript='{text}'")
                return {"transcript": text, "model": model, "source": "openai_whisper"}
        except Exception as e:
            print(f"[mood:stt:openai] failed: {e}")

    return None


def _transcribe_audio(wav_bytes: bytes, audio_b64: str, audio_format: str) -> dict | None:
    """Try providers until one returns text. OpenRouter first when key is set."""
    has_openrouter = bool(os.getenv("OPENROUTER_API_KEY")) and not _openrouter_audio_blocked

    cloud = (
        (_transcribe_openrouter_stt, (audio_b64, audio_format)),
        (_transcribe_via_chat,       (audio_b64, audio_format)),
    )
    local = (
        (_transcribe_local_whisper, (wav_bytes,)),
        (_transcribe_groq,          (wav_bytes,)),
        (_transcribe_openai_direct, (wav_bytes,)),
    )
    order = cloud + local if has_openrouter else local + cloud

    for fn, args in order:
        result = fn(*args)
        if result:
            return result

    print("[mood:stt] all STT providers failed")
    return None


def _resolve_language(
    transcript:    str,
    stt_result:    dict | None,
    language_hint: str,
) -> str:
    if stt_result:
        lang = (stt_result.get("language") or "").lower().split("-")[0]
        if len(lang) == 2 and lang != "unknown":
            return lang
    if language_hint:
        lang = language_hint.lower().split("-")[0]
        if len(lang) == 2:
            return lang
    if transcript.strip():
        detected = _detect_language_from_text(transcript)
        if detected != "unknown":
            return detected
    return "unknown"


def _mood_from_transcript(
    transcript:    str,
    stt_source:    str,
    language_hint: str,
    stt_result:    dict | None,
    region:        str,
    feats:         dict,
) -> dict:
    """Mood detection from text only — avoids paid OpenRouter audio."""
    detected_lang = _resolve_language(transcript, stt_result, language_hint)
    ac_arousal    = min(feats.get("energy", 0.005) * 20, 1.0)

    text_result = _gemini_text_agent(text=transcript, region=region)
    if text_result:
        return {
            "transcript":   transcript,
            "language":     detected_lang,
            "top_emotion":  text_result["top_emotion"],
            "confidence":   round(text_result["confidence"], 3),
            "valence":      normalise(text_result["valence"]),
            "arousal":      round(0.6 * text_result.get("arousal", 0.5) + 0.4 * ac_arousal, 3),
            "reasoning":    text_result.get("reasoning", ""),
            "method":       f"transcript_{stt_source}",
            "all_emotions": text_result.get("all_emotions", []),
        }

    fb = _classifier_emotion(transcript, feats)
    return {
        "transcript":   transcript,
        "language":     detected_lang,
        "top_emotion":  fb["top_emotion"],
        "confidence":   fb["confidence"],
        "valence":      normalise(fb["valence"]),
        "arousal":      fb["arousal"],
        "reasoning":    fb.get("reasoning") or f'You said: "{transcript}"',
        "method":       f"transcript_hf_{stt_source}",
        "all_emotions": fb["all_emotions"],
    }


def _detect_language_from_text(text: str) -> str:
    """Lightweight language ID for display — ISO 639-1."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key or not text.strip():
        return "unknown"

    prompt = f"""Identify the language of this text. Return ONLY a JSON object:
{{"language": "<ISO 639-1 code, e.g. en, ar, ne, hi, fr>"}}

Text: "{text[:500]}\""""

    try:
        response = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=_openrouter_headers(api_key),
            json={
                "model":       "google/gemini-2.0-flash-001",
                "messages":    [{"role": "user", "content": prompt}],
                "max_tokens":  30,
                "temperature": 0,
            },
            timeout=10.0,
        )
        response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        result = json.loads(raw.strip())
        lang = (result.get("language") or "unknown").lower().split("-")[0]
        return lang if len(lang) == 2 else "unknown"
    except Exception as e:
        print(f"[mood:lang] detection failed: {e}")
        return "unknown"


# ── Gemini Audio Agent ────────────────────────────────────────────────────────
def _gemini_audio_agent(
    audio_b64: str,
    audio_format: str,
    acoustic:  dict,
    region:    str = "",
    transcript: str = "",
) -> dict | None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("[mood:audio] No OPENROUTER_API_KEY")
        return None

    transcript_block = (
        f'\nVERIFIED TRANSCRIPT (use exactly as written — do NOT translate or rephrase):\n"{transcript}"\n'
        if transcript.strip() else ""
    )

    prompt = f"""You are an expert emotion detection agent for Ekko, a music mood app for teenagers.
Listen to this audio clip carefully. The speaker may use ANY language or dialect
(Arabic عامية, Nepali, Hindi, French, Spanish, English, etc.).
{transcript_block}
YOUR TASKS:
1. {"Use the VERIFIED TRANSCRIPT above verbatim in your JSON" if transcript.strip() else "Transcribe exactly what was said in the ORIGINAL script and language — do NOT translate"}
2. Identify the language code (ar, en, ne, hi, fr, etc.)
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
                                "type": "input_audio",
                                "input_audio": {
                                    "data":   audio_b64,
                                    "format": audio_format,
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
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
Accurately detect the emotional state from what a teenager wrote or said. They may write in ANY language
including Arabic dialects, Nepali, Hindi, Tamil, French, Spanish, English, etc.

WHAT THEY WROTE (original language — do NOT translate):
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
    audio:           UploadFile = File(...),
    user_id:         str = Form(default=""),
    region:          str = Form(default=""),
    transcript_hint: str = Form(default=""),
    language_hint:   str = Form(default=""),
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

    if len(audio_bytes) < 1000:
        print(f"[mood] warning: very short audio ({len(audio_bytes)} bytes)")

    feats = extract_acoustic_features(audio_bytes, suffix=suffix)
    print(f"[mood] acoustic: {feats}")

    wav_bytes, audio_b64, audio_format = _convert_to_wav(audio_bytes, suffix=suffix)

    stt_result = _transcribe_audio(wav_bytes, audio_b64, audio_format)
    stt_transcript = stt_result.get("transcript", "") if stt_result else ""

    if not stt_transcript and transcript_hint.strip():
        stt_transcript = transcript_hint.strip()
        print(f"[mood] using browser speech hint: '{stt_transcript}'")

    if stt_transcript:
        stt_source = (stt_result or {}).get("source", "browser_hint")
        print(f"[mood] final transcript: '{stt_transcript}' (source={stt_source})")
        result = _mood_from_transcript(
            stt_transcript, stt_source, language_hint, stt_result, region, feats,
        )
        _persist_mood_log(
            user_id, result["valence"], result["arousal"], result["top_emotion"],
            result["transcript"], result["confidence"], feats,
            region, result["language"], result["reasoning"],
        )
        return {**result, "acoustic": feats}

    # No transcript — try paid audio mood only if enabled (requires OpenRouter audio credits)
    audio_result = None
    if not _openrouter_audio_blocked and os.getenv("OPENROUTER_AUDIO_ENABLED", "").lower() == "true":
        audio_result = _gemini_audio_agent(
            audio_b64    = audio_b64,
            audio_format = audio_format,
            acoustic     = feats,
            region       = region,
            transcript   = "",
        )

    if audio_result:
        transcript    = audio_result.get("transcript", "")
        detected_lang = (audio_result.get("language") or language_hint or "unknown").lower().split("-")[0]
        if detected_lang in ("unknown", "") or len(detected_lang) != 2:
            detected_lang = _detect_language_from_text(transcript) if transcript else (
                language_hint.lower().split("-")[0] if language_hint else "unknown"
            )
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
            if detected_lang in ("unknown", "") or len(str(detected_lang)) != 2:
                detected_lang = _detect_language_from_text(transcript) if transcript else "unknown"
            method        = blended["method"]
            print(f"[mood] blend result: {method} → emotion={top_emotion} confidence={confidence}")
        elif audio_emotion in UNKNOWN_EMOTIONS:
            print("[mood] audio UNKNOWN + text failed → HF fallback")
            fb           = _classifier_emotion(transcript or "I feel something", feats)
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
        print("[mood] no transcript — acoustic-only fallback (install faster-whisper or add GROQ_API_KEY)")
        fb            = _classifier_emotion("I feel something", feats)
        transcript    = ""
        detected_lang = language_hint.lower().split("-")[0] if language_hint else "unknown"
        top_emotion   = fb["top_emotion"]
        raw_valence   = fb["valence"]
        arousal       = fb["arousal"]
        confidence    = fb["confidence"]
        reasoning     = "Could not transcribe speech. Try speaking for 2–3 seconds, or use the Text tab."
        all_emotions  = fb["all_emotions"]
        method        = "acoustic_only"

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


@router.delete("/log/{log_id}", summary="Delete a mood log entry")
async def delete_mood_log(log_id: str):
    sb = _get_supabase()
    if not sb:
        raise HTTPException(503, "Supabase not configured")
    try:
        resp = sb.table("mood_logs").delete().eq("id", log_id).execute()
        if not resp.data:
            raise HTTPException(404, "Mood log not found")
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[mood] delete failed: {e}")
        raise HTTPException(500, str(e))