"""
Ekko — Layer 3 + 4: Cultural Context Filter + AI Music Co-Creation
POST /music/generate        → lyrics + Sonauto song (with artist style)
GET  /music/status/{task_id}→ poll Sonauto generation
POST /music/save            → persist finished song to Supabase
GET  /music/history/{user_id} → songs grouped by region
GET  /music/artist-styles   → list available artist-style voices per region
"""
from __future__ import annotations
import asyncio
import os
import httpx
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, Response, StreamingResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/music", tags=["Layer 3+4 — Cultural Filter & AI Co-Creation"])

SONAUTO_BASE     = "https://api.sonauto.ai/v1"
SONAUTO_GENERATE = f"{SONAUTO_BASE}/generations/v3"
SONAUTO_STATUS   = f"{SONAUTO_BASE}/generations"
OPENROUTER_URL   = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS = [
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash-001",
    "openai/gpt-4o-mini",
    "meta-llama/llama-3.3-70b-instruct:free",
]

MOCK_MODE      = False
MOCK_AUDIO_URL = "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb3c0d42b.mp3"

_ALLOWED_AUDIO_HOST_SUFFIXES = (
    "sonauto.ai",          # cdn.sonauto.ai, api.sonauto.ai, etc.
    "cdn.sonauto.ai",
    "amazonaws.com",
    "cloudfront.net",
    "r2.dev",
    "pixabay.com",
    "digitaloceanspaces.com",
    "googleusercontent.com",
    "soundhelix.com",
)

_task_audio_cache: dict[str, str] = {}

# ── Plan limits (keep in sync with frontend/src/utils/planUtils.js) ─────────
PLAN_DAILY_LIMITS = {
    "free":   5,
    "groove": 50,
    "studio": None,
}
FREE_REGION_IDS = {"global"}
FREE_CORE_EMOTIONS = {
    "joy", "sadness", "anger", "fear", "surprise", "disgust", "neutral",
}
NUANCED_TO_CORE = {
    "nostalgia": "sadness", "exhaustion": "sadness", "loneliness": "sadness", "grief": "sadness",
    "frustration": "anger", "passion": "anger",
    "euphoria": "joy", "tenderness": "joy",
    "calm": "neutral", "hope": "neutral", "wonder": "surprise",
    "bittersweet": "sadness", "fedup": "disgust",
}

