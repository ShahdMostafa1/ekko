"""
Ekko — FastAPI Backend Entry Point
"""
from __future__ import annotations
import asyncio
import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Ekko: Musical Mood Journeys",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://ekko-silk.vercel.app",       # ← your actual Vercel URL
    "https://ekko-s8pl.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # covers all Vercel preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
from routers.mood          import router as mood_router
from routers.music         import router as music_router
from routers.rewards       import router as rewards_router
from routers.stripe_router import router as stripe_router

app.include_router(mood_router)
app.include_router(music_router)
app.include_router(rewards_router)
app.include_router(stripe_router)


# ── Keep-alive ────────────────────────────────────────────────
async def _keep_alive():
    render_url = os.getenv("RENDER_EXTERNAL_URL")
    if not render_url:
        print("[keepalive] RENDER_EXTERNAL_URL not set — skipping")
        return
    await asyncio.sleep(60)
    print(f"[keepalive] starting — will ping {render_url}/health every 10 min")
    while True:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{render_url}/health", timeout=10)
                print(f"[keepalive] pinged — status {resp.status_code}")
        except Exception as e:
            print(f"[keepalive] ping failed: {e}")
        await asyncio.sleep(600)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(_keep_alive())
    print("[ekko] ✅ Backend started — all layers online")


@app.get("/")
async def root():
    return {"project": "Ekko", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ekko-backend"}