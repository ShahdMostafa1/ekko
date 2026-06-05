"""
Admin — user management (service role only).
DELETE /admin/users/{user_id}  → remove user and all related data
GET    /admin/surveys            → list study survey responses
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException

from routers.survey import list_local_surveys

router = APIRouter(prefix="/admin", tags=["Admin"])

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@ekko.app")
# Server-only fallback for scripts; never embed in frontend bundles.
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")


def _user_from_bearer(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:].strip()
    if not token:
        return None
    sb = _get_supabase_admin()
    if not sb:
        return None
    try:
        res = sb.auth.get_user(token)
        user = getattr(res, "user", None) or (res.get("user") if isinstance(res, dict) else None)
        email = getattr(user, "email", None) or (user.get("email") if isinstance(user, dict) else None)
        return email
    except Exception:
        return None


def _require_admin(
    x_admin_secret: str | None = None,
    authorization: str | None = None,
) -> None:
    email = _user_from_bearer(authorization)
    if email and email.lower() == ADMIN_EMAIL.lower():
        return
    if ADMIN_SECRET and x_admin_secret and x_admin_secret == ADMIN_SECRET:
        return
    raise HTTPException(status_code=403, detail="Admin access denied")


def _get_supabase_admin():
    url = os.getenv("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_KEY")
    )
    if not url or not key:
        return None
    from supabase import create_client
    return create_client(url, key)


def _delete_user_data(sb, user_id: str) -> dict[str, int]:
    """Delete all app rows for a user. Returns counts per table."""
    counts: dict[str, int] = {}
    for table in (
        "songs",
        "mood_logs",
        "mood_sessions",
        "xp_events",
        "user_rewards",
        "study_surveys",
    ):
        try:
            resp = sb.table(table).delete().eq("user_id", user_id).execute()
            counts[table] = len(resp.data or [])
        except Exception:
            counts[table] = 0
    try:
        sb.table("profiles").delete().eq("id", user_id).execute()
        counts["profiles"] = 1
    except Exception:
        counts["profiles"] = 0
    return counts


@router.delete("/users/{user_id}", summary="Permanently delete a user and all data")
async def delete_user(
    user_id: str,
    x_admin_secret: str | None = Header(None, alias="X-Admin-Secret"),
    authorization: str | None = Header(None),
):
    _require_admin(x_admin_secret, authorization)
    sb = _get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Database not configured")

    if user_id.strip() == "":
        raise HTTPException(status_code=400, detail="Invalid user_id")

    try:
        prof = sb.table("profiles").select("email").eq("id", user_id).single().execute()
        if (prof.data or {}).get("email") == "admin@ekko.app":
            raise HTTPException(status_code=403, detail="Cannot delete admin account")
    except HTTPException:
        raise
    except Exception:
        pass

    counts = _delete_user_data(sb, user_id)

    auth_deleted = False
    try:
        sb.auth.admin.delete_user(user_id)
        auth_deleted = True
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"App data removed but auth delete failed: {e}",
        )

    return {
        "deleted": True,
        "user_id": user_id,
        "auth_deleted": auth_deleted,
        "rows_removed": counts,
    }


@router.get("/surveys", summary="List all pre/post study survey responses")
async def list_surveys(
    x_admin_secret: str | None = Header(None, alias="X-Admin-Secret"),
    authorization: str | None = Header(None),
):
    _require_admin(x_admin_secret, authorization)
    sb = _get_supabase_admin()
    if not sb:
        local = list_local_surveys()
        return {
            "surveys": local,
            "warning": "SUPABASE_URL or service key missing on backend — only in-memory surveys (if any).",
        }
    try:
        resp = (
            sb.table("study_surveys")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        surveys = list(resp.data or [])
    except Exception as e:
        err = str(e)
        if "study_surveys" in err.lower() or "does not exist" in err.lower():
            local = list_local_surveys()
            return {
                "surveys": local,
                "warning": "study_surveys table missing — run add_study_surveys.sql and extend_study_surveys.sql in Supabase.",
            }
        raise HTTPException(status_code=500, detail=err)

    emails: dict[str, str] = {}
    try:
        profiles = sb.table("profiles").select("id, email").execute()
        for p in profiles.data or []:
            emails[p["id"]] = p.get("email") or ""
    except Exception:
        pass

    seen = {(r.get("user_id"), r.get("phase")) for r in surveys}
    for row in list_local_surveys():
        key = (row.get("user_id"), row.get("phase"))
        if key not in seen:
            surveys.append(row)
            seen.add(key)

    for row in surveys:
        row["email"] = emails.get(row.get("user_id"), "")

    out: dict = {"surveys": surveys}
    if not surveys:
        out["warning"] = (
            "No rows in study_surveys yet. Confirm migrations ran and testers completed pre/post surveys."
        )
    return out


@router.get("/mood-logs", summary="List all mood log entries (service role)")
async def list_mood_logs(
    x_admin_secret: str | None = Header(None, alias="X-Admin-Secret"),
    authorization: str | None = Header(None),
):
    _require_admin(x_admin_secret, authorization)
    sb = _get_supabase_admin()
    if not sb:
        return {"mood_logs": [], "warning": "SUPABASE_URL or service key missing on backend."}
    try:
        resp = (
            sb.table("mood_logs")
            .select("*")
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
        )
        logs = list(resp.data or [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    emails: dict[str, str] = {}
    try:
        profiles = sb.table("profiles").select("id, email").execute()
        for p in profiles.data or []:
            emails[p["id"]] = p.get("email") or ""
    except Exception:
        pass

    for row in logs:
        row["email"] = emails.get(row.get("user_id"), "")

    return {"mood_logs": logs}


def _profile_emails(sb) -> dict[str, str]:
    emails: dict[str, str] = {}
    try:
        resp = sb.table("profiles").select("id, email").execute()
        for p in resp.data or []:
            emails[p["id"]] = p.get("email") or ""
    except Exception:
        pass
    return emails


@router.get("/mood-sessions", summary="List co-creation mood sessions")
async def list_mood_sessions(
    x_admin_secret: str | None = Header(None, alias="X-Admin-Secret"),
    authorization: str | None = Header(None),
):
    _require_admin(x_admin_secret, authorization)
    sb = _get_supabase_admin()
    if not sb:
        return {"mood_sessions": [], "warning": "SUPABASE_URL or service key missing on backend."}
    try:
        resp = (
            sb.table("mood_sessions")
            .select("*")
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
        )
        rows = list(resp.data or [])
    except Exception as e:
        err = str(e)
        if "mood_sessions" in err.lower() or "does not exist" in err.lower():
            return {"mood_sessions": [], "warning": "Table mood_sessions not found."}
        raise HTTPException(status_code=500, detail=err) from e

    emails = _profile_emails(sb)
    for row in rows:
        row["email"] = emails.get(row.get("user_id"), "")
    return {"mood_sessions": rows}


@router.get("/stats", summary="Aggregated platform statistics")
async def admin_stats(
    x_admin_secret: str | None = Header(None, alias="X-Admin-Secret"),
    authorization: str | None = Header(None),
):
    _require_admin(x_admin_secret, authorization)
    sb = _get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Database not configured")

    def _count(table: str) -> int:
        try:
            resp = sb.table(table).select("id", count="exact").limit(1).execute()
            return int(resp.count or 0)
        except Exception:
            try:
                resp = sb.table(table).select("id").execute()
                return len(resp.data or [])
            except Exception:
                return 0

    profiles = []
    try:
        profiles = sb.table("profiles").select("id, xp, plan, region").execute().data or []
    except Exception:
        pass

    songs = []
    try:
        songs = (
            sb.table("songs")
            .select(
                "id, region, emotion, is_favorite, cover_url, "
                "memory_note, memory_location, memory_photo_url, created_at"
            )
            .execute()
            .data
            or []
        )
    except Exception:
        pass

    moods = []
    try:
        moods = sb.table("mood_logs").select("emotion, language").execute().data or []
    except Exception:
        pass

    surveys = []
    try:
        surveys = sb.table("study_surveys").select("phase").execute().data or []
    except Exception:
        pass

    xp_by_action: dict[str, int] = {}
    try:
        events = sb.table("xp_events").select("action, xp").execute().data or []
        for ev in events:
            act = ev.get("action") or "unknown"
            xp_by_action[act] = xp_by_action.get(act, 0) + int(ev.get("xp") or 0)
    except Exception:
        pass

    plan_counts: dict[str, int] = {}
    for p in profiles:
        plan = (p.get("plan") or "free").lower()
        plan_counts[plan] = plan_counts.get(plan, 0) + 1

    region_counts: dict[str, int] = {}
    emotion_song: dict[str, int] = {}
    for song in songs:
        r = song.get("region") or "global"
        region_counts[r] = region_counts.get(r, 0) + 1
        e = song.get("emotion") or "neutral"
        emotion_song[e] = emotion_song.get(e, 0) + 1

    emotion_mood: dict[str, int] = {}
    lang_counts: dict[str, int] = {}
    for m in moods:
        e = m.get("emotion") or "neutral"
        emotion_mood[e] = emotion_mood.get(e, 0) + 1
        lang = m.get("language") or "unknown"
        lang_counts[lang] = lang_counts.get(lang, 0) + 1

    def _has_memory(s: dict) -> bool:
        return bool(
            (s.get("memory_note") or "").strip()
            or (s.get("memory_location") or "").strip()
            or (s.get("memory_photo_url") or "").strip()
        )

    memories = sum(1 for s in songs if _has_memory(s))
    favorites = sum(1 for s in songs if s.get("is_favorite"))
    covers = sum(1 for s in songs if s.get("cover_url"))

    return {
        "counts": {
            "profiles": len(profiles) or _count("profiles"),
            "songs": len(songs) or _count("songs"),
            "mood_logs": len(moods) or _count("mood_logs"),
            "mood_sessions": _count("mood_sessions"),
            "xp_events": _count("xp_events"),
            "user_rewards": _count("user_rewards"),
            "study_surveys": len(surveys) or _count("study_surveys"),
            "surveys_pre": sum(1 for s in surveys if s.get("phase") == "pre"),
            "surveys_post": sum(1 for s in surveys if s.get("phase") == "post"),
            "favorites": favorites,
            "memories": memories,
            "covers": covers,
        },
        "total_xp": sum(int(p.get("xp") or 0) for p in profiles),
        "plan_counts": plan_counts,
        "region_counts": region_counts,
        "emotion_song": emotion_song,
        "emotion_mood": emotion_mood,
        "lang_counts": lang_counts,
        "xp_by_action": xp_by_action,
    }