# ── Artist styles per region ──────────────────────────────────────────────────
ARTIST_STYLES = {
    "arabic": [
        { "id": "amr_style",      "label": "Amr Diab",         "description": "Egyptian romantic pop, warm & soulful",       "artist_name": "Amr Diab"         },
        { "id": "fairuz_style",   "label": "Fairuz",            "description": "Classic Lebanese, celestial & timeless",      "artist_name": "Fairuz"           },
        { "id": "sherine_style",  "label": "Sherine",           "description": "Egyptian female pop, bright & uplifting",     "artist_name": "Sherine"          },
        { "id": "kadim_style",    "label": "Kadim Al Saher",    "description": "Iraqi romantic, powerful & poetic",           "artist_name": "Kadim Al Saher"   },
        { "id": "marwan_style",   "label": "Marwan Khoury",     "description": "Lebanese romantic, melodic & tender",        "artist_name": "Marwan Khoury"    },
        { "id": "tamer_style",    "label": "Tamer Hosny",       "description": "Egyptian pop, youthful & energetic",         "artist_name": "Tamer Hosny"      },
        { "id": "elissa_style",   "label": "Elissa",            "description": "Lebanese female, emotional & dramatic",       "artist_name": "Elissa"           },
        { "id": "nancy_style",    "label": "Nancy Ajram",       "description": "Lebanese pop, sweet & vibrant",              "artist_name": "Nancy Ajram"      },
        { "id": "wael_style",     "label": "Wael Kfoury",       "description": "Lebanese male, deep & heartfelt",            "artist_name": "Wael Kfoury"      },
        { "id": "abdel_style",    "label": "Abdel Halim Hafez", "description": "Egyptian legend, golden era classic",        "artist_name": "Abdel Halim Hafez"},
        { "id": "umm_style",      "label": "Umm Kulthum",       "description": "Egyptian legend, powerful & iconic",         "artist_name": "Umm Kulthum"      },
        { "id": "assala_style",   "label": "Assala",            "description": "Syrian female, emotional & strong",          "artist_name": "Assala"           },
        { "id": "ragheb_style",   "label": "Ragheb Alama",      "description": "Lebanese male, upbeat & romantic",           "artist_name": "Ragheb Alama"     },
        { "id": "george_style",   "label": "George Wassouf",    "description": "Syrian tarab, deep & soulful",               "artist_name": "George Wassouf"   },
        { "id": "haifa_style",    "label": "Haifa Wehbe",       "description": "Lebanese pop, bold & glamorous",             "artist_name": "Haifa Wehbe"      },
    ],
    "west_africa": [
        { "id": "burna_style",    "label": "Burna Boy",         "description": "Afrobeats, husky & powerful",                "artist_name": "Burna Boy"        },
        { "id": "wizkid_style",   "label": "Wizkid",            "description": "Afrobeats, smooth & groovy",                 "artist_name": "Wizkid"           },
        { "id": "tiwa_style",     "label": "Tiwa Savage",       "description": "Afropop female, powerful & soulful",         "artist_name": "Tiwa Savage"      },
        { "id": "davido_style",   "label": "Davido",            "description": "Energetic Afrobeats, anthemic",              "artist_name": "Davido"           },
        { "id": "rema_style",     "label": "Rema",              "description": "Afrorave, calm & hypnotic",                  "artist_name": "Rema"             },
        { "id": "tems_style",     "label": "Tems",              "description": "Afrosoul female, deep & sultry",             "artist_name": "Tems"             },
        { "id": "ckay_style",     "label": "CKay",              "description": "Afropop, romantic & danceable",              "artist_name": "CKay"             },
        { "id": "fireboy_style",  "label": "Fireboy DML",       "description": "Afropop, emotional & melodic",               "artist_name": "Fireboy DML"      },
    ],
    "india": [
        { "id": "arijit_style",   "label": "Arijit Singh",      "description": "Bollywood male, soft & deeply emotional",    "artist_name": "Arijit Singh"     },
        { "id": "shreya_style",   "label": "Shreya Ghoshal",    "description": "Bollywood female, melodic & expressive",     "artist_name": "Shreya Ghoshal"   },
        { "id": "ar_style",       "label": "AR Rahman",         "description": "Fusion cinematic, layered & world-class",    "artist_name": "AR Rahman"        },
        { "id": "sonu_style",     "label": "Sonu Nigam",        "description": "Classic Bollywood male, versatile",          "artist_name": "Sonu Nigam"       },
        { "id": "neha_style",     "label": "Neha Kakkar",       "description": "Upbeat Bollywood female, peppy",             "artist_name": "Neha Kakkar"      },
        { "id": "atif_style",     "label": "Atif Aslam",        "description": "Pakistani pop/Bollywood, romantic",          "artist_name": "Atif Aslam"       },
        { "id": "lata_style",     "label": "Lata Mangeshkar",   "description": "Legendary Indian female, pure & timeless",   "artist_name": "Lata Mangeshkar"  },
        { "id": "kishore_style",  "label": "Kishore Kumar",     "description": "Legendary Bollywood male, versatile",        "artist_name": "Kishore Kumar"    },
    ],
    "east_asia": [
        { "id": "bts_style",      "label": "BTS",               "description": "K-pop male group, polished & harmonic",      "artist_name": "BTS"              },
        { "id": "iu_style",       "label": "IU",                "description": "K-pop female, sweet & emotional",            "artist_name": "IU"               },
        { "id": "jay_style",      "label": "Jay Chou",          "description": "Mandarin pop, tender & melodic",             "artist_name": "Jay Chou"         },
        { "id": "yoasobi_style",  "label": "YOASOBI",           "description": "J-pop duo, airy & intense",                  "artist_name": "YOASOBI"          },
        { "id": "blackpink_style","label": "BLACKPINK",         "description": "K-pop female group, fierce & glamorous",     "artist_name": "BLACKPINK"        },
        { "id": "taeyeon_style",  "label": "Taeyeon",           "description": "K-pop female, emotive & powerful",           "artist_name": "Taeyeon"          },
        { "id": "gband_style",    "label": "G-Dragon",          "description": "K-pop/hip-hop, experimental & iconic",       "artist_name": "G-Dragon"         },
        { "id": "jjk_style",      "label": "Jung Kook",         "description": "K-pop male, smooth & charming",              "artist_name": "Jung Kook"        },
        { "id": "cpop_style",     "label": "G.E.M.",            "description": "Cantonese/Mandarin pop, powerful female",    "artist_name": "G.E.M."           },
        { "id": "utada_style",    "label": "Utada Hikaru",      "description": "J-pop legend, emotional & cinematic",        "artist_name": "Utada Hikaru"     },
    ],
    "latin": [
        { "id": "bad_bunny_style","label": "Bad Bunny",         "description": "Reggaeton/trap, cool & rhythmic",            "artist_name": "Bad Bunny"        },
        { "id": "shakira_style",  "label": "Shakira",           "description": "Latin pop, passionate & global",             "artist_name": "Shakira"          },
        { "id": "rosalia_style",  "label": "Rosalía",           "description": "Spanish flamenco-pop fusion, bold",          "artist_name": "Rosalía"          },
        { "id": "jbalvin_style",  "label": "J Balvin",          "description": "Urban Latin, vibrant & colorful",            "artist_name": "J Balvin"         },
        { "id": "karol_style",    "label": "Karol G",           "description": "Reggaeton female, fierce & empowering",      "artist_name": "Karol G"          },
        { "id": "maluma_style",   "label": "Maluma",            "description": "Latin pop/reggaeton, smooth & romantic",     "artist_name": "Maluma"           },
        { "id": "ozuna_style",    "label": "Ozuna",             "description": "Reggaeton, emotional & melodic",             "artist_name": "Ozuna"            },
        { "id": "juanbas_style",  "label": "Juan Luis Guerra",  "description": "Merengue/bachata, poetic & vibrant",        "artist_name": "Juan Luis Guerra" },
    ],
    "europe": [
        { "id": "coldplay_style", "label": "Coldplay",          "description": "British rock-pop, anthemic & uplifting",     "artist_name": "Coldplay"         },
        { "id": "adele_style",    "label": "Adele",             "description": "British soul pop, powerful & emotional",     "artist_name": "Adele"            },
        { "id": "stromae_style",  "label": "Stromae",           "description": "Belgian electronic pop, poetic & deep",      "artist_name": "Stromae"          },
        { "id": "eros_style",     "label": "Eros Ramazzotti",   "description": "Italian romantic pop, passionate",           "artist_name": "Eros Ramazzotti"  },
        { "id": "daft_style",     "label": "Daft Punk",         "description": "French electronic, iconic & futuristic",     "artist_name": "Daft Punk"        },
        { "id": "sia_style",      "label": "Sia",               "description": "Australian/European pop, powerful & dramatic","artist_name": "Sia"             },
        { "id": "bjork_style",    "label": "Björk",             "description": "Icelandic experimental, ethereal & unique",  "artist_name": "Björk"            },
        { "id": "abba_style",     "label": "ABBA",              "description": "Swedish pop, catchy & timeless",             "artist_name": "ABBA"             },
        { "id": "celine_style",   "label": "Céline Dion",       "description": "French-Canadian ballads, powerful soprano",  "artist_name": "Céline Dion"      },
        { "id": "freddie_style",  "label": "Freddie Mercury",   "description": "British rock legend, theatrical & powerful", "artist_name": "Freddie Mercury"  },
    ],
    "global": [
        { "id": "ed_style",       "label": "Ed Sheeran",        "description": "Acoustic pop, heartfelt storytelling",       "artist_name": "Ed Sheeran"       },
        { "id": "beyonce_style",  "label": "Beyoncé",           "description": "R&B pop, powerful & iconic",                 "artist_name": "Beyoncé"          },
        { "id": "weeknd_style",   "label": "The Weeknd",        "description": "Dark R&B, atmospheric & emotional",          "artist_name": "The Weeknd"       },
        { "id": "taylor_style",   "label": "Taylor Swift",      "description": "Pop storytelling, emotional depth",          "artist_name": "Taylor Swift"     },
        { "id": "drake_style",    "label": "Drake",             "description": "Hip-hop/R&B, smooth & introspective",        "artist_name": "Drake"            },
        { "id": "billie_style",   "label": "Billie Eilish",     "description": "Alt-pop, whispery & atmospheric",            "artist_name": "Billie Eilish"    },
        { "id": "ariana_style",   "label": "Ariana Grande",     "description": "Pop, bright vocal runs & emotional",         "artist_name": "Ariana Grande"    },
        { "id": "sza_style",      "label": "SZA",               "description": "R&B, soulful & vulnerable",                  "artist_name": "SZA"              },
        { "id": "frank_style",    "label": "Frank Ocean",       "description": "R&B, introspective & ethereal",              "artist_name": "Frank Ocean"      },
        { "id": "kendrick_style", "label": "Kendrick Lamar",    "description": "Hip-hop, lyrical & powerful",                "artist_name": "Kendrick Lamar"   },
        { "id": "michael_style",  "label": "Michael Jackson",   "description": "Pop legend, iconic & energetic",             "artist_name": "Michael Jackson"  },
        { "id": "mariah_style",   "label": "Mariah Carey",      "description": "R&B/pop, powerful vocal range",              "artist_name": "Mariah Carey"     },
        { "id": "eminem_style",   "label": "Eminem",            "description": "Hip-hop, intense & lyrical",                 "artist_name": "Eminem"           },
        { "id": "rihanna_style",  "label": "Rihanna",           "description": "Pop/R&B, cool & powerful",                   "artist_name": "Rihanna"          },
        { "id": "post_style",     "label": "Post Malone",       "description": "Pop/hip-hop, melodic & emotional",           "artist_name": "Post Malone"      },
        { "id": "dua_style",      "label": "Dua Lipa",          "description": "Pop, disco-influenced & confident",          "artist_name": "Dua Lipa"         },
        { "id": "harry_style",    "label": "Harry Styles",      "description": "Pop rock, retro & charming",                 "artist_name": "Harry Styles"     },
        { "id": "olivia_style",   "label": "Olivia Rodrigo",    "description": "Pop rock, raw & emotional",                  "artist_name": "Olivia Rodrigo"   },
    ],
}

