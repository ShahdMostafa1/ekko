"""HTTP middleware — block /api/v1/* without Studio API key (except public info route)."""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from plan_gate import STUDIO_PLAN, lookup_user_by_api_key

PUBLIC_API_V1_PATHS = {"/api/v1", "/api/v1/"}


class StudioApiMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if not path.startswith("/api/v1"):
            return await call_next(request)

        if path.rstrip("/") == "/api/v1" or request.method == "OPTIONS":
            return await call_next(request)

        api_key = request.headers.get("X-Ekko-API-Key")
        if not api_key:
            auth = request.headers.get("Authorization", "")
            if auth.lower().startswith("bearer "):
                api_key = auth[7:].strip()

        if not api_key:
            return JSONResponse(
                status_code=401,
                content={
                    "error": "api_key_required",
                    "message": "Studio API access requires X-Ekko-API-Key header.",
                },
            )

        profile = lookup_user_by_api_key(api_key)
        if not profile:
            return JSONResponse(
                status_code=401,
                content={"error": "invalid_api_key", "message": "Invalid API key."},
            )

        if (profile.get("plan") or "free") != STUDIO_PLAN:
            return JSONResponse(
                status_code=403,
                content={
                    "error": "studio_required",
                    "message": "API access is available on the Studio plan only.",
                    "plan": profile.get("plan", "free"),
                },
            )

        request.state.api_user_id = profile["id"]
        request.state.api_plan = STUDIO_PLAN
        return await call_next(request)
