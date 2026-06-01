# Ekko — Musical Mood Journeys

A gamified AI music app: share how you feel, pick a cultural sound, co-create a track, and earn rewards.

**Author:** Shahd Mostafa Abdelrahman Mohamed Attia  
**Stack:** FastAPI · React (Vite) · Supabase · Sonauto · OpenRouter · Stripe

| Layer | Role |
|---|---|
| **Frontend** | Mood input, region picker, co-creation, player, history, plans, rewards |
| **Backend** | Mood detection, lyrics, music generation, billing, plan limits |
| **Supabase** | Auth, profiles, songs, XP, Stripe sync |
| **Sonauto** | AI song generation (audio + vocals) |
| **OpenRouter** | Lyrics, titles, mood text analysis |
| **Stripe** | Subscriptions (Free / Groove / Studio) |

---

## How it works (user flow)

```
Sign in → Pick region → Pick language → Share mood → Shape sound → Listen & save → History / Rewards
```

1. **Onboarding** — Choose one of 7 cultural regions (Free: Global Mix only; paid: all regions).
2. **Mood** — Voice, text, quiz, or tap a mood emoji. Free gets 7 core moods; Groove/Studio get all 20.
3. **Co-creation** — Tempo, scale, instruments. Artist styles are Groove/Studio only.
4. **Generate** — Backend writes lyrics and sends a job to Sonauto; the player polls until audio is ready.
5. **Save** — Songs auto-save to Supabase. Download is Groove/Studio only.
6. **History** — Search, sort, favourite, rename, delete. Free sees the last 10 tracks only.

Plan limits are enforced on **both** frontend (UI locks) and backend (generate/save/API).

---

## Plans

| | **Free** | **Groove** | **Studio** |
|---|---|---|---|
| **Price** | $0 | $9/mo ($7 annual) | $19/mo ($15 annual) |
| **Generations** | 5 / day | 50 / day | Unlimited |
| **Regions** | Global Mix | All 7 | All 7 |
| **Moods** | 7 core | All 20 | All 20 |
| **Artist styles** | No | Yes | Yes |
| **Download** | No | Yes | Yes |
| **Song history** | Last 10 | Full | Full |
| **Audio** | Standard | HD | HD |
| **Priority queue** | Normal | Faster polling | Faster polling |
| **Commercial license** | Personal | Personal | Commercial |
| **REST API** | — | — | Yes (`/api/v1/*`) |

Upgrade via **Sidebar → Plans** (Stripe Checkout). After payment, the app refreshes your plan from Supabase.

---

## Plan gating — where it lives

Single source of truth for limits on the frontend:

`frontend/src/utils/planUtils.js` (keep in sync with `backend/routers/music.py` + `backend/plan_gate.py`)

| Feature | Free behaviour | Enforced in |
|---|---|---|
| Daily generations | 5/day, 429 when exceeded | `POST /music/generate`, `GET /music/usage/{user_id}` |
| Regions | Global only; others dimmed + lock | `Onboarding.jsx`, backend strips region on generate |
| Moods | 7 emoji quick-picks + 13 locked | `MoodInput.jsx`, backend clamps emotion |
| Artist styles | Default only | `CoCreation.jsx`, backend clears `artist_style_id` |
| Download | Lock icon → Plans | `MusicPlayer.jsx`, `SongHistory.jsx` |
| History | Last 10 + upgrade banner | `SongHistory.jsx` |
| HD / priority | Standard / normal poll | Style prompt + `MusicPlayer.jsx` poll interval |
| Commercial license | `personal` on save | `POST /music/save` |
| Studio API | 401/403 without key | `StudioApiMiddleware` + `routers/api_v1.py` |

---

## Project structure