LANGUAGE_INSTRUCTIONS = {
    "ar-eg":   "Egyptian Arabic dialect (عامية مصرية) — conversational, warm, everyday speech. NOT formal فصحى.",
    "ar-lv":   "Levantine Arabic dialect (عامية شامية) — Lebanese/Syrian conversational style.",
    "ar-gulf": "Gulf Arabic dialect (خليجي) — conversational Gulf/Saudi style.",
    "ar-ma":   "Moroccan Darija (دارجة مغربية) — Moroccan dialect.",
    "ar":      "Arabic (Egyptian dialect — conversational عامية, NOT formal فصحى)",
    "en":      "English — natural, poetic, conversational.",
    "fr":      "French — poetic, romantic, conversational.",
    "hi":      "Hindi (Devanagari script) — conversational Bollywood style, warm and emotive.",
    "ta":      "Tamil — poetic, South Indian lyrical style.",
    "zh":      "Mandarin Chinese (Simplified) — poetic, melodic, conversational pop style.",
    "ja":      "Japanese — poetic J-pop style, mix of kanji and hiragana.",
    "ko":      "Korean — K-pop style, warm and emotive, conversational Hangul.",
    "es":      "Spanish (Latin American) — passionate, conversational.",
    "pt":      "Brazilian Portuguese — warm, soulful, conversational.",
    "de":      "German — poetic, emotive, conversational.",
    "it":      "Italian — romantic, poetic, conversational.",
    "yo":      "Yoruba — lyrical, tonal.",
    "ha":      "Hausa — warm, conversational.",
    "pcm":     "Nigerian Pidgin English (Naija) — authentic street style.",
}

