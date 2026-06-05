"""Egyptian عامية mood phrases — used before generic AI/heuristics."""
from __future__ import annotations
import re

# (normalized phrases, core emotion, valence, arousal, reasoning snippet)
EGYPTIAN_MOOD_PHRASES: list[tuple[list[str], str, float, float, str]] = [
    (
        ["طفشان", "طفشانه", "طفشانة", "تفشان", "تفشانه", "تفشانه", "ana tafshan", "ana tafshana"],
        "disgust",
        0.30,
        0.42,
        "طفشان/طفشانه (Egyptian): bored, restless, fed up with everything — not sadness or failure.",
    ),
    (
        ["زهقت", "زهقان", "زهقانة", "زهقانه"],
        "disgust",
        0.28,
        0.45,
        "زهقت/زهقان (Egyptian): fed up, done — similar to طفشان.",
    ),
    (
        ["مبسوط", "مبسوطة", "مبسوطه", "فرحان", "فرحانه"],
        "joy",
        0.82,
        0.65,
        "مبسوط/فرحان (Egyptian): happy, pleased.",
    ),
    (
        ["تعبان", "تعبانه", "تعبانة", "تعبت", "تعبانه اوي"],
        "sadness",
        0.22,
        0.35,
        "تعبان/تعبت (Egyptian): emotionally drained, exhausted.",
    ),
    (
        ["مش قادر", "مش قادره", "مش قادرة", "مش قادره"],
        "fear",
        0.25,
        0.62,
        "مش قادر/ة (Egyptian): can't cope, overwhelmed.",
    ),
    (
        ["حاسه", "حاسس", "حاسة"],
        "neutral",
        0.0,
        0.4,
        "حاسه/حاسس (Egyptian): I feel — emotion depends on what follows.",
    ),
]


def normalize_arabic(text: str) -> str:
    t = (text or "").strip().lower()
    t = re.sub(r"[أإآٱ]", "ا", t)
    t = t.replace("ى", "ي").replace("ة", "ه")
    t = re.sub(r"[^\w\s\u0600-\u06FF]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def match_egyptian_slang(text: str) -> dict | None:
    """Return mood dict if Egyptian slang phrase matches."""
    norm = normalize_arabic(text)
    if not norm:
        return None
    for phrases, emotion, valence, arousal, reasoning in EGYPTIAN_MOOD_PHRASES:
        for phrase in phrases:
            p = normalize_arabic(phrase)
            if not p:
                continue
            if p in norm or norm in p:
                return {
                    "top_emotion": emotion,
                    "secondary_emotion": None,
                    "valence": valence,
                    "arousal": arousal,
                    "confidence": 0.88,
                    "reasoning": reasoning,
                    "all_emotions": [{"label": emotion, "score": 0.88}],
                    "method": "egyptian_slang",
                }
    return None
