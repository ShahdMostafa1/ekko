"""
Ekko — Public share endpoints (read-only, no auth).
GET /share/song/{song_id}     → song for public player page
GET /share/wrapped/{user_id}  → data for public Wrapped page
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from routers.music import _get_supabase

router = APIRouter(prefix="/share", tags=["Public share"])

_PUBLIC_SONG_SELECT = (
    "id,title,mood_label,emotion,region,region_label,cover_url,audio_url,task_id,"
    "lyrics,valence,energy,language,created_at,memory_note,memory_location,memory_photo_url"
)

_PUBLIC_SONG_KEYS = tuple(_PUBLIC_SONG_SELECT.split(","))


def _strip_user(song: dict) -> dict:
    if not song:
        return {}
    out = {k: song.get(k) for k in _PUBLIC_SONG_KEYS}
    out["has_memory"] = bool(
        (out.get("memory_note") or "").strip()
        or (out.get("memory_location") or "").strip()
        or (out.get("memory_photo_url") or "").strip()
    )
    return out


@router.get("/song/{song_id}", summary="Public song view")
async def public_song(song_id: str):
    sb = _get_supabase()
    if not sb:
        raise HTTPException(503, "Supabase not configured")
    try:
        resp = (
            sb.table("songs")
            .select(_PUBLIC_SONG_SELECT)
            .eq("id", song_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        print(f"[share] song fetch failed: {e}")
        raise HTTPException(500, "Could not load song") from e
    rows = resp.data or []
    if not rows:
        raise HTTPException(404, "Song not found")
    return {"song": _strip_user(rows[0])}


@router.get("/wrapped/{user_id}", summary="Public Wrapped summary data")
async def public_wrapped(user_id: str):
    sb = _get_supabase()
    if not sb:
        raise HTTPException(503, "Supabase not configured")
    year = datetime.utcnow().year
    profile = {}
    try:
        presp = (
            sb.table("profiles")
            .select("xp,full_name,region")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if presp.data:
            profile = presp.data[0]
    except Exception as e:
        print(f"[share] profile fetch: {e}")

    songs = []
    mood_logs = []
    try:
        sresp = (
            sb.table("songs")
            .select(
                "id,created_at,emotion,region,valence,energy,mood_label,title,"
                "is_favorite,memory_note,memory_location,memory_photo_url,cover_url,prompt_used"
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        songs = sresp.data or []
    except Exception as e:
        print(f"[share] songs fetch: {e}")

    try:
        mresp = (
            sb.table("mood_logs")
            .select("id,created_at,emotion,valence,arousal")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        mood_logs = mresp.data or []
    except Exception as e:
        print(f"[share] mood_logs fetch: {e}")

    display_name = (profile.get("full_name") or "").strip()
    return {
        "user_id": user_id,
        "year": year,
        "display_name": display_name,
        "xp": profile.get("xp") or 0,
        "songs": songs,
        "mood_logs": mood_logs,
    }