LANGUAGE_DISPLAY = {
    "ar-eg": "Egyptian Arabic", "ar-lv": "Levantine Arabic",
    "ar-gulf": "Gulf Arabic",   "ar-ma": "Moroccan Darija",
    "ar": "Arabic",             "en": "English",
    "fr": "French",             "hi": "Hindi",
    "ta": "Tamil",              "zh": "Mandarin",
    "ja": "Japanese",           "ko": "Korean",
    "es": "Spanish",            "pt": "Portuguese",
    "de": "German",             "it": "Italian",
    "yo": "Yoruba",             "ha": "Hausa",
    "pcm": "Nigerian Pidgin",
}

CULTURAL_STYLES = {
    "arabic":      "Arabic pop, oud, qanun, darbuka, Middle Eastern production",
    "west_africa": "Afrobeats, kora, djembe, vibrant West African percussion",
    "india":       "Bollywood, sitar, tabla, bansuri, cinematic Indian production",
    "east_asia":   "East Asian pop, guzheng, erhu, pentatonic melodies",
    "latin":       "Latin pop, guitar, trumpet, clave rhythm, passionate",
    "europe":      "European pop, piano, strings, cinematic orchestral",
    "global":      "global pop, piano, guitar, modern production",
}

REGION_LANGUAGE_DEFAULT = {
    "arabic": "ar-eg", "west_africa": "en", "india": "hi",
    "east_asia": "zh", "latin": "es",       "europe": "en", "global": "en",
}

REGION_VOCAL_STYLE = {
    "arabic":      "Arabic vocalist with maqam ornaments and emotional Middle Eastern delivery",
    "west_africa": "West African vocalist, warm soulful Afrobeats style",
    "india":       "Bollywood singer, emotive Hindi vocals, cinematic style",
    "east_asia":   "soft East Asian pop vocalist, melodic and tender",
    "latin":       "Latin pop singer, passionate Spanish vocals",
    "europe":      "European pop singer, clear and emotive vocals",
    "global":      "warm expressive pop vocalist",
}

REGION_DISPLAY = {
    "arabic": "🌙 Arabic",    "west_africa": "🥁 West Africa",
    "india":  "🪔 India",     "east_asia":   "🌸 East Asia",
    "latin":  "🎺 Latin",     "europe":      "🎻 Europe",
    "global": "🌍 Global Mix",
}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _mood_words(valence: float, energy: float) -> tuple[str, str]:
    val_word = (
        "joyful, uplifting, euphoric"         if valence > 0.6 else
        "bittersweet, longing, hopeful"       if valence > 0.3 else
        "melancholic, heartbroken, sorrowful"
    )
    en_word = (
        "energetic, powerful, anthemic" if energy > 0.7 else
        "moderate, flowing, groovy"     if energy > 0.4 else
        "slow, tender, intimate"
    )
    return val_word, en_word


def _sonauto_headers() -> dict:
    key = os.getenv("SONAUTO_API_KEY")
    if not key:
        raise HTTPException(500, "SONAUTO_API_KEY not set in .env")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _normalize_audio_url(url: str | None) -> str | None:
    """Sonauto sometimes returns a CDN path without https:// host."""
    if not url or not str(url).strip():
        return None
    u = str(url).strip()
    if u.startswith("http://") or u.startswith("https://"):
        return u
    if u.startswith("//"):
        return f"https:{u}"
    if u.startswith("/"):
        return f"https://cdn.sonauto.ai{u}"
    return f"https://cdn.sonauto.ai/{u.lstrip('/')}"


def _extract_audio_url(data: dict) -> str | None:
    raw = (
        data.get("audio_url") or data.get("output_url") or data.get("url")
        or (data.get("song_paths") or [None])[0]
    )
    return _normalize_audio_url(raw)


