"""
Ekko Studio API v1 — programmatic access (Studio plan + API key).

Auth: X-Ekko-API-Key: ekko_…
Also enforced by StudioApiMiddleware on all /api/v1/* routes.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from plan_gate import require_studio_api_key
from routers.music import (
    GenerateRequest,
    generate_music,
    get_song_history,
    get_status,
    get_usage,
)

router = APIRouter(prefix="/api/v1", tags=["Studio API v1"])


@router.get("", summary="API info (public)")
async def api_info():
    return {
        "name": "Ekko Studio API",
        "version": "1",
        "auth": "X-Ekko-API-Key header (Studio plan)",
        "endpoints": {
            "POST /api/v1/generate": "Generate a song",
            "GET  /api/v1/status/{task_id}": "Poll generation status",
            "GET  /api/v1/songs": "List your songs",
            "GET  /api/v1/usage": "Daily generation usage",
        },
    }


@router.post("/generate", summary="Generate song (Studio API)")
async def api_generate(
    req: GenerateRequest,
    user_id: str = Depends(require_studio_api_key),
):
    req.user_id = user_id
    return await generate_music(req)


@router.get("/status/{task_id}", summary="Poll generation status (Studio API)")
async def api_status(
    task_id: str,
    _user_id: str = Depends(require_studio_api_key),
):
    return await get_status(task_id)


@router.get("/songs", summary="Song history (Studio API)")
async def api_songs(user_id: str = Depends(require_studio_api_key)):
    return await get_song_history(user_id)


@router.get("/usage", summary="Daily usage (Studio API)")
async def api_usage(user_id: str = Depends(require_studio_api_key)):
    return await get_usage(user_id)
