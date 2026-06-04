"""
Ekko — Layer 5: Reward & History
POST /rewards/checkin       → points, streak, badges
GET  /rewards/{user_id}     → current reward state
POST /rewards/xp            → award XP for a specific action (idempotent per session_key)
"""

from __future__ import annotations

import os
from datetime import date, timedelta, datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/rewards", tags=["Layer 5 — Reward & History"])

_local_rewards: dict[str, dict] = {}

DAILY_CHALLENGES = {
    "dc1": {"emoji": "🌅", "label": "Morning Mood",  "desc": "Share a mood before noon",  "xp": 15},
    "dc2": {"emoji": "🎭", "label": "Emotion Flip",  "desc": "Try a new region today",    "xp": 20},
    "dc3": {"emoji": "🌙", "label": "Night Session", "desc": "Create a song after 9 PM",  "xp": 25},
    "dc4": {"emoji": "🎲", "label": "Random Vibes",  "desc": "Use the quiz mood input",   "xp": 15},
    "dc5": {"emoji": "🔁", "label": "Double Down",   "desc": "Generate 2 songs today",    "xp": 30},
}
DAILY_CHALLENGE_IDS = ["dc1", "dc2", "dc3", "dc4", "dc5"]

# Tracks which (user_id, session_key) pairs have already been awarded XP
# so the same action can't be repeated within a server session.
# For persistent deduplication across restarts, use the xp_events table (see below).
_awarded_keys: set[str] = set()


def _get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    from supabase import create_client
    return create_client(url, key)


BADGE_RULES = [
    ("first_checkin",  lambda r: r["streak"] >= 1,   "First Check-In"),
    ("week_streak",    lambda r: r["streak"] >= 7,   "7-Day Streak 🔥"),
    ("month_streak",   lambda r: r["streak"] >= 30,  "30-Day Streak 🏆"),
    ("century_points", lambda r: r["points"] >= 100, "100 Points 💯"),
]

# XP awarded per action (single source of truth)
XP_AMOUNTS = {
    "region_selected":    5,
    "mood_shared":        10,
    "music_cocreated":    20,
    "daily_checkin":      10,
}


def _compute_badges(reward_row: dict) -> list[str]:
    badges = list(reward_row.get("badges") or [])
    for badge_id, condition, _ in BADGE_RULES:
        if badge_id not in badges and condition(reward_row):
            badges.append(badge_id)
    return badges


# ── Models ────────────────────────────────────────────────────────────────────

class CheckinRequest(BaseModel):
    user_id: str


class XpRequest(BaseModel):
    user_id:     str
    action:      str   # must be a key in XP_AMOUNTS
    session_key: str   # unique per action occurrence, e.g. "mood_shared:{song_id}" or "music_cocreated:{session_id}"


class DailyChallengeClaimRequest(BaseModel):
    user_id: str
    trigger: str = ""   # mood_shared | quiz_used | region_changed | song_saved


class UnlockArtistRequest(BaseModel):
    user_id: str
    artist_style_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _today_challenge_id() -> str:
    day_of_year = date.today().timetuple().tm_yday
    return DAILY_CHALLENGE_IDS[day_of_year % len(DAILY_CHALLENGE_IDS)]


def _daily_challenge_session_key(challenge_id: str | None = None) -> str:
    cid = challenge_id or _today_challenge_id()
    return f"daily_challenge:{date.today()}:{cid}"


def _today_start_iso() -> str:
    return datetime.combine(date.today(), datetime.min.time()).isoformat()


def _count_today_activity(sb, user_id: str) -> int:
    if not sb:
        return 0
    start = _today_start_iso()
    try:
        songs = (
            sb.table("songs")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", start)
            .execute()
        )
        if songs.count:
            return songs.count
    except Exception:
        pass
    try:
        sessions = (
            sb.table("mood_sessions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", start)
            .execute()
        )
        return sessions.count or 0
    except Exception:
        return 0


