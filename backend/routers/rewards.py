"""
Ekko — Layer 5: Reward & History
POST /rewards/checkin   →  points, streak, badges
GET  /rewards/{user_id} →  current reward state
"""

from __future__ import annotations

import os
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/rewards", tags=["Layer 5 — Reward & History"])

_local_rewards: dict[str, dict] = {}


def _get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    from supabase import create_client
    return create_client(url, key)


BADGE_RULES = [
    ("first_checkin",  lambda r: r["streak"] >= 1,  "First Check-In"),
    ("week_streak",    lambda r: r["streak"] >= 7,  "7-Day Streak 🔥"),
    ("month_streak",   lambda r: r["streak"] >= 30, "30-Day Streak 🏆"),
    ("century_points", lambda r: r["points"] >= 100, "100 Points 💯"),
]


def _compute_badges(reward_row: dict) -> list[str]:
    badges = list(reward_row.get("badges") or [])
    for badge_id, condition, _ in BADGE_RULES:
        if badge_id not in badges and condition(reward_row):
            badges.append(badge_id)
    return badges


class CheckinRequest(BaseModel):
    user_id: str


@router.post("/checkin", summary="Daily mood check-in (Layer 5)")
async def checkin(req: CheckinRequest):
    sb = _get_supabase()
    today = date.today()
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
                return {
                    "points":  r["points"],
                    "streak":  r["streak"],
                    "badges":  r["badges"],
                    "message": "Already checked in today!",
                }
            streak = r["streak"] + 1 if r["last_checkin"] == yesterday else 1
            points = r["points"] + 10
            badges = _compute_badges({**r, "streak": streak, "points": points})
            sb.table("user_rewards").update(
                {"points": points, "streak": streak,
                 "last_checkin": today_str, "badges": badges}
            ).eq("user_id", req.user_id).execute()
        else:
            streak, points = 1, 10
            badges = _compute_badges({"streak": streak, "points": points, "badges": []})
            sb.table("user_rewards").insert(
                {"user_id": req.user_id, "points": points,
                 "streak": streak, "last_checkin": today_str, "badges": badges}
            ).execute()

        # ── Always log to xp_events ──────────────────────────────────────
        sb.table("xp_events").insert({
            "user_id": req.user_id,
            "action":  "daily_checkin",
            "xp":      10,
        }).execute()

        # ── Keep profiles.xp in sync ─────────────────────────────────────
        profile_resp = sb.table("profiles").select("xp").eq("id", req.user_id).execute()
        if profile_resp.data:
            current_xp = profile_resp.data[0].get("xp") or 0
            sb.table("profiles").update({"xp": current_xp + 10}).eq("id", req.user_id).execute()

    else:
        r = _local_rewards.get(req.user_id, {
            "points": 0, "streak": 0, "last_checkin": None, "badges": []
        })
        if r["last_checkin"] == today_str:
            return {
                "points":  r["points"],
                "streak":  r["streak"],
                "badges":  r["badges"],
                "message": "Already checked in today!",
            }
        streak = r["streak"] + 1 if r["last_checkin"] == yesterday else 1
        points = r["points"] + 10
        badges = _compute_badges({**r, "streak": streak, "points": points})
        _local_rewards[req.user_id] = {
            "points": points, "streak": streak,
            "last_checkin": today_str, "badges": badges,
        }

    return {"points": points, "streak": streak, "badges": badges}


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
        {"user_id": user_id, "points": 0, "streak": 0, "badges": []}
    )