from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import os
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