def _is_allowed_audio_url(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower()
        if not host.startswith("http"):
            host = urlparse(f"https://{url}").netloc.lower()
        if host == "sonauto.ai" or host.endswith(".sonauto.ai"):
            return True
        return any(host == suffix or host.endswith(f".{suffix}") for suffix in _ALLOWED_AUDIO_HOST_SUFFIXES)
    except Exception:
        return False


def _resolve_task_audio_url(task_id: str) -> str:
    if task_id == "mock":
        return MOCK_AUDIO_URL
    if task_id in _task_audio_cache:
        return _task_audio_cache[task_id]

    res = httpx.get(f"{SONAUTO_STATUS}/{task_id}", headers=_sonauto_headers(), timeout=15)
    res.raise_for_status()
    data = res.json()
    state = (data.get("state") or data.get("status") or "UNKNOWN").upper()
    if state not in ("SUCCESS", "COMPLETED", "COMPLETE", "DONE"):
        raise HTTPException(409, f"Audio not ready (state={state})")

    audio_url = _extract_audio_url(data)
    if not audio_url:
        raise HTTPException(404, "No audio URL for this task")
    audio_url = _normalize_audio_url(audio_url) or audio_url
    if not _is_allowed_audio_url(audio_url):
        host = urlparse(audio_url).netloc
        raise HTTPException(502, f"Audio host not allowed: {host}")

    _task_audio_cache[task_id] = audio_url
    return audio_url


def _guess_audio_content_type(url: str, upstream: str | None) -> str:
    raw = (upstream or "").split(";")[0].strip().lower()
    if raw and ("audio" in raw or raw in ("application/octet-stream", "binary/octet-stream")):
        return raw.split(";")[0].strip() or "audio/mpeg"
    path = urlparse(url).path.lower()
    if path.endswith(".wav"):
        return "audio/wav"
    if path.endswith(".ogg"):
        return "audio/ogg"
    if path.endswith(".m4a") or path.endswith(".mp4"):
        return "audio/mp4"
    return "audio/mpeg"


async def _proxy_audio_response(url: str, range_header: str | None = None) -> Response:
    """Proxy audio through Ekko (buffered — reliable on Render; supports Range)."""
    url = _normalize_audio_url(url) or url
    if not _is_allowed_audio_url(url):
        host = urlparse(url).netloc or url[:80]
        raise HTTPException(400, f"Audio URL host not allowed: {host}")

    upstream_headers: dict[str, str] = {}
    if range_header:
        upstream_headers["Range"] = range_header

    def _fetch():
        with httpx.Client(timeout=90.0, follow_redirects=True) as client:
            return client.get(url, headers=upstream_headers or None)

    try:
        res = await asyncio.to_thread(_fetch)
        if res.status_code >= 400:
            raise HTTPException(502, f"Upstream audio error {res.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Could not fetch audio: {e}") from e

    content_type = _guess_audio_content_type(url, res.headers.get("content-type"))
    out_headers = {
        "Cache-Control": "public, max-age=3600",
        "Accept-Ranges": "bytes",
        "Content-Disposition": "inline",
        "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length, Content-Type",
    }
    for name in ("Content-Range", "Content-Length"):
        if name in res.headers:
            out_headers[name] = res.headers[name]
    if "Content-Length" not in out_headers and res.content:
        out_headers["Content-Length"] = str(len(res.content))

    status = res.status_code if res.status_code in (200, 206) else 200
    return Response(content=res.content, status_code=status, media_type=content_type, headers=out_headers)


def _openrouter_headers() -> dict:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        raise HTTPException(500, "OPENROUTER_API_KEY not set in .env")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://ekko.app",
        "X-Title":       "Ekko Musical Mood Journeys",
    }


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


def _get_user_plan(sb, user_id: str) -> str:
    if not sb or not user_id:
        return "free"
    try:
        resp = sb.table("profiles").select("plan").eq("id", user_id).single().execute()
        plan = (resp.data or {}).get("plan") or "free"
        return plan if plan in PLAN_DAILY_LIMITS else "free"
    except Exception:
        return "free"


def _count_today_generations(sb, user_id: str) -> int:
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    try:
        resp = (
            sb.table("mood_sessions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", today_start)
            .execute()
        )
        if resp.count is not None:
            return resp.count
    except Exception:
        pass
    try:
        resp = (
            sb.table("songs")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", today_start)
            .execute()
        )
        return resp.count or 0
    except Exception:
        return 0


def _clamp_emotion_for_plan(emotion: str, plan: str) -> str:
    if plan in ("groove", "studio"):
        return emotion
    if emotion in FREE_CORE_EMOTIONS:
        return emotion
    return NUANCED_TO_CORE.get(emotion, "neutral")


def _apply_plan_restrictions(req: "GenerateRequest", plan: str) -> None:
    if plan in ("groove", "studio"):
        return
    req.artist_style_id = ""
    if req.region not in FREE_REGION_IDS:
        req.region = "global"
    req.emotion = _clamp_emotion_for_plan(req.emotion, plan)


def _resolve_language(language_code: str, region: str) -> str:
    if language_code and language_code in LANGUAGE_INSTRUCTIONS:
        return language_code
    return REGION_LANGUAGE_DEFAULT.get(region, "en")


def _get_artist_style(region: str, artist_style_id: str) -> dict | None:
    for s in ARTIST_STYLES.get(region, []) + ARTIST_STYLES.get("global", []):
        if s["id"] == artist_style_id:
            return s
    return None


# ── NEW: Title generator ──────────────────────────────────────────────────────
def _generate_title(mood_label: str, emotion: str, lyrics: str) -> str:
    system_msg = (
        "You are a professional music artist naming your new song. "
        "Create a real, evocative song title — the kind you'd see on Spotify or Apple Music. "
        "It should feel poetic, emotional, and memorable. "
        "Output ONLY the title. No quotes, no explanation, no punctuation at the end. "
        "Max 5 words. Never use the emotion word directly (e.g. never write 'Joyful' or 'Sadness')."
    )
    user_msg = (
        f"The song expresses: {mood_label or emotion}\n"
        f"Opening lyrics: {lyrics[:150]}\n\n"
        f"Write a real song title for this. "
        f"Think like: 'Blinding Lights', 'Someone Like You', 'Shape of You', 'Let Her Go'. "
        f"Output ONLY the title."
    )
    for model in OPENROUTER_MODELS:
        try:
            res = httpx.post(
                OPENROUTER_URL,
                headers=_openrouter_headers(),
                json={
                    "model": model, "max_tokens": 20,
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user",   "content": user_msg},
                    ],
                },
                timeout=15,
            )
            res.raise_for_status()
            title = res.json()["choices"][0]["message"]["content"].strip()
            title = title.strip('"\'').strip()
            if title:
                print(f"[music] Title: {title}")
                return title
        except Exception as e:
            print(f"[music] {model} title failed: {e}")
    return mood_label or emotion