def _challenge_met(sb, user_id: str, challenge_id: str, trigger: str) -> bool:
    hour = datetime.now().hour

    if challenge_id == "dc1":
        return hour < 12 and trigger in ("mood_shared", "quiz_used", "")

    if challenge_id == "dc2":
        if trigger == "region_changed":
            return True
        if not sb:
            return False
        try:
            profile = sb.table("profiles").select("region").eq("id", user_id).single().execute()
            home_region = (profile.data or {}).get("region") or "global"
            sessions = (
                sb.table("mood_sessions")
                .select("region")
                .eq("user_id", user_id)
                .gte("created_at", _today_start_iso())
                .execute()
            )
            for row in sessions.data or []:
                reg = row.get("region") or "global"
                if reg != home_region:
                    return True
        except Exception:
            pass
        return False

    if challenge_id == "dc3":
        return hour >= 21 and trigger in ("song_saved", "music_cocreated", "")

    if challenge_id == "dc4":
        return trigger == "quiz_used"

    if challenge_id == "dc5":
        return _count_today_activity(sb, user_id) >= 2

    return False

def _was_awarded(user_id: str, session_key: str, sb) -> bool:
    """Return True if this (user_id, session_key) was already awarded XP."""
    dedup_key = f"{user_id}:{session_key}"

    # In-memory fast check
    if dedup_key in _awarded_keys:
        return True

    # Supabase persistent check (survives server restarts)
    if sb:
        resp = (
            sb.table("xp_events")
            .select("id")
            .eq("user_id", user_id)
            .eq("session_key", session_key)
            .execute()
        )
        if resp.data:
            _awarded_keys.add(dedup_key)
            return True

    return False


def _mark_awarded(user_id: str, session_key: str, action: str, xp: int, sb):
    """Record that this (user_id, session_key) was awarded XP."""
    dedup_key = f"{user_id}:{session_key}"
    _awarded_keys.add(dedup_key)

    if sb:
        sb.table("xp_events").insert({
            "user_id":     user_id,
            "action":      action,
            "xp":          xp,
            "session_key": session_key,
        }).execute()


def _add_xp_to_profile(user_id: str, amount: int, sb):
    """Increment xp column in profiles table."""
    if not sb:
        return
    profile_resp = sb.table("profiles").select("xp").eq("id", user_id).execute()
    if profile_resp.data:
        current_xp = profile_resp.data[0].get("xp") or 0
        sb.table("profiles").update({"xp": current_xp + amount}).eq("id", user_id).execute()


def _current_profile_xp(user_id: str, sb) -> int:
    if sb:
        profile = sb.table("profiles").select("xp").eq("id", user_id).execute()
        return profile.data[0]["xp"] if profile.data else 0
    return _local_rewards.get(user_id, {}).get("points", 0)


def song_creation_session_key(song_id: str) -> str:
    """One XP award per saved song row."""
    return f"song_created:{song_id}"


def award_xp_idempotent(user_id: str, action: str, session_key: str, sb=None) -> dict:
    """Award XP once per (user_id, session_key). Safe to call repeatedly."""
    if action not in XP_AMOUNTS:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}. Valid: {list(XP_AMOUNTS.keys())}")
    if sb is None:
        sb = _get_supabase()

    xp_amount = XP_AMOUNTS[action]
    if _was_awarded(user_id, session_key, sb):
        return {
            "awarded":    False,
            "reason":     "already_awarded",
            "xp_awarded": 0,
            "total_xp":   _current_profile_xp(user_id, sb),
            "action":     action,
        }

    _mark_awarded(user_id, session_key, action, xp_amount, sb)
    _add_xp_to_profile(user_id, xp_amount, sb)

    if not sb:
        local = _local_rewards.get(user_id, {"points": 0})
        local["points"] = local.get("points", 0) + xp_amount
        _local_rewards[user_id] = local

    return {
        "awarded":    True,
        "xp_awarded": xp_amount,
        "total_xp":   _current_profile_xp(user_id, sb),
        "action":     action,
    }


# ── Artist unlock (XP) ────────────────────────────────────────────────────────

