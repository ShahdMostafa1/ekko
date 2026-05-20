"""
Ekko — Layer 5: Reward & History
POST /rewards/checkin       → points, streak, badges
GET  /rewards/{user_id}     → current reward state
POST /rewards/xp            → award XP for a specific action (idempotent per session_key)
"""

from __future__ import annotations

import os
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/rewards", tags=["Layer 5 — Reward & History"])

_local_rewards: dict[str, dict] = {}

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


# ── Helpers ───────────────────────────────────────────────────────────────────

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
      - "music_cocreated:{mood_session_id}"
      - "region_selected:{user_id}"   (only once ever)
    """
    if req.action not in XP_AMOUNTS:
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}. Valid: {list(XP_AMOUNTS.keys())}")

    xp_amount = XP_AMOUNTS[req.action]
    sb = _get_supabase()

    if _was_awarded(req.user_id, req.session_key, sb):
        # Already awarded — return current XP without adding more
        if sb:
            profile = sb.table("profiles").select("xp").eq("id", req.user_id).execute()
            current_xp = profile.data[0]["xp"] if profile.data else 0
        else:
            current_xp = _local_rewards.get(req.user_id, {}).get("points", 0)
        return {
            "awarded":     False,
            "reason":      "Already awarded for this session_key",
            "xp_awarded":  0,
            "total_xp":    current_xp,
        }

    # Award XP
    _mark_awarded(req.user_id, req.session_key, req.action, xp_amount, sb)
    _add_xp_to_profile(req.user_id, xp_amount, sb)

    if sb:
        profile = sb.table("profiles").select("xp").eq("id", req.user_id).execute()
        total_xp = profile.data[0]["xp"] if profile.data else xp_amount
    else:
        local = _local_rewards.get(req.user_id, {"points": 0})
        local["points"] = local.get("points", 0) + xp_amount
        _local_rewards[req.user_id] = local
        total_xp = local["points"]

    return {
        "awarded":    True,
        "xp_awarded": xp_amount,
        "total_xp":   total_xp,
        "action":     req.action,
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