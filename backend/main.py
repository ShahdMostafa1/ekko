"""
Ekko — FastAPI Backend Entry Point
Layers: Mood Engine (2) · Music Generation (3+4) · Rewards & History (5)
"""
from __future__ import annotations

import asyncio
import os

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Ekko: Musical Mood Journeys",
    description=(
        "A gamified, multi-modal, and culturally sensitive music experience. "
        "Five-layer architecture: multi-modal input → mood engine → cultural filter "
        "→ AI music co-creation → reward & history."
    ),
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Add your Vercel frontend URL here once deployed
ALLOWED_ORIGINS = [
    "http://localhost:5173",       # local Vite dev server
    "http://localhost:3000",       # alternative local port
    "https://ekko-s8pl.onrender.com",     # replace with your actual Vercel URL
]

# Also allow any Vercel preview URLs (*.vercel.app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
from routers.mood    import router as mood_router
from routers.music   import router as music_router
from routers.rewards import router as rewards_router

app.include_router(mood_router)
app.include_router(music_router)
app.include_router(rewards_router)

# ── Keep-alive (prevents Render free/starter cold starts) ────────────────────
async def _keep_alive():
    """Pings /health every 10 minutes to keep the Render instance warm."""
    render_url = os.getenv("RENDER_EXTERNAL_URL")
    if not render_url:
        print("[keepalive] RENDER_EXTERNAL_URL not set — skipping (local dev)")
        return

    await asyncio.sleep(60)  # wait 1 minute after startup before first ping
    print(f"[keepalive] starting — will ping {render_url}/health every 10 min")

    while True:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{render_url}/health", timeout=10)
                print(f"[keepalive] pinged — status {resp.status_code}")
        except Exception as e:
            print(f"[keepalive] ping failed: {e}")
        await asyncio.sleep(600)  # 10 minutes


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(_keep_alive())
    print("[ekko] ✅ Backend started — all layers online")


# ── Root & health endpoints ───────────────────────────────────────────────────
@app.get("/", summary="Project overview")
async def root():
    return {
        "project": "Ekko: Musical Mood Journeys",
        "version": "1.0.0",
        "description": "A gamified, multi-modal, culturally sensitive music experience",
        "author": "Shahd Mostafa Abdelrahman Mohamed Attia",
        "layers": {
            "1": "Multi-modal input (voice / text / quiz)",
            "2": "Real-time mood engine (Gemini + librosa)",
            "3": "Cultural context filter (7 regions)",
            "4": "AI music co-creation (Sonauto + LLM lyrics)",
            "5": "Reward & history (XP, streaks, badges)",
        },
        "docs": "/docs",
    }


@app.get("/health", summary="Health check")
async def health():
    return {"status": "ok", "service": "ekko-backend"}