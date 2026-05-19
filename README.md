# Ekko: Musical Mood Journeys
**A Gamified, Multi-Modal, and Culturally Sensitive Music Experience**

Bachelor Thesis — Media Engineering and Technology Faculty, German University in Cairo  
Author: Shahd Mostafa Abdelrahman Mohamed Attia  
Supervisor: Dr. Nada Sharaf

---

## Why `localhost:8000/docs` wasn't working

The FastAPI server was not running. This project requires two separate processes:

| Process | Command | URL |
|---|---|---|
| Backend (FastAPI) | `uvicorn main:app --reload` | ${import.meta.env.VITE_API_URL}/docs |
| Frontend (React/Vite) | `npm run dev` | http://localhost:5173 |

Follow the steps below to get both running.

---

## Five-Layer Architecture

```
Layer 1  Multi-Modal Input     Voice / Text / Quiz  →  React MoodInput.jsx
Layer 2  Mood Engine           Whisper + librosa + HuggingFace  →  POST /mood/detect
Layer 3  Cultural Filter       cultural_profiles table  →  POST /music/generate
Layer 4  AI Co-Creation        Anthropic Claude API + Tone.js  →  MusicPlayer.jsx
Layer 5  Reward & History      Supabase mood_logs + user_rewards  →  RewardPanel.jsx
```

---

## Project Structure

```
ekko/
├── backend/
│   ├── main.py                  ← FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example             ← Copy to .env and fill in keys
│   ├── supabase_schema.sql      ← Run this in Supabase SQL Editor
│   └── routers/
│       ├── mood.py              ← Layer 2: POST /mood/detect
│       ├── music.py             ← Layer 3+4: POST /music/generate, /music/iterate
│       └── rewards.py           ← Layer 5: POST /rewards/checkin, GET /rewards/{id}
└── frontend/
    └── src/
        ├── App.jsx              ← All 5 screens wired together
        └── components/
            ├── MoodInput.jsx    ← Layer 1: voice / text / quiz
            ├── MusicPlayer.jsx  ← Layer 4: Tone.js playback + co-creation
            └── RewardPanel.jsx  ← Layer 5: points, streaks, badges
```

---

## Step-by-Step Setup

### Step 1 — Supabase (database + auth)

1. Go to [supabase.com](https://supabase.com) → New Project
2. In **SQL Editor**, paste the contents of `backend/supabase_schema.sql` and run it.
   This creates:
   - `cultural_profiles` table (Layer 3) with 4 regions pre-seeded
   - `mood_logs` table (Layer 5)
   - `user_rewards` table (Layer 5)
   - Row-level security policies
3. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_KEY`

### Step 2 — Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
2. Copy it → `ANTHROPIC_API_KEY`

### Step 3 — Backend `.env` file

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJyour-anon-key-here
```

### Step 4 — Install and run the backend

```bash
cd backend

# Install dependencies (first time takes ~5 minutes due to torch + whisper)
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

✅ You should now see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Open **${import.meta.env.VITE_API_URL}/docs** → Swagger UI with all endpoints.

### Step 5 — Install and run the frontend

```bash
cd frontend

# Install Node packages (including Tone.js)
npm install

# Start Vite dev server
npm run dev
```

Open **http://localhost:5173** → Ekko UI.

---

## Testing Each Layer Without the Frontend

Use the Swagger UI at `${import.meta.env.VITE_API_URL}/docs`:

### Layer 2 — Test mood detection
- `POST /mood/detect`
- Upload any `.wav` file (record yourself speaking)
- Expected response: `{ "transcript": "...", "top_emotion": "joy", "valence": 0.6, "arousal": 0.5, ... }`

### Layer 3+4 — Test music generation
- `POST /music/generate`
- Body: `{ "valence": 0.6, "arousal": 0.7, "region": "Middle East" }`
- Expected: JSON params with `tempo_bpm`, `scale`, `tone_js_notes`, etc.

### Layer 5 — Test rewards
- `POST /rewards/checkin` with `{ "user_id": "test-user-1" }`
- Expected: `{ "points": 10, "streak": 1, "badges": ["first_checkin"] }`

---

## Available API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Project overview |
| GET | `/health` | Health check |
| POST | `/mood/detect` | Layer 2: detect mood from audio |
| GET | `/mood/history/{user_id}` | Layer 5: mood calendar data |
| GET | `/music/regions` | List cultural regions |
| POST | `/music/generate` | Layers 3+4: generate music params |
| POST | `/music/iterate` | Layer 4: real-time co-creation adjustment |
| POST | `/rewards/checkin` | Layer 5: daily check-in |
| GET | `/rewards/{user_id}` | Layer 5: get reward state |

---

## Notes on Heavy Dependencies

`openai-whisper`, `torch`, and `torchaudio` are large packages (~2 GB total). 
The first `pip install` will take several minutes. The Whisper model loads lazily
on the first `/mood/detect` call (not on startup), so the server starts immediately.

If you want to test the server quickly without the ML stack, comment out the Whisper/
librosa calls in `routers/mood.py` and return a hardcoded response — the music generation
and rewards endpoints work independently.