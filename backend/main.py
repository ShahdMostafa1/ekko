import os
from dotenv import load_dotenv
load_dotenv()   # ← must be BEFORE any router imports

import anthropic
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.auth import router as auth_router
from routers.mood import router as mood_router
from routers.music import router as music_router
from routers.rewards import router as rewards_router

app = FastAPI(
    title="Ekko: Musical Mood Journeys",
    description="Five-layer architecture: multi-modal input → mood engine → cultural filter → AI music co-creation → reward & history.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mood_router)
app.include_router(music_router)
app.include_router(rewards_router)
app.include_router(auth_router)

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "Ekko backend is running"}

@app.get("/test-llm", tags=["health"])
def test_llm():
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{"role": "user", "content": "Say hello from Ekko"}],
    )
    return {"response": message.content[0].text}