"""
Ekko — Layer 3 + 4: Cultural Context Filter + AI Music Co-Creation
POST /music/generate        → lyrics + Sonauto song (with artist style)
GET  /music/status/{task_id}→ poll Sonauto generation
POST /music/save            → persist finished song to Supabase
GET  /music/history/{user_id} → songs grouped by region
GET  /music/artist-styles   → list available artist-style voices per region
"""
from __future__ import annotations
import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
 
class FavouriteRequest(BaseModel):
    user_id:      str
    is_favourite: bool
 
class DeleteSongRequest(BaseModel):
    user_id: strz

router = APIRouter(prefix="/music", tags=["Layer 3+4 — Cultural Filter & AI Co-Creation"])

SONAUTO_BASE     = "https://api.sonauto.ai/v1"
SONAUTO_GENERATE = f"{SONAUTO_BASE}/generations/v3"
SONAUTO_STATUS   = f"{SONAUTO_BASE}/generations"
OPENROUTER_URL   = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS = [
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5",
    "meta-llama/llama-3.3-70b-instruct:free",
]

MOCK_MODE      = False
MOCK_AUDIO_URL = "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb3c0d42b.mp3"

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
    mood_label: str, artist_name: str = "",
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

    return prompt


# ── Request models ────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
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
        req.valence, req.energy, req.region, mood_label, artist_name
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
        "title":            title,        # ← NEW
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
        audio_url = (
            data.get("audio_url") or data.get("output_url") or data.get("url")
            or (data.get("song_paths") or [None])[0]
        )
        return {"status": "SUCCESS", "audio_url": audio_url}
    if state in ("FAILURE", "FAILED", "ERROR"):
        return {"status": "FAILED", "error": data.get("error_message", "Unknown error")}
    return {"status": "GENERATING"}


@router.post("/save", summary="Save finished song to Supabase")
async def save_song(req: SaveSongRequest):
    sb = _get_supabase()
    if not sb:
        return {"saved": False, "reason": "Supabase not configured"}
    try:
        sb.table("songs").insert({
            "user_id":          req.user_id,
            "region":           req.region,
            "region_label":     req.region_label or REGION_DISPLAY.get(req.region, req.region),
            "mood_label":       req.mood_label,
            "emotion":          req.emotion,
            "valence":          req.valence,
            "energy":           req.energy,
            "lyrics":           req.lyrics,
            "audio_url":        req.audio_url,
            "prompt_used":      req.prompt_used,
            "language":         req.language,
            "artist_style_id":  req.artist_style_id,
            "artist_label":     req.artist_label,
            "title":            req.title,    # ← NEW
        }).execute()
        print(f"[music] ✅ Song saved user={req.user_id} title={req.title} artist={req.artist_label}")
        return {"saved": True}
    except Exception as e:
        print(f"[music] ❌ Save failed: {e}")
        return {"saved": False, "reason": str(e)}


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
    by_region: dict[str, list] = {}
    for song in songs:
        r = song.get("region", "global")
        by_region.setdefault(r, []).append(song)
    return {"songs": songs, "by_region": by_region}

@router.patch("/favourite/{song_id}", summary="Toggle favourite status for a song")
async def toggle_favourite(song_id: str, req: FavouriteRequest):
    sb = _get_supabase()
    if not sb:
        return {"ok": False, "reason": "Supabase not configured"}
    try:
        # Verify the song belongs to this user before updating
        check = sb.table("songs").select("id").eq("id", song_id).eq("user_id", req.user_id).single().execute()
        if not check.data:
            return {"ok": False, "reason": "Song not found or not owned by user"}
 
        sb.table("songs").update({"is_favourite": req.is_favourite}).eq("id", song_id).execute()
        print(f"[music] ❤️ Song {song_id} favourite={req.is_favourite}")
        return {"ok": True, "is_favourite": req.is_favourite}
    except Exception as e:
        print(f"[music] ❌ Favourite update failed: {e}")
        return {"ok": False, "reason": str(e)}
 
 
@router.delete("/song/{song_id}", summary="Delete a song permanently")
async def delete_song(song_id: str, req: DeleteSongRequest):
    sb = _get_supabase()
    if not sb:
        return {"ok": False, "reason": "Supabase not configured"}
    try:
        # Verify ownership before deleting
        check = sb.table("songs").select("id").eq("id", song_id).eq("user_id", req.user_id).single().execute()
        if not check.data:
            return {"ok": False, "reason": "Song not found or not owned by user"}
 
        sb.table("songs").delete().eq("id", song_id).execute()
        print(f"[music] 🗑️ Song {song_id} deleted by user {req.user_id}")
        return {"ok": True}
    except Exception as e:
        print(f"[music] ❌ Delete failed: {e}")
        return {"ok": False, "reason": str(e)}
    
@router.get("/regions", summary="List available cultural regions")
async def list_regions():
    return {"regions": list(CULTURAL_STYLES.keys())}