def _generate_lyrics(
    mood_text: str, mood_label: str, emotion: str,
    valence: float, energy: float, region: str, language_code: str = "",
) -> str:
    lang_code  = _resolve_language(language_code, region)
    lang_instr = LANGUAGE_INSTRUCTIONS.get(lang_code, "English — natural, poetic, conversational.")
    val_word, en_word = _mood_words(valence, energy)
    what_they_said    = mood_text or mood_label or emotion

    system_msg = (
        "You are a gifted songwriter. Write emotionally resonant song lyrics. "
        "Output ONLY the lyrics — no titles, no section labels like [Verse] or [Chorus], "
        "no explanations. Just the raw lyric text, poetic and natural."
    )
    user_msg = (
        f"Write song lyrics expressing this feeling:\n"
        f"The person said or felt: \"{what_they_said}\"\n"
        f"Emotion: {emotion}\n"
        f"Mood: {val_word}, {en_word}\n\n"
        f"LANGUAGE (CRITICAL — write ONLY in this language):\n{lang_instr}\n\n"
        f"Rules:\n"
        f"- 3 verses, each 3-4 lines, separated by blank lines.\n"
        f"- No explanations, no labels, just raw lyrics."
    )

    for model in OPENROUTER_MODELS:
        try:
            res = httpx.post(
                OPENROUTER_URL,
                headers=_openrouter_headers(),
                json={
                    "model": model, "max_tokens": 500,
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user",   "content": user_msg},
                    ],
                },
                timeout=30,
            )
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"]
            if content and content.strip():
                print(f"[music] Lyrics via {model} lang={lang_code}")
                return content.strip()
        except Exception as e:
            print(f"[music] {model} lyrics failed: {e}")

    return (
        f"I feel {mood_label or emotion} deep inside\n"
        f"These emotions I cannot hide\n\n"
        f"The music speaks what words cannot say\n"
        f"Carrying me through this {emotion} day\n\n"
        f"Let the melody carry me home\n"
        f"Through this feeling I'm not alone"
    )


def _build_style_prompt(
    valence: float, energy: float, region: str,
    mood_label: str, artist_name: str = "", plan: str = "free",
) -> str:
    val_word, en_word = _mood_words(valence, energy)
    style = CULTURAL_STYLES.get(region, CULTURAL_STYLES["global"])
    vocal = REGION_VOCAL_STYLE.get(region, REGION_VOCAL_STYLE["global"])
    tempo = "slow" if energy < 0.4 else "moderate" if energy < 0.7 else "upbeat"

    prompt = (
        f"{style}. "
        f"{vocal}. "
        f"Mood: {val_word}, {en_word}. "
        f"Tempo: {tempo}. "
        f"Feeling: {mood_label}. "
        f"Professional production, emotionally resonant."
    )
    if artist_name:
        prompt += f" Artist style inspired by {artist_name}."
    if plan in ("groove", "studio"):
        prompt += " High-fidelity HD master, crisp vocals, wide dynamic range."
    else:
        prompt += " Standard streaming quality."

    return prompt


def _license_for_plan(plan: str) -> str:
    return "commercial" if plan == "studio" else "personal"


# ── Request models ────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    user_id:         str   = ""
    mood_text:       str   = ""
    mood_label:      str   = ""
    valence:         float = 0.5
    energy:          float = 0.5
    emotion:         str   = "neutral"
    region:          str   = "global"
    language_code:   str   = ""
    tempo_bpm:       int   = 90
    scale:           str   = ""
    instruments:     list  = []
    artist_style_id: str   = ""


class SaveSongRequest(BaseModel):
    user_id:         str
    region:          str
    region_label:    str   = ""
    mood_label:      str   = ""
    emotion:         str   = "neutral"
    valence:         float = 0.5
    energy:          float = 0.5
    lyrics:          str   = ""
    audio_url:       str   = ""
    task_id:         str   = ""
    prompt_used:     str   = ""
    language:        str   = "English"
    language_code:   str   = ""
    artist_style_id: str   = ""
    artist_label:    str   = ""
    title:           str   = ""   # ← NEW


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/artist-styles", summary="List artist-style personas per region")
async def list_artist_styles(region: str = ""):
    if region:
        return {"region": region, "styles": ARTIST_STYLES.get(region, ARTIST_STYLES["global"])}
    return {"styles": ARTIST_STYLES}


