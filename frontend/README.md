# Ekko Frontend

React + Vite UI for [Ekko](../README.md). All architecture, API, plans, and migrations are documented in the **root README**.

## Quick start

```bash
npm install
cp .env.example .env   # if you use one; otherwise create .env
npm run dev
```

```env
# frontend/.env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Screen map

| Screen | Component | What it does |
|---|---|---|
| Auth | `AuthScreen.jsx` | Email + Google sign-in |
| Regions | `Onboarding.jsx` | Pick cultural region (plan-gated) |
| Language | `LanguagePicker.jsx` | Dialect / language for lyrics |
| Mood | `MoodInput.jsx` | Voice, text, quiz, emoji quick-picks |
| Co-create | `CoCreation.jsx` | Tempo, scale, instruments, artists |
| Player | `MusicPlayer.jsx` | Play, download (paid), auto-save |
| History | `SongHistory.jsx` | Search, favourites, download, CRUD |
| Rewards | `RewardsScreen.jsx` | XP, badges, streaks |
| Plans | `PlansScreen.jsx` | Stripe checkout, Studio API key |
| Admin | `AdminDashboard.jsx` | Internal admin panel |

Navigation and plan state live in `App.jsx`. Plan rules live in `src/utils/planUtils.js` — keep aligned with the backend.

**Artist unlock (Free):** positions 1–2 free per region list; positions 3–7 cost 2,500 XP; position 8+ needs Groove. See root README → *Artist unlock*.

## Build

```bash
npm run build
npm run preview
```