@router.post("/unlock-artist", summary="Unlock artist with XP (list positions 3–7 only)")
async def unlock_artist(req: UnlockArtistRequest):
    from routers.music import (
        ARTIST_STYLES,
        ARTIST_UNLOCK_XP_COST,
        FREE_ARTISTS_PER_REGION,
        _artist_style_meta,
        _get_unlocked_artists,
        _get_profile_xp,
        _is_xp_eligible_artist_index,
    )

    sb = _get_supabase()
    if not sb:
        raise HTTPException(503, "Database unavailable")

    meta = _artist_style_meta(req.artist_style_id)
    if not meta:
        raise HTTPException(404, detail="Unknown artist style")

    _, idx = meta
    if idx < FREE_ARTISTS_PER_REGION:
        raise HTTPException(400, detail="Artist already included on Free plan")
    if not _is_xp_eligible_artist_index(idx):
        raise HTTPException(
            403,
            detail={
                "error": "plan_required",
                "message": "This artist is only available on Groove or Studio.",
            },
        )

    unlocked = _get_unlocked_artists(sb, req.user_id)
    if req.artist_style_id in unlocked:
        return {
            "ok": True,
            "already_unlocked": True,
            "artist_style_id": req.artist_style_id,
            "unlocked_artists": unlocked,
            "total_xp": _get_profile_xp(sb, req.user_id),
            "xp_spent": 0,
        }

    session_key = f"artist_unlock:{req.artist_style_id}"
    if _was_awarded(req.user_id, session_key, sb):
        return {
            "ok": True,
            "already_unlocked": True,
            "artist_style_id": req.artist_style_id,
            "unlocked_artists": unlocked,
            "total_xp": _get_profile_xp(sb, req.user_id),
            "xp_spent": 0,
        }

    current_xp = _get_profile_xp(sb, req.user_id)
    if current_xp < ARTIST_UNLOCK_XP_COST:
        raise HTTPException(
            400,
            detail={
                "error": "insufficient_xp",
                "message": "Generate more music and complete challenges to earn XP.",
                "required": ARTIST_UNLOCK_XP_COST,
                "current": current_xp,
            },
        )

    new_xp = current_xp - ARTIST_UNLOCK_XP_COST
    unlocked.append(req.artist_style_id)
    try:
        sb.table("profiles").update({
            "xp": new_xp,
            "unlocked_artists": unlocked,
        }).eq("id", req.user_id).execute()
        sb.table("xp_events").insert({
            "user_id": req.user_id,
            "action": "artist_unlock",
            "xp": -ARTIST_UNLOCK_XP_COST,
            "session_key": session_key,
        }).execute()
        _awarded_keys.add(f"{req.user_id}:{session_key}")
    except Exception as e:
        raise HTTPException(500, f"Could not unlock artist: {e}") from e

    label = req.artist_style_id
    for styles in ARTIST_STYLES.values():
        for s in styles:
            if s["id"] == req.artist_style_id:
                label = s["label"]
                break

    return {
        "ok": True,
        "already_unlocked": False,
        "artist_style_id": req.artist_style_id,
        "artist_label": label,
        "unlocked_artists": unlocked,
        "total_xp": new_xp,
        "xp_spent": ARTIST_UNLOCK_XP_COST,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/checkin", summary="Daily mood check-in (Layer 5)")
async def checkin(req: CheckinRequest):
    """
    Idempotent daily check-in. Awarding only happens once per calendar day per user.
    """
    sb = _get_supabase()
    today     = date.today()
    yesterday = str(today - timedelta(days=1))
    today_str = str(today)

    if sb:
        row_resp = (
            sb.table("user_rewards")
            .select("*")
            .eq("user_id", req.user_id)
            .execute()
        )
        if row_resp.data:
            r = row_resp.data[0]
            if r["last_checkin"] == today_str:
                # Already checked in today — return current state, no XP added
                return {
                    "points":  r["points"],
                    "streak":  r["streak"],
                    "badges":  r["badges"],
                    "message": "Already checked in today!",
                }
            streak = r["streak"] + 1 if r["last_checkin"] == yesterday else 1
            points = r["points"] + XP_AMOUNTS["daily_checkin"]
            badges = _compute_badges({**r, "streak": streak, "points": points})
            sb.table("user_rewards").update({
                "points": points, "streak": streak,
                "last_checkin": today_str, "badges": badges,
            }).eq("user_id", req.user_id).execute()
        else:
            streak = 1
            points = XP_AMOUNTS["daily_checkin"]
            badges = _compute_badges({"streak": streak, "points": points, "badges": []})
            sb.table("user_rewards").insert({
                "user_id": req.user_id, "points": points,
                "streak": streak, "last_checkin": today_str, "badges": badges,
            }).execute()

        # Log XP event (session_key = "checkin:{date}" for dedup)
        session_key = f"daily_checkin:{today_str}"
        if not _was_awarded(req.user_id, session_key, sb):
            _mark_awarded(req.user_id, session_key, "daily_checkin", XP_AMOUNTS["daily_checkin"], sb)
            _add_xp_to_profile(req.user_id, XP_AMOUNTS["daily_checkin"], sb)

    else:
        # Local fallback (no Supabase)
        r = _local_rewards.get(req.user_id, {
            "points": 0, "streak": 0, "last_checkin": None, "badges": [],
        })
        if r["last_checkin"] == today_str:
            return {
                "points":  r["points"],
                "streak":  r["streak"],
                "badges":  r["badges"],
                "message": "Already checked in today!",
            }
        streak = r["streak"] + 1 if r["last_checkin"] == yesterday else 1
        points = r["points"] + XP_AMOUNTS["daily_checkin"]
        badges = _compute_badges({**r, "streak": streak, "points": points})
        _local_rewards[req.user_id] = {
            "points": points, "streak": streak,
            "last_checkin": today_str, "badges": badges,
        }

    return {"points": points, "streak": streak, "badges": badges}


@router.post("/xp", summary="Award XP for an action (idempotent)")
async def award_xp(req: XpRequest):
    """
    Award XP for a specific action. Uses session_key to ensure the same
    action is never awarded twice (e.g. regenerating a song doesn't give more XP).

    session_key should be unique per occurrence, e.g.:
      - "mood_shared:{mood_session_id}"
      - "song_created:{song_uuid}"   (one music_cocreated award per saved song)
      - "region_selected:{user_id}"   (only once ever)
    """
    sb = _get_supabase()
    return award_xp_idempotent(req.user_id, req.action, req.session_key, sb)


@router.get("/daily-challenge/{user_id}", summary="Today's daily challenge status")
async def get_daily_challenge(user_id: str):
    sb = _get_supabase()
    cid = _today_challenge_id()
    info = DAILY_CHALLENGES[cid]
    session_key = _daily_challenge_session_key(cid)
    completed = _was_awarded(user_id, session_key, sb)
    return {
        "id": cid,
        "date": str(date.today()),
        "completed": completed,
        **info,
    }


@router.post("/daily-challenge/claim", summary="Claim today's daily challenge XP")
async def claim_daily_challenge(req: DailyChallengeClaimRequest):
    sb = _get_supabase()
    cid = _today_challenge_id()
    session_key = _daily_challenge_session_key(cid)

    if _was_awarded(req.user_id, session_key, sb):
        total = 0
        if sb:
            profile = sb.table("profiles").select("xp").eq("id", req.user_id).execute()
            total = profile.data[0]["xp"] if profile.data else 0
        return {
            "awarded": False,
            "reason": "already_completed",
            "challenge_id": cid,
            "total_xp": total,
        }

    if not _challenge_met(sb, req.user_id, cid, req.trigger):
        return {
            "awarded": False,
            "reason": "conditions_not_met",
            "challenge_id": cid,
            "challenge": DAILY_CHALLENGES[cid],
        }

    xp_amount = DAILY_CHALLENGES[cid]["xp"]
    _mark_awarded(req.user_id, session_key, "daily_challenge", xp_amount, sb)
    _add_xp_to_profile(req.user_id, xp_amount, sb)

    if sb:
        profile = sb.table("profiles").select("xp").eq("id", req.user_id).execute()
        total_xp = profile.data[0]["xp"] if profile.data else xp_amount
    else:
        total_xp = xp_amount

    return {
        "awarded": True,
        "xp_awarded": xp_amount,
        "total_xp": total_xp,
        "challenge_id": cid,
        "label": DAILY_CHALLENGES[cid]["label"],
    }


@router.get("/{user_id}", summary="Get current reward state")
async def get_rewards(user_id: str):
    sb = _get_supabase()
    if sb:
        resp = (
            sb.table("user_rewards")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        if resp.data:
            return resp.data[0]
        return {"user_id": user_id, "points": 0, "streak": 0, "badges": []}
    return _local_rewards.get(
        user_id,
        {"user_id": user_id, "points": 0, "streak": 0, "badges": []},
    )