@router.post("/generate", summary="Generate lyrics + Sonauto song with artist style")
async def generate_music(req: GenerateRequest):
    sb = _get_supabase()
    plan = _get_user_plan(sb, req.user_id) if req.user_id else "free"

    if req.user_id and sb:
        daily_limit = PLAN_DAILY_LIMITS.get(plan, PLAN_DAILY_LIMITS["free"])
        if daily_limit is not None:
            used = _count_today_generations(sb, req.user_id)
            if used > daily_limit:
                raise HTTPException(
                    429,
                    detail={
                        "error": "daily_limit_reached",
                        "plan": plan,
                        "limit": daily_limit,
                        "used": used,
                        "message": f"Daily generation limit reached ({used}/{daily_limit}). Upgrade for more.",
                    },
                )

    _apply_plan_restrictions(req, plan)

    mood_label   = req.mood_label or req.emotion
    region_label = REGION_DISPLAY.get(req.region, req.region)
    lang_code    = _resolve_language(req.language_code, req.region)
    lang_display = LANGUAGE_DISPLAY.get(lang_code, "English")

    artist_style = _get_artist_style(req.region, req.artist_style_id) if req.artist_style_id else None
    artist_name  = artist_style["artist_name"] if artist_style else ""
    artist_label = artist_style["label"]       if artist_style else ""

    if MOCK_MODE:
        return {
            "task_id":         "mock",
            "audio_url":       MOCK_AUDIO_URL,
            "prompt_used":     "Mock",
            "lyrics":          "Mock lyrics",
            "title":           "Echoes of Tomorrow",
            "region":          req.region,
            "region_label":    region_label,
            "language":        lang_display,
            "language_code":   lang_code,
            "artist_style_id": req.artist_style_id,
            "artist_label":    artist_label,
            "mock":            True,
            "status":          "SUCCESS",
        }

    print(f"[music] Generating | emotion={req.emotion} region={req.region} "
          f"lang={lang_code} artist={artist_name or 'default'}")

    lyrics = _generate_lyrics(
        mood_text=req.mood_text, mood_label=mood_label, emotion=req.emotion,
        valence=req.valence, energy=req.energy, region=req.region,
        language_code=lang_code,
    )
    print(f"[music] Lyrics:\n{lyrics}\n")

    # ── Generate song title ───────────────────────────────────────────────
    title = _generate_title(mood_label, req.emotion, lyrics)

    style_prompt = _build_style_prompt(
        req.valence, req.energy, req.region, mood_label, artist_name, plan
    )
    print(f"[music] Style prompt: {style_prompt}")

    sonauto_payload = {
        "prompt":       style_prompt,
        "lyrics":       lyrics,
        "instrumental": False,
    }
    if artist_name:
        sonauto_payload["artist"] = artist_name
        print(f"[music] Passing artist to Sonauto: {artist_name}")

    try:
        res = httpx.post(
            SONAUTO_GENERATE,
            headers=_sonauto_headers(),
            json=sonauto_payload,
            timeout=30,
        )
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Sonauto error {e.response.status_code}: {e.response.text}")
    except Exception as e:
        raise HTTPException(502, f"Sonauto error: {e}")

    data    = res.json()
    task_id = data.get("task_id") or data.get("id") or data.get("generation_id")
    print(f"[music] Sonauto task_id: {task_id}")

    if not task_id:
        raise HTTPException(502, f"Sonauto returned no task_id: {data}")

    return {
        "task_id":          task_id,
        "title":            title,
        "prompt_used":      style_prompt,
        "lyrics":           lyrics,
        "region":           req.region,
        "region_label":     region_label,
        "language":         lang_display,
        "language_code":    lang_code,
        "artist_style_id":  req.artist_style_id,
        "artist_label":     artist_label,
        "artist_name":      artist_name,
        "status":           "GENERATING",
        "mock":             False,
        "plan":             plan,
        "priority_queue":   plan in ("groove", "studio"),
        "audio_quality":    "hd" if plan in ("groove", "studio") else "standard",
    }


@router.get("/status/{task_id}", summary="Poll Sonauto generation status")
async def get_status(task_id: str):
    if task_id == "mock":
        return {"status": "SUCCESS", "audio_url": MOCK_AUDIO_URL, "mock": True}
    try:
        res = httpx.get(f"{SONAUTO_STATUS}/{task_id}", headers=_sonauto_headers(), timeout=15)
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Sonauto status error {e.response.status_code}: {e.response.text}")
    except Exception as e:
        raise HTTPException(502, f"Sonauto status error: {e}")

    data  = res.json()
    state = (data.get("state") or data.get("status") or "UNKNOWN").upper()
    print(f"[music] Poll task={task_id} state={state}")

    if state in ("SUCCESS", "COMPLETED", "COMPLETE", "DONE"):
        audio_url = _extract_audio_url(data)
        if audio_url and not _is_allowed_audio_url(audio_url):
            print(f"[music] WARN success but URL host odd: {urlparse(audio_url).netloc} url={audio_url[:100]}")
        return {
            "status": "SUCCESS",
            "audio_url": audio_url,
            "play_url": f"/music/stream/{task_id}",
        }
    if state in ("FAILURE", "FAILED", "ERROR"):
        return {"status": "FAILED", "error": data.get("error_message", "Unknown error")}
    return {"status": "GENERATING"}


@router.get("/open/{task_id}", summary="Redirect browser to Sonauto CDN audio (new tab)")
async def open_audio_by_task(task_id: str):
    """Safari/iOS can play the CDN file directly; API stream URLs often fail in a new tab."""
    try:
        url = _resolve_task_audio_url(task_id)
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Sonauto status error {e.response.status_code}") from e
    return RedirectResponse(url, status_code=302)


@router.get("/open", summary="Redirect browser to allowlisted audio URL")
async def open_audio_by_url(url: str = Query(..., min_length=8)):
    url = _normalize_audio_url(url) or url
    if not _is_allowed_audio_url(url):
        host = urlparse(url).netloc or url[:80]
        raise HTTPException(400, f"Audio URL host not allowed: {host}")
    return RedirectResponse(url, status_code=302)


