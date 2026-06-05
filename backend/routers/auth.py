from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import os
import httpx
from supabase import create_client, Client

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

def get_supabase() -> Client:
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_ANON_KEY")
    )

def get_supabase_admin() -> Client:
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

class AuthRequest(BaseModel):
    email: EmailStr
    password: str

class XPUpdate(BaseModel):
    action: str
    xp: int

class ProfileUpdate(BaseModel):
    region: str | None = None

class SignInMethodsRequest(BaseModel):
    email: EmailStr

OAUTH_PROVIDERS = frozenset({"google", "apple", "github", "facebook", "azure", "twitter"})

def _providers_from_user(user: dict) -> list[str]:
    """Return sign-in methods for a Supabase auth user (e.g. email, google)."""
    providers: set[str] = set()
    for ident in user.get("identities") or []:
        p = (ident.get("provider") or "").lower()
        if p:
            providers.add(p)
    if user.get("encrypted_password"):
        providers.add("email")
    return sorted(providers)

# ── Sign-in methods (Google vs email/password) ───────────
@router.post("/sign-in-methods")
async def sign_in_methods(body: SignInMethodsRequest):
    """
    Which sign-in methods exist for this email (service role lookup).
    Used after a failed password login to explain Google-only accounts.
    """
    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Auth lookup unavailable")

    email = str(body.email).strip().lower()
    headers = {"Authorization": f"Bearer {key}", "apikey": key}

    user: dict | None = None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{url}/auth/v1/admin/users",
                params={"page": 1, "per_page": 1, "filter": f"email.eq.{email}"},
                headers=headers,
                timeout=10,
            )
        if resp.status_code == 200:
            users = (resp.json() or {}).get("users") or []
            if users:
                user = users[0]
    except Exception:
        pass

    if not user:
        try:
            admin = get_supabase_admin()
            prof = (
                admin.table("profiles")
                .select("id")
                .ilike("email", email)
                .limit(1)
                .execute()
            )
            rows = prof.data or []
            if rows:
                got = admin.auth.admin.get_user_by_id(rows[0]["id"])
                u = getattr(got, "user", None)
                if u is not None:
                    user = u.model_dump() if hasattr(u, "model_dump") else dict(u)
        except Exception:
            pass

    if not user:
        return {"methods": []}

    raw = _providers_from_user(user)
    methods: list[str] = []
    if any(p in OAUTH_PROVIDERS for p in raw):
        methods.append("google")
    if "email" in raw:
        methods.append("email")
    return {"methods": methods}

# ── Register ──────────────────────────────────────────────
@router.post("/register")
async def register(body: AuthRequest):
    supabase = get_supabase()
    try:
        res = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
        })
        if res.user is None:
            raise HTTPException(400, "Registration failed")
        return {
            "user_id": res.user.id,
            "email": res.user.email,
            "access_token": res.session.access_token if res.session else None,
            "message": "Registered successfully"
        }
    except Exception as e:
        raise HTTPException(400, str(e))

# ── Login ─────────────────────────────────────────────────
@router.post("/login")
async def login(body: AuthRequest):
    supabase = get_supabase()
    try:
        res = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        if res.user is None:
            raise HTTPException(401, "Invalid credentials")

        # Fetch profile (xp, region etc)
        admin = get_supabase_admin()
        profile = admin.table("profiles").select("*").eq("id", res.user.id).single().execute()

        return {
            "access_token": res.session.access_token,
            "user_id": res.user.id,
            "email": res.user.email,
            "profile": profile.data,
        }
    except Exception as e:
        raise HTTPException(401, str(e))

# ── Get current user ──────────────────────────────────────
@router.get("/me")
async def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    supabase = get_supabase()
    try:
        user = supabase.auth.get_user(credentials.credentials)
        if not user.user:
            raise HTTPException(401, "Invalid token")

        admin = get_supabase_admin()
        profile = admin.table("profiles").select("*").eq("id", user.user.id).single().execute()

        return {
            "user_id": user.user.id,
            "email": user.user.email,
            "profile": profile.data,
        }
    except Exception as e:
        raise HTTPException(401, str(e))

# ── Add XP ────────────────────────────────────────────────
@router.post("/xp")
async def add_xp(body: XPUpdate, credentials: HTTPAuthorizationCredentials = Depends(security)):
    supabase = get_supabase()
    try:
        user = supabase.auth.get_user(credentials.credentials)
        if not user.user:
            raise HTTPException(401, "Invalid token")

        admin = get_supabase_admin()
        uid = user.user.id

        # Log the event
        admin.table("xp_events").insert({
            "user_id": uid,
            "action": body.action,
            "xp": body.xp,
        }).execute()

        # Increment total XP on profile
        profile = admin.table("profiles").select("xp").eq("id", uid).single().execute()
        new_xp = (profile.data.get("xp") or 0) + body.xp
        admin.table("profiles").update({"xp": new_xp}).eq("id", uid).execute()

        return {"xp": new_xp, "action": body.action}
    except Exception as e:
        raise HTTPException(400, str(e))

# ── Update profile (region etc) ───────────────────────────
@router.patch("/profile")
async def update_profile(body: ProfileUpdate, credentials: HTTPAuthorizationCredentials = Depends(security)):
    supabase = get_supabase()
    try:
        user = supabase.auth.get_user(credentials.credentials)
        if not user.user:
            raise HTTPException(401, "Invalid token")

        admin = get_supabase_admin()
        updates = {k: v for k, v in body.dict().items() if v is not None}
        admin.table("profiles").update(updates).eq("id", user.user.id).execute()

        return {"updated": updates}
    except Exception as e:
        raise HTTPException(400, str(e))

# ── Logout ────────────────────────────────────────────────
@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    supabase = get_supabase()
    try:
        supabase.auth.sign_out()
        return {"message": "Logged out"}
    except Exception as e:
        raise HTTPException(400, str(e))