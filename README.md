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

### First-time user (study / thesis flow)

```
Sign in → Pre-test survey → Pick region → Pick language → Share mood → Co-create → Generate → Listen & save
         → Done → Post-test survey → History / Rewards
```

1. **Pre-test survey** — On first login, users complete a structured UX survey (Likert scales, age, genres, favourite artists, expectations). Required before entering the app.
2. **Onboarding** — Choose one of 7 cultural regions (Free: Global Mix only; paid: all regions).
3. **Language** — Pick lyrics language for the selected region.
4. **Mood** — Voice, text, quiz, or tap a mood emoji. Free gets 7 core moods; Groove/Studio get all 20.
5. **Co-creation** — Tempo, scale, instruments, optional artist style (see [Artist unlock](#artist-unlock-xp--plans) below).
6. **Generate** — Backend writes lyrics and sends a job to Sonauto; the player polls until audio is ready.
7. **Save & listen** — Songs auto-save to Supabase. Download is Groove/Studio only.
8. **Post-test survey** — After creating a song, tap **Done — continue →** on the player to complete the post-test (experience ratings, cultural fit, recommendations).
9. **History / Rewards** — Search, favourite, rename, delete songs; earn XP, badges, and daily challenges.

### Returning user

```
Sign in → Mood → Co-create → Generate → Listen & save → History / Rewards
```

Returning users skip surveys unless they open **Sidebar → Study** manually.

Plan limits are enforced on **both** frontend (UI locks) and backend (generate/save/API).

### Login flow (returning users)

After sign-in (pre-survey done), users land on the **region picker**. Optional overlays appear first:

1. **UpgradePlanCTA** (free, once per user until dismissed)
2. **DailyChallengeCTA** (once per day)

When both are closed, the app stays on (or returns to) **onboarding** (region picker). Accepting the daily challenge also returns to onboarding (not mood).

---

## Artist unlock (XP + plans)

Each region’s artist list is ordered. Unlock rules (keep in sync: `planUtils.js`, `music.py`, `rewards.py`):

| List position | Index | Free | Groove / Studio |
|---|---|---|---|
| First two artists | 0–1 | Included | Included |
| Next five artists | 2–6 | **2,500 XP** each (permanent unlock) | Included |
| Remaining artists | 7+ | Upgrade required | Included |

- **Not** every artist costs XP — only positions **3–7** in the list (indices 2–6).
- Artists from position **8** onward are **plan-only** (same as before Groove gating).
- Insufficient XP → UI prompts user to create/save songs and earn rewards.
- Unlocks stored in `profiles.unlocked_artists`; enforced on `GET /music/artist-styles` and `POST /music/generate`.

---

## Study surveys (thesis / UX research)

| Phase | When | What is collected |
|---|---|---|
| **Pre-test** | First login (required) | Age, music habits, AI familiarity, genres, favourite artists, expectations (Likert scales + options) |
| **Post-test** | After first song (via **Done** on player) | Experience, mood accuracy, music quality, cultural fit, lyrics, co-creation, NPS-style recommend, best/worst aspects |
| **Optional text** | Both phases | Further improvements only |

**View results:** Sign in as `admin@ekko.app` (password set in **Supabase Auth only**, not in source code) → Admin dashboard → **Surveys** tab → filter Pre/Post → **Export CSV**.

**API:** `GET /survey/status/{user_id}` · `POST /survey/submit` · `GET /admin/surveys` (header `Authorization: Bearer <Supabase access token>` after admin sign-in)

**Study surveys table (required for admin Surveys tab):** In Supabase → SQL Editor, run the full script once: `backend/migrations/create_study_surveys_full.sql`. (Older split files `add_study_surveys.sql` + `extend_study_surveys.sql` are optional if you already ran them.)

---

## Plans

| | **Free** | **Groove** | **Studio** |
|---|---|---|---|
| **Price** | $0 | $9/mo ($7 annual) | $19/mo ($15 annual) |
| **Generations** | 5 / day | 50 / day | Unlimited |
| **Regions** | Global Mix | All 7 | All 7 |
| **Moods** | 7 core | All 20 | All 20 |
| **Artist styles** | 2 free + 5 XP slots per region list; rest paid | All | All |
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
| Artist styles | 2 free; slots 3–7 = 2,500 XP each; slot 8+ = Groove | `CoCreation.jsx`, `POST /rewards/unlock-artist`, `music.py` on generate |
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
│   │   ├── music.py            # Generate, save, stream proxy, artist-styles, usage
│   │   ├── api_v1.py           # Studio REST API (generate, status, songs, usage)
│   │   ├── rewards.py          # XP, streaks, badges, daily challenges
│   │   ├── stripe_router.py    # Checkout, portal, webhooks, API keys
│   │   ├── survey.py           # Pre/post study surveys
│   │   └── admin.py            # Admin users, songs, survey export
│   └── migrations/
│       ├── add_song_favorites.sql
│       ├── add_songs_task_id.sql
│       ├── add_profiles_unlocked_artists.sql
│       ├── add_api_key.sql
│       ├── create_study_surveys_full.sql
│       └── extend_study_surveys.sql
│
└── frontend/
    └── src/
        ├── App.jsx             # Navigation, auth, CTAs, survey routing, generate flow
        ├── utils/planUtils.js  # Plan + artist unlock helpers
        ├── utils/audioProxy.js # CDN-first playback URLs
        ├── utils/historyAudio.js # Shared <audio> for song history
        ├── utils/upgradeCta.js # Upgrade modal dismiss state
        ├── utils/surveyQuestions.js  # Thesis survey definitions
        └── components/
            ├── Onboarding.jsx      # Region picker (plan-gated)
            ├── MoodInput.jsx       # Voice / text / quiz + emoji moods
            ├── CoCreation.jsx      # Tempo, instruments, artist XP unlock UI
            ├── UpgradePlanCTA.jsx  # Free-plan upsell on login
            ├── MusicPlayer.jsx     # Play, download, auto-save, Done → post-test
            ├── SongHistory.jsx     # Library, favourites, download
            ├── StudySurvey.jsx     # Pre/post UX research forms
            ├── PlansScreen.jsx     # Stripe plans + Studio API key UI
            ├── RewardsScreen.jsx   # XP, badges, streaks
            └── AdminDashboard.jsx  # Admin CRUD + survey CSV export
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
| `GET` | `/music/stream?url=` | Proxy audio by CDN URL (preferred playback) |
| `GET` | `/music/stream/{task_id}` | Proxy by task (409 if still GENERATING) |
| `GET` | `/music/open?url=` · `/music/open/{task_id}` | Redirect to CDN (new tab) |
| `GET` | `/music/usage/{user_id}` | Today's generation count vs plan limit |
| `POST` | `/music/save` | Save song + idempotent song XP in response |
| `GET` | `/music/history/{user_id}` | All songs (+ grouped by region) |
| `PATCH` | `/music/{song_id}` | Update title / `is_favorite` |
| `DELETE` | `/music/{song_id}?user_id=` | Delete song |
| `GET` | `/music/artist-styles?region=&plan=&user_id=` | Artists + unlock flags / user XP |
| `POST` | `/rewards/unlock-artist` | Spend 2,500 XP on eligible artist (positions 3–7 in list) |
| `POST` | `/rewards/checkin` | Daily check-in XP |
| `GET` | `/stripe/status/{user_id}` | Current subscription |
| `POST` | `/stripe/checkout` | Start Stripe Checkout |
| `POST` | `/stripe/portal` | Billing portal |
| `GET` | `/stripe/api-key/{user_id}` | Masked API key status (Studio) |
| `POST` | `/stripe/api-key` | Generate or rotate Studio API key |
| `GET` | `/survey/status/{user_id}` | Pre/post survey completion status |
| `POST` | `/survey/submit` | Submit pre or post study survey |
| `GET` | `/admin/surveys` | Export all survey responses (admin) |

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
| `profiles` | User info, `xp`, `plan`, Stripe IDs, **`api_key`**, **`unlocked_artists`** (JSON array) |
| `songs` | Tracks: audio, lyrics, mood, region, artist, title, **`task_id`**, **`is_favorite`**, **`license`** |
| `mood_sessions` | Co-creation sessions (used for daily gen counting) |
| `mood_logs` | Mood detection history |
| `user_rewards` | Streaks, badges, check-ins |
| `xp_events` | Idempotent XP awards |
| `study_surveys` | Pre/post UX research responses |

### Migrations

Run once in the Supabase SQL editor (scripts in `backend/migrations/`):

| Script | Purpose |
|---|---|
| `add_song_favorites.sql` | `is_favorite` on `songs` |
| `add_songs_task_id.sql` | `task_id` on `songs` (dedupe saves) |
| `add_profiles_unlocked_artists.sql` | `unlocked_artists` jsonb on `profiles` |
| `add_api_key.sql` | Studio `api_key` on `profiles` |
| `create_study_surveys_full.sql` | Pre/post study surveys (admin export) |

```sql
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS task_id TEXT;
CREATE INDEX IF NOT EXISTS idx_songs_task_id ON songs (task_id) WHERE task_id IS NOT NULL;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS license TEXT DEFAULT 'personal';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlocked_artists jsonb DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;
```

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
ADMIN_EMAIL=admin@ekko.app
ADMIN_SECRET=your-long-random-secret   # optional server-only fallback for curl/scripts — never put in frontend
```

### Admin login (security)

- Create the admin user in **Supabase → Authentication → Users** with email `admin@ekko.app` and a **strong password** (not stored in this repo).
- The admin dashboard signs in through **Supabase Auth**; protected API routes accept the session **Bearer token**.
- **Do not** hardcode passwords in `frontend/` — they are bundled into public JS. If a password was ever committed or deployed, **rotate it in Supabase immediately**.
- Optional `ADMIN_SECRET` on Render is only for manual API calls from the server side, not for the web app.

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Signup emails and “email rate limit exceeded”

Ekko uses **Supabase Auth** to send signup confirmation emails. On the **default (built-in) SMTP**, Supabase applies a **very low project-wide limit** (often about **2–4 emails per hour** for the whole app, not per user). Hitting that limit shows `email rate limit exceeded` when testers sign up or tap **Resend confirmation email**.

**For thesis / group testing (pick one):**

1. **Supabase Dashboard → Authentication → Rate Limits** — raise **Email sent** (e.g. 30–200/hour after you add custom SMTP).
2. **Authentication → Providers → Email** — turn off **Confirm email** so sign-up does not send mail (users can sign in immediately). Easiest for many testers on one project.
3. **Authentication → SMTP** — connect **Resend** (or SendGrid/Postmark) with your domain; built-in limits no longer apply. Default with custom SMTP is often **30/hour** until you raise it in Rate Limits.
4. **Sign in with Google** — does not use the email quota.

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

### Production deploy checklist

Deploy **backend and frontend together** when changing playback or save behavior.

1. **Supabase** — run `add_songs_task_id.sql` and `add_profiles_unlocked_artists.sql` if not applied.
2. **Render** — redeploy backend (stream proxy, artist unlock, save XP).
3. **Vercel** — redeploy frontend (`audioProxy.js`, `CoCreation.jsx`, `SongHistory.jsx`, CTAs).
4. **Smoke test** — generate → no `409` on stream during GENERATING; history play/pause works; artist XP unlock on list positions 3–7 only.

### Audio playback (CORS-safe proxy)

Mobile Safari cannot play Sonauto CDN URLs directly from the app origin. The backend proxies allowlisted hosts (`cdn.sonauto.ai`, `sonauto.ai`, etc.).

**Frontend URL order** (`frontend/src/utils/audioProxy.js`):

1. When `audio_url` exists → `GET /music/stream?url=<normalized CDN URL>` (preferred).
2. Only if no URL yet → `GET /music/stream/{task_id}` (409 while still GENERATING).

On **SUCCESS**, the backend caches the normalized URL per task and only warns when the host is **not** allowlisted.

### Render logs (what they mean)

| Log / status | Meaning |
|---|---|
| `stream/{task_id}` **409** | Proxy called before Sonauto finished. |
| `stream/{task_id}` **502** | Upstream/status fetch failed or audio not ready. |
| `stream?url=…` **400** | Disallowed or non-normalized URL (older deploy). |
| `Song saved (fallback columns)` | Missing `songs.task_id` — run `add_songs_task_id.sql`. |
| `POST /rewards/xp` after save | Usually mood/check-in, not duplicate song XP. |

---

## Rewards (short)

| Action | XP |
|---|---|
| Daily check-in | +10 |
| Share a mood | +10 |
| Co-create a song | +20 (once per save via `POST /music/save`, idempotent by `task_id`) |
| Select a region (once) | +5 |
| Unlock artist (positions 3–7 only) | −2,500 |

Song-save XP is returned in the save response; badge checks use that total immediately. Artist unlock uses `POST /rewards/unlock-artist`.

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

Login popups (free): `UpgradePlanCTA` first, then `DailyChallengeCTA`. Progress on **Rewards** screen.

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
- **Playback:** history uses `stream?url=…` (200/206); pause stops audio (shared `historyAudio.js`).
- **Artist XP:** on Free, only artists **3–7** in a region list show the 2,500 XP badge; artist **8+** shows upgrade only.

Expiry: any future date · CVC: any 3 digits · ZIP: any 5 digits

---

## Optional: receipt emails

1. Sign up at [resend.com](https://resend.com)
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on the backend
3. Without Resend, Stripe still sends basic receipts
