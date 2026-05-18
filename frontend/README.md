# 🎵 Ekko — Musical Mood Journeys

> *Share how you feel. Get a song made for you, in your language, from your culture.*

Ekko is a mood-to-music app built for teenagers. You speak, type, or answer a quiz about how you're feeling — Ekko detects your emotion, writes lyrics in your chosen language and dialect, and generates a full culturally-rooted song using AI.

---

## What It Does

1. **You share your mood** — via voice (any language), typed text, or an emoji quiz
2. **Ekko detects your emotion** — using Gemini audio + text analysis with acoustic fusion
3. **You pick your musical culture** — Arabic, West Africa, India, East Asia, Latin, Europe, or Global
4. **You pick your language** — Egyptian Arabic, Nigerian Pidgin, Hindi, Yoruba, Mandarin, and more
5. **Ekko writes lyrics** in your dialect and generates a full song via Sonauto AI
6. **Your songs are saved** to your history dashboard with playback, lyrics, and mood stats
7. **You earn XP and badges** for every mood shared and song created

---

## Tech Stack

### Frontend
| Tool | Purpose |
|------|---------|
| React + Vite | UI framework |
| Supabase JS client | Auth + real-time data |
| Custom CSS (no UI lib) | All styling hand-written |

### Backend
| Tool | Purpose |
|------|---------|
| FastAPI (Python) | REST API server |
| Supabase (Postgres + RLS) | Database + auth |
| OpenRouter | LLM routing (Gemini, Llama, Mistral) |
| Sonauto AI | Music generation from lyrics + style prompt |
| librosa | Acoustic feature extraction from audio |
| HuggingFace Transformers | Fallback emotion classifier |

---

## Project Structure

```
ekko/
├── frontend/                   # React + Vite app
│   └── src/
│       ├── App.jsx             # Main router + state, screen flow
│       ├── lib/
│       │   └── supabase.js     # Supabase client init
│       └── components/
│           ├── AuthScreen.jsx      # Sign in / sign up
│           ├── Onboarding.jsx      # Region picker (7 cultures)
│           ├── LanguagePicker.jsx  # Language picker per region
│           ├── MoodInput.jsx       # Voice / Text / Quiz mood tabs
│           ├── CoCreation.jsx      # Tempo, scale, instrument tuning
│           ├── MusicPlayer.jsx     # Audio player + lyrics display
│           ├── SongHistory.jsx     # Songs dashboard with playback
│           ├── RewardsScreen.jsx   # XP, badges, streak calendar
│           ├── RewardBadge.jsx     # Toast badge pop-up
│           └── BackButton.jsx      # Shared back navigation
│
└── backend/                    # FastAPI server
    ├── main.py                 # App entry point, router mount
    ├── .env                    # API keys (never commit)
    └── routers/
        ├── mood.py             # Layer 2 — Mood Engine
        └── music.py            # Layer 3+4 — Music Generation
```

---

## Screen Flow

```
Auth → Onboarding (region) → Language Picker → Mood Input
                                                    ↓
                                              Co-Creation
                                                    ↓
                                            Generating…
                                                    ↓
                                            Music Player
                                                    ↓
                                     ┌──────────────────────┐
                                     │  Songs  │  Rewards   │
                                     └──────────────────────┘
```

---

## Mood Detection Pipeline (`mood.py`)

### Voice input (`POST /mood/detect`)
1. Audio received as `.webm` upload
2. **librosa** extracts acoustic features: energy, pitch, tempo, zero-crossing rate
3. **Gemini audio agent** (via OpenRouter) transcribes + detects emotion from audio + acoustics
4. **Gemini text agent** runs in parallel on the transcript
5. **Blend function** merges both signals:
   - Audio UNKNOWN / low confidence → trust text 100%, use acoustics for arousal only
   - Both agree → boost confidence, average valence/arousal
   - Disagree → text wins (words beat acoustics), acoustics calibrate arousal
6. Result persisted to `mood_logs` table in Supabase

### Text input (`POST /mood/detect-text`)
- Sent directly to Gemini text agent
- Falls back to HuggingFace `j-hartmann/emotion-english-distilroberta-base` if all LLMs fail

### Why this works for Arabic
Gemini natively understands Egyptian, Levantine, Gulf, and Moroccan dialects. The acoustic blend means even if the audio model is uncertain, the transcript text analysis always produces a valid emotion — no more `UNKNOWN` results.

---

## Music Generation Pipeline (`music.py`)

### `POST /music/generate`
1. Resolves chosen `language_code` (e.g. `ar-eg`, `pcm`, `yo`) to full writing instruction
2. Calls OpenRouter (Gemini → Llama → Mistral fallback chain) to write lyrics in that exact dialect
3. Builds a Sonauto style prompt with cultural instruments, vocal style, mood words, and tempo
4. Submits to `POST https://api.sonauto.ai/v1/generations/v3` → returns `task_id`