```
ekko/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, Studio API middleware
│   ├── plan_gate.py            # Plan checks + API key lookup
│   ├── middleware/
│   │   └── studio_api.py       # Blocks /api/v1/* without Studio key
│   ├── routers/
│   │   ├── mood.py             # STT, mood detect, mood logs
│   │   ├── music.py            # Generate, save, history, usage, PATCH/DELETE
│   │   ├── api_v1.py           # Studio REST API (generate, status, songs, usage)
│   │   ├── rewards.py          # XP, streaks, badges
│   │   └── stripe_router.py    # Checkout, portal, webhooks, API keys
│   └── migrations/
│       ├── add_song_favorites.sql
│       └── add_api_key.sql
│
└── frontend/
    └── src/
        ├── App.jsx             # Navigation, auth, plan state, generate flow
        ├── utils/planUtils.js  # Client-side plan helpers
        └── components/
            ├── Onboarding.jsx      # Region picker (plan-gated)
            ├── MoodInput.jsx       # Voice / text / quiz + emoji moods
            ├── CoCreation.jsx      # Tempo, instruments, artist styles
            ├── MusicPlayer.jsx     # Play, download, auto-save
            ├── SongHistory.jsx     # Library, favourites, download
            ├── PlansScreen.jsx     # Stripe plans + Studio API key UI
            ├── RewardsScreen.jsx   # XP, badges, streaks
            └── AdminDashboard.jsx  # Admin CRUD
```

---

## API reference

Base URL: `http://localhost:8000` (local) or your Render URL (prod).

### App API (browser / mobile client)

