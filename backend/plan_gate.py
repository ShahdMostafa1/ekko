"""Plan checks + Studio API key auth — keep in sync with frontend planUtils.js."""
from __future__ import annotations

import os
import secrets
from fastapi import Header, HTTPException, Request

STUDIO_PLAN = "studio"
PAID_PLANS = {"groove", "studio"}


def _get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_KEY")
    )
    if not url or not key:
        return None
    return create_client(url, key)


def get_user_plan(user_id: str) -> str:
    sb = _get_supabase()
    if not sb or not user_id:
        return "free"
    try:
        resp = sb.table("profiles").select("plan").eq("id", user_id).single().execute()
        plan = (resp.data or {}).get("plan") or "free"
        return plan if plan in PAID_PLANS | {"free"} else "free"
    except Exception:
        return "free"


def generate_api_key() -> str:
    return f"ekko_{secrets.token_urlsafe(32)}"


def mask_api_key(key: str | None) -> str | None:
    if not key or len(key) < 12:
        return None
    return f"{key[:8]}…{key[-4:]}"


def lookup_user_by_api_key(api_key: str) -> dict | None:
    sb = _get_supabase()
    if not sb or not api_key:
        return None
    try:
        resp = (
            sb.table("profiles")
            .select("id, plan, email, api_key")
            .eq("api_key", api_key)
            .maybe_single()
            .execute()
        )
        return resp.data
    except Exception:
        return None


async def require_studio_api_key(
    request: Request,
    x_ekko_api_key: str | None = Header(None, alias="X-Ekko-API-Key"),
) -> str:
    """FastAPI dependency — Studio plan + valid API key. Returns user_id."""
    api_key = x_ekko_api_key or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not api_key:
        raise HTTPException(
            401,
            detail={
                "error": "api_key_required",
                "message": "Studio API access requires X-Ekko-API-Key header.",
            },
        )

    profile = lookup_user_by_api_key(api_key)
    if not profile:
        raise HTTPException(401, detail={"error": "invalid_api_key", "message": "Invalid API key."})

    plan = profile.get("plan") or "free"
    if plan != STUDIO_PLAN:
        raise HTTPException(
            403,
            detail={
                "error": "studio_required",
                "message": "API access is available on the Studio plan only.",
                "plan": plan,
            },
        )

    request.state.api_user_id = profile["id"]
    request.state.api_plan = plan
    return profile["id"]