### `GET /music/status/{task_id}`
- Polls Sonauto until `SUCCESS`, `FAILED`, or 30 retries × 4 seconds (~2 minutes max)

### `POST /music/save`
- Called automatically by frontend once `audio_url` is confirmed
- Saves full song record to Supabase `songs` table

### `GET /music/history/{user_id}`
- Returns all songs grouped by region for the Songs dashboard

---

## Supabase Schema

```sql
-- User profiles
create table profiles (
  id      uuid primary key references auth.users,
  xp      int default 0,
  region  text
);

-- Mood logs (for streak calendar)
create table mood_logs (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,
  valence    float,
  arousal    float,
  emotion    text,
  transcript text,
  confidence float,
  acoustic   jsonb,
  region     text,
  language   text,
  created_at timestamptz default now()
);

-- Songs (history dashboard)
create table songs (
  id           uuid default gen_random_uuid() primary key,
  user_id      text not null,
  region       text,
  region_label text,
  mood_label   text,
  emotion      text,
  valence      float,
  energy       float,
  lyrics       text,
  audio_url    text,
  prompt_used  text,
  language     text,
  reasoning    text,
  created_at   timestamptz default now()
);

-- XP events log
create table xp_events (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,
  action     text,
  xp         int,
  created_at timestamptz default now()
);

-- Mood sessions (co-creation params)
create table mood_sessions (
  id          uuid default gen_random_uuid() primary key,
  user_id     text not null,
  mood_label  text,
  valence     float,
  energy      float,
  region      text,
  scale       text,
  tempo_bpm   int,
  instruments text[],
  created_at  timestamptz default now()
);

-- Row Level Security (all tables)
alter table songs      enable row level security;
alter table mood_logs  enable row level security;
alter table profiles   enable row level security;
alter table xp_events  enable row level security;

-- Open policies for now (tighten before production)
drop policy if exists "songs open"      on songs;
drop policy if exists "mood_logs open"  on mood_logs;
drop policy if exists "profiles open"   on profiles;
drop policy if exists "xp_events open"  on xp_events;

create policy "songs open"      on songs      for all using (true) with check (true);
create policy "mood_logs open"  on mood_logs  for all using (true) with check (true);
create policy "profiles open"   on profiles   for all using (true) with check (true);
create policy "xp_events open"  on xp_events  for all using (true) with check (true);
```

---

## Environment Variables

### Backend (`backend/.env`)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENROUTER_API_KEY=your-openrouter-key
SONAUTO_API_KEY=your-sonauto-key
```

### Frontend (`frontend/.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Running Locally

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install fastapi uvicorn httpx supabase librosa transformers torch
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Supported Regions & Languages

| Region | Languages available |
|--------|-------------------|
| 🌙 Arabic | Egyptian Arabic, Levantine Arabic, Gulf Arabic, Moroccan Darija, English |
| 🥁 West Africa | English, Nigerian Pidgin, French, Yoruba, Hausa, Wolof |
| 🪔 India | Hindi, Tamil, Telugu, Bengali, English |
| 🌸 East Asia | Mandarin, Japanese, Korean, English |
| 🎺 Latin | Spanish, Portuguese, English |
| 🎻 Europe | English, French, German, Spanish, Italian |
| 🌍 Global Mix | English, Spanish, French, Arabic, Hindi |

---

## XP & Badges

| Badge | XP needed | How to earn |
|-------|-----------|-------------|
| 🌱 First Mood | 10 XP | Share your first mood |
| 🎼 Co-Creator | 30 XP | Generate your first track |
| 🗺️ Explorer | 60 XP | Try all 3 mood input modes |
| 🔥 3-Day Streak | 90 XP | Check in 3 days in a row |
| 🎹 Composer | 150 XP | Generate 5 tracks |
| 🏆 Maestro | 300 XP | Reach 300 XP |

XP earned per action: Region selected (+5), Mood shared (+10), Music co-created (+20).

---

## Known Issues & Notes

- **librosa deprecation warning** — `audioread` fallback for `.webm` files is harmless but will be removed in librosa 1.0. Install `ffmpeg` to use the proper loader: `brew install ffmpeg`
- **Sonauto 502** — if you see this, the Sonauto API key may be expired or the `/v3` endpoint has changed. Check `SONAUTO_API_KEY` in `.env` and the Sonauto dashboard.
- **OpenRouter 429** — free-tier models have rate limits. The model list now falls through Gemini → Llama 70B → Llama 8B → Mistral automatically.
- **History empty** — was caused by a React stale closure bug where `user` was `null` inside `generateMusic`. Fixed by using `userRef` to always read the latest user value.