@router.get("/stream/{task_id}", summary="Proxy audio for in-app playback (CORS-safe)")
async def stream_audio_by_task(task_id: str, request: Request):
    """Stream Sonauto audio through Ekko API so mobile browsers can play it."""
    try:
        url = _resolve_task_audio_url(task_id)
        print(f"[music] stream task={task_id} host={urlparse(url).netloc}")
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Sonauto status error {e.response.status_code}") from e
    return await _proxy_audio_response(url, request.headers.get("range"))


@router.get("/stream", summary="Proxy audio by URL (saved songs)")
async def stream_audio_by_url(request: Request, url: str = Query(..., min_length=8)):
    """Stream a previously saved audio URL through Ekko (allowlisted hosts only)."""
    url = _normalize_audio_url(url) or url
    print(f"[music] stream url host={urlparse(url).netloc}")
    return await _proxy_audio_response(url, request.headers.get("range"))


@router.get("/usage/{user_id}", summary="Daily generation usage for plan limits")
async def get_usage(user_id: str):
    sb = _get_supabase()
    plan = _get_user_plan(sb, user_id) if sb else "free"
    limit = PLAN_DAILY_LIMITS.get(plan, PLAN_DAILY_LIMITS["free"])
    used = _count_today_generations(sb, user_id) if sb else 0
    return {
        "plan": plan,
        "used": used,
        "limit": limit,
        "remaining": None if limit is None else max(0, limit - used),
    }


@router.post("/save", summary="Save finished song to Supabase")
async def save_song(req: SaveSongRequest):
    sb = _get_supabase()
    if not sb:
        return {"saved": False, "reason": "Supabase not configured"}
    plan = _get_user_plan(sb, req.user_id)
    license_type = _license_for_plan(plan)
    row_data = {
        "user_id": req.user_id, "region": req.region,
        "region_label": req.region_label or REGION_DISPLAY.get(req.region, req.region),
        "mood_label": req.mood_label, "emotion": req.emotion,
        "valence": req.valence, "energy": req.energy,
        "lyrics": req.lyrics, "audio_url": req.audio_url,
        "prompt_used": req.prompt_used, "language": req.language,
        "artist_style_id": req.artist_style_id, "artist_label": req.artist_label,
        "title": req.title, "is_favorite": False, "license": license_type,
    }
    # task_id column is optional — run backend/migrations/add_songs_task_id.sql first
    try:
        resp = sb.table("songs").insert(row_data).execute()
        row = (resp.data or [None])[0]
        print(f"[music] ✅ Song saved user={req.user_id} title={req.title} license={license_type}")
        return {"saved": True, "song": row, "license": license_type}
    except Exception as e:
        err = str(e)
        fallback = {k: v for k, v in row_data.items() if k not in ("is_favorite", "license")}
        if "license" in err:
            fallback.pop("license", None)
        if "is_favorite" in err:
            fallback.pop("is_favorite", None)
        if "task_id" in err:
            fallback.pop("task_id", None)
        try:
            resp = sb.table("songs").insert(fallback).execute()
            row = (resp.data or [None])[0]
            print(f"[music] ✅ Song saved (fallback columns) user={req.user_id}")
            return {"saved": True, "song": row, "license": license_type}
        except Exception as e2:
            print(f"[music] ❌ Save failed: {e2}")
            return {"saved": False, "reason": str(e2)}


@router.get("/history/{user_id}", summary="Songs grouped by region")
async def get_song_history(user_id: str):
    sb = _get_supabase()
    if not sb:
        return {"songs": [], "by_region": {}}
    resp = (
        sb.table("songs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    songs = resp.data or []
    for song in songs:
        song["is_favorite"] = bool(song.get("is_favorite"))
    by_region: dict[str, list] = {}
    for song in songs:
        r = song.get("region", "global")
        by_region.setdefault(r, []).append(song)
    return {"songs": songs, "by_region": by_region}


class UpdateSongRequest(BaseModel):
    user_id:     str
    title:       Optional[str]  = None
    is_favorite: Optional[bool] = None


@router.patch("/{song_id}", summary="Update song title or favorite status")
async def update_song(song_id: str, req: UpdateSongRequest):
    sb = _get_supabase()
    if not sb:
        raise HTTPException(503, "Supabase not configured")
    updates: dict = {}
    if req.title is not None:
        updates["title"] = req.title.strip()
    if req.is_favorite is not None:
        updates["is_favorite"] = req.is_favorite
    if not updates:
        raise HTTPException(400, "Nothing to update")
    try:
        resp = (
            sb.table("songs")
            .update(updates)
            .eq("id", song_id)
            .eq("user_id", req.user_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(404, "Song not found")
        return {"updated": True, "song": resp.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[music] update failed: {e}")
        raise HTTPException(500, str(e))


@router.delete("/{song_id}", summary="Delete a song from user library")
async def delete_song(song_id: str, user_id: str):
    sb = _get_supabase()
    if not sb:
        raise HTTPException(503, "Supabase not configured")
    if not user_id:
        raise HTTPException(400, "user_id required")
    try:
        resp = (
            sb.table("songs")
            .delete()
            .eq("id", song_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(404, "Song not found")
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[music] delete failed: {e}")
        raise HTTPException(500, str(e))


@router.get("/regions", summary="List available cultural regions")
async def list_regions():
    return {"regions": list(CULTURAL_STYLES.keys())}