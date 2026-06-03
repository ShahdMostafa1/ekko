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
    for table in ("songs", "mood_logs", "mood_sessions", "xp_events", "user_rewards", "study_surveys"):
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