Used by the React app. Most routes accept JSON; mood voice uses `multipart/form-data`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/mood/detect` | Voice mood (audio upload) |
| `POST` | `/mood/detect-text` | Text mood |
| `POST` | `/music/generate` | Start song generation (`user_id` required for limits) |
| `GET` | `/music/status/{task_id}` | Poll Sonauto job |
| `GET` | `/music/usage/{user_id}` | Today's generation count vs plan limit |
| `POST` | `/music/save` | Save finished song |
| `GET` | `/music/history/{user_id}` | All songs (+ grouped by region) |
| `PATCH` | `/music/{song_id}` | Update title / `is_favorite` |
| `DELETE` | `/music/{song_id}?user_id=` | Delete song |
| `GET` | `/music/artist-styles?region=` | Artist personas for co-creation |
| `POST` | `/rewards/checkin` | Daily check-in XP |
| `GET` | `/stripe/status/{user_id}` | Current subscription |
| `POST` | `/stripe/checkout` | Start Stripe Checkout |
| `POST` | `/stripe/portal` | Billing portal |
| `GET` | `/stripe/api-key/{user_id}` | Masked API key status (Studio) |
| `POST` | `/stripe/api-key` | Generate or rotate Studio API key |

**Generate body (example):**
```json
{
  "user_id": "uuid",
  "mood_text": "I feel hopeful today",
  "emotion": "joy",
  "valence": 0.8,
  "energy": 0.6,
  "region": "global",
  "language_code": "en",
  "tempo_bpm": 90,
  "scale": "C major",
  "instruments": ["piano", "strings"],
  "artist_style_id": ""
}
```

**429 response** when daily limit is hit → frontend shows a toast and opens Plans.

---

### Studio API (`/api/v1/*`)

For **Studio subscribers** only. Requires header:

```http
X-Ekko-API-Key: ekko_xxxxxxxx
```

Also accepts `Authorization: Bearer ekko_xxxxxxxx`.

Get a key: **Plans screen → Studio API Access → Generate API key** (or `POST /stripe/api-key`).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1` | Public — API info (no key) |
| `POST` | `/api/v1/generate` | Same as `/music/generate`; `user_id` set from key |
| `GET` | `/api/v1/status/{task_id}` | Poll generation |
| `GET` | `/api/v1/songs` | Song history for key owner |
| `GET` | `/api/v1/usage` | Daily usage for key owner |

**Example:**
```bash
curl -X POST "$API/api/v1/generate" \
  -H "X-Ekko-API-Key: ekko_your_key" \
  -H "Content-Type: application/json" \
  -d '{"mood_text":"calm evening","emotion":"neutral","region":"global"}'
```

Errors: `401` missing/invalid key · `403` not on Studio plan.

Interactive docs: `/docs` when the backend is running.

---

## Database (Supabase)

| Table | What it stores |
|---|---|
| `profiles` | User info, `xp`, `plan`, Stripe IDs, **`api_key`** (Studio) |
| `songs` | Tracks: audio, lyrics, mood, region, artist, title, **`is_favorite`**, **`license`** |
| `mood_sessions` | Co-creation sessions (used for daily gen counting) |
| `mood_logs` | Mood detection history |
| `user_rewards` | Streaks, badges, check-ins |
| `xp_events` | Idempotent XP awards |

### Migrations

Run once in the Supabase SQL editor:

```sql
-- Favourites
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

-- Studio API keys
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_api_key ON profiles (api_key) WHERE api_key IS NOT NULL;

-- Optional: commercial license on songs
ALTER TABLE songs ADD COLUMN IF NOT EXISTS license TEXT DEFAULT 'personal';

-- Pre/post UX study surveys (see backend/migrations/add_study_surveys.sql)
```

Files also live in `backend/migrations/` (`add_study_surveys.sql`, etc.).

---

## Environment variables

### Backend (`backend/.env`)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_GROOVE_PRICE_ID=price_...
STRIPE_STUDIO_PRICE_ID=price_...

SONAUTO_API_KEY=...
OPENROUTER_API_KEY=...

GROQ_API_KEY=...              # optional STT fallback
OPENAI_API_KEY=...            # optional STT fallback
RESEND_API_KEY=re_...         # optional receipt emails
RESEND_FROM_EMAIL=Ekko <receipts@yourdomain.com>

FRONTEND_URL=https://ekko-silk.vercel.app
RENDER_EXTERNAL_URL=https://ekko-s8pl.onrender.com
ADMIN_SECRET=EkkoAdmin2026!   # admin delete-user + survey export (match dashboard login)
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Run locally

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Hard-refresh after UI pulls (`Cmd+Shift+R`).

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Backend | Render | https://ekko-s8pl.onrender.com |
| Frontend | Vercel | https://ekko-silk.vercel.app |
| Database | Supabase | your Supabase project |
| Payments | Stripe | dashboard.stripe.com |

### Deploy backend to Render
1. Push to GitHub
2. Render auto-deploys on push
3. Set all env vars in Render → Environment tab

### Deploy frontend to Vercel
1. Push to GitHub
2. Vercel auto-deploys on push
3. Set `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in Vercel env vars

Set `VITE_API_URL` on Vercel to your Render backend URL. Add the Vercel domain to backend CORS in `main.py` if needed.

---

## Rewards (short)

| Action | XP |
|---|---|
| Daily check-in | +10 |
| Share a mood | +10 |
| Co-create a song | +20 |
| Select a region (once) | +5 |

Ranks: Listener → Vibe Seeker → Composer → Artist → Maestro → Legend (see `RewardsScreen.jsx`).

### Daily challenges

One rotating challenge per day (5 in the pool). Bonus XP is awarded once per day via `POST /rewards/daily-challenge/claim`.

| ID | Challenge | How to complete |
|---|---|---|
| dc1 | Morning Mood | Share a mood before noon |
| dc2 | Emotion Flip | Pick a region different from your saved home region |
| dc3 | Night Session | Save a song after 9 PM |
| dc4 | Random Vibes | Complete mood flow using the **Quiz** tab |
| dc5 | Double Down | Generate 2 songs in one day |

Login popup: `DailyChallengeCTA` (dismissed for the day via localStorage). Progress shown on **Rewards** screen.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/rewards/daily-challenge/{user_id}` | Today's challenge + completed flag |
| `POST` | `/rewards/daily-challenge/claim` | Validate + award bonus XP |

---

## Testing tips

- **Stripe:** card `4242 4242 4242 4242`, any future expiry, any CVC.
- **Free limits:** mood banner shows `X/5 songs today`; 6th generation returns 429.
- **Favourites:** Songs → 🤍 on a card, or filter with **Favourites** in the header row.
- **Download:** Groove+ gets ⬇ on history cards and in the player; Free sees 🔒.
- **Studio API:** upgrade to Studio → Plans → Generate API key → call `/api/v1/generate`.

Expiry: any future date · CVC: any 3 digits · ZIP: any 5 digits

---

## Optional: receipt emails

1. Sign up at [resend.com](https://resend.com)
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on the backend
3. Without Resend, Stripe still sends basic receipts
