# 🎵 Ekko — Musical Mood Journeys

> A gamified, multi-modal, culturally sensitive AI music experience.  
> Share your mood → get a full AI-generated song in your cultural style → earn rewards.

**Author:** Shahd Mostafa Abdelrahman Mohamed Attia  
**Stack:** FastAPI · React (Vite) · Supabase · Sonauto · Stripe · Render · Vercel

---

## ✨ Features

- 🎭 **Mood Engine** — text, voice, or quiz input analyzed by Gemini
- 🌍 **7 Cultural Regions** — Arabic, West Africa, India, East Asia, Latin, Europe, Global
- 🎤 **Artist Style Selection** — 80+ artists across all regions
- 🎵 **AI Music Generation** — full songs via Sonauto API with region-specific vocals
- ✍️ **AI Lyrics** — written in your language/dialect via OpenRouter (Gemini / LLaMA)
- 🏆 **Rewards & Streaks** — XP, badges, daily check-ins, rank progression
- 📜 **Song History** — all generated songs saved per user, persist across sign-out
- 💳 **Stripe Billing** — Groove ($9/mo) and Studio ($19/mo) paid plans
- 📧 **Receipt Emails** — automatic payment receipts via Resend
- 🔐 **Auth** — Supabase Auth (email + Google OAuth)

---

## 🗂 Project Structure

```
EKKO/
├── backend/                          # FastAPI backend (Python)
│   ├── routers/
│   │   ├── auth.py                   # Auth helpers
│   │   ├── mood.py                   # Layer 2: Mood engine (Gemini)
│   │   ├── music.py                  # Layer 3+4: Cultural filter + Sonauto generation
│   │   ├── rewards.py                # Layer 5: XP, streaks, badges, history
│   │   └── stripe_router.py          # Layer 6: Stripe billing + receipt emails
│   ├── venv/                         # Python virtual environment
│   ├── .env                          # Environment variables (never commit)
│   ├── keepalive.py                  # Render keep-alive pinger
│   ├── main.py                       # FastAPI app entry point
│   └── requirements.txt              # Python dependencies
│
├── frontend/                         # React + Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── AdminDashboard.jsx    # Admin panel
│   │   │   ├── AuthScreen.jsx        # Login / signup
│   │   │   ├── BackButton.jsx        # Navigation helper
│   │   │   ├── BillingPortalButton.jsx  # Stripe billing portal launcher ← NEW
│   │   │   ├── CoCreation.jsx        # Music co-creation UI
│   │   │   ├── LanguagePicker.jsx    # Language/dialect selector
│   │   │   ├── MoodInput.jsx         # Mood entry (text/voice/quiz)
│   │   │   ├── MusicPlayer.jsx       # Audio player + save + lyrics
│   │   │   ├── Onboarding.jsx        # First-run onboarding
│   │   │   ├── PlansScreen.jsx       # Stripe plans (Free/Groove/Studio)
│   │   │   ├── RewardBadge.jsx       # Badge display component
│   │   │   ├── RewardsScreen.jsx     # Full rewards/XP/streak screen
│   │   │   ├── SongHistory.jsx       # Persistent song history per user
│   │   │   └── SubscribeButton.jsx   # One-click Stripe checkout trigger ← NEW
│   │   ├── lib/
│   │   │   └── supabase.js           # Supabase client
│   │   ├── utils/
│   │   │   └── musicUtils.js         # Shared music helpers
│   │   ├── App.css
│   │   ├── App.jsx                   # Main app + routing + tab logic
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env                          # Frontend env vars (never commit)
│   ├── index.html
│   ├── package.json
│   └── eslint.config.js
│
└── docs/                             # Documentation
```

---

## 🗄 Supabase Schema

| Table | Purpose |
|---|---|
| `profiles` | User profiles — `id`, `email`, `full_name`, `xp`, `plan`, `stripe_customer_id`, `stripe_subscription_id`, `plan_status`, `plan_latest_period_end` |
| `songs` | All generated songs — audio URL, lyrics, mood, region, artist |
| `user_rewards` | XP, streak, badges, last check-in per user |
| `xp_events` | Idempotent XP log — prevents double-awarding |
| `stripe_subscriptions` | Stripe plan, status, period end per user |
| `mood_logs` | Mood session history |
| `mood_sessions` | Active mood sessions |
| `cultural_profiles` | User's cultural preferences |

---

## 💳 Stripe Plans

| Plan | Price | Generations | Features |
|---|---|---|---|
| **Free** | $0 | 5/day | Basic moods, last 10 songs |
| **Groove** | $9/mo | 50/day | All regions, HD audio, full history, artist styles |
| **Studio** | $19/mo | Unlimited | Everything + commercial license + API access |

### Stripe Webhook Events Handled
- `checkout.session.completed` → activate subscription
- `customer.subscription.updated` → sync plan changes
- `customer.subscription.deleted` → downgrade to free
- `invoice.payment_succeeded` → send receipt email
- `invoice.payment_failed` → mark as past_due
- `invoice.payment_action_required` → mark as past_due (3D Secure)

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_GROOVE_PRICE_ID=price_...
STRIPE_STUDIO_PRICE_ID=price_...
FRONTEND_URL=https://your-app.vercel.app

# AI APIs
SONAUTO_API_KEY=...
OPENROUTER_API_KEY=...

# Email receipts (optional — Stripe sends basic receipts without this)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Ekko <receipts@yourdomain.com>

# Render
RENDER_EXTERNAL_URL=https://ekko-s8pl.onrender.com
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=https://ekko-s8pl.onrender.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🚀 Running Locally

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 Deployment

| Service | Platform | URL |
|---|---|---|
| Backend | Render | https://ekko-s8pl.onrender.com |
| Frontend | Vercel | your Vercel URL | https://ekko-silk.vercel.app
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

---

## 📧 Receipt Emails (Optional)

To send custom branded receipt emails:
1. Create a free account at [resend.com](https://resend.com)
2. Add your domain or use their sandbox domain for testing
3. Copy your API key → add as `RESEND_API_KEY` in Render env vars
4. Set `RESEND_FROM_EMAIL` to your verified sender

Without this, Stripe automatically sends basic receipt emails to customers.

---

## 🎮 Reward System

| Action | XP |
|---|---|
| Daily check-in | +10 |
| Share a mood | +10 |
| Generate a song | +20 |
| Select a region | +5 |

| Rank | XP Required |
|---|---|
| 🎧 Listener | 0 |
| 🌊 Vibe Seeker | 50 |
| 🔥 On Fire | 200 |
| ⭐ Star | 500 |
| 💎 Diamond | 1000 |
| 🏆 Ekko Legend | 2500 |

---

## 🧪 Testing Stripe Payments

Use Stripe test cards:
- **Success:** `4242 4242 4242 4242`
- **Requires auth:** `4000 0025 0000 3155`
- **Declined:** `4000 0000 0000 9995`

Expiry: any future date · CVC: any 3 digits · ZIP: any 5 digits
