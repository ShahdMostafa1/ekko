"""
Study surveys — pre/post UX research forms.
GET  /survey/status/{user_id}
POST /survey/submit
"""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/survey", tags=["Study Survey"])

_local_surveys: dict[str, dict] = {}


def _get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    from supabase import create_client
    return create_client(url, key)


class SurveySubmit(BaseModel):
    user_id:             str
    phase:               str

    # Pre-test
    age_group:           str | None = None
    music_frequency:     int | None = Field(None, ge=1, le=5)
    ai_familiarity:      int | None = Field(None, ge=1, le=5)
    used_mood_apps:      str | None = None
    primary_goal:        str | None = None
    cultural_importance: int | None = Field(None, ge=1, le=5)
    expected_mood_match: int | None = Field(None, ge=1, le=5)
    expected_quality:    int | None = Field(None, ge=1, le=5)
    genre_preferences:   str | None = None
    loved_artists:       str | None = None

    # Post-test Likert scales
    experience_rating:   int | None = Field(None, ge=1, le=5)
    ease_of_use:         int | None = Field(None, ge=1, le=5)
    mood_accuracy:       int | None = Field(None, ge=1, le=5)
    music_quality:       int | None = Field(None, ge=1, le=5)
    cultural_fit:        int | None = Field(None, ge=1, le=5)
    lyrics_quality:      int | None = Field(None, ge=1, le=5)
    cocreation_rating:   int | None = Field(None, ge=1, le=5)
    recommend_score:     int | None = Field(None, ge=1, le=5)
    would_use_again:     int | None = Field(None, ge=1, le=5)

    # Post-test structured
    expectations_met:    str | None = None
    strongest_aspect:    str | None = None
    weakest_aspect:      str | None = None

    # Only free-text field
    improvements_needed: str | None = None


def _row_from_body(body: SurveySubmit) -> dict:
    return {
        "user_id":             body.user_id,
        "phase":               body.phase,
        "age_group":           body.age_group,
        "music_frequency":     body.music_frequency,
        "ai_familiarity":      body.ai_familiarity,
        "used_mood_apps":      body.used_mood_apps,
        "primary_goal":        body.primary_goal,
        "cultural_importance": body.cultural_importance,
        "expected_mood_match": body.expected_mood_match,
        "expected_quality":    body.expected_quality,
        "genre_preferences":   body.genre_preferences,
        "loved_artists":       (body.loved_artists or "").strip() or None,
        "experience_rating":   body.experience_rating,
        "ease_of_use":         body.ease_of_use,
        "mood_accuracy":       body.mood_accuracy,
        "music_quality":       body.music_quality,
        "cultural_fit":        body.cultural_fit,
        "lyrics_quality":      body.lyrics_quality,
        "cocreation_rating":   body.cocreation_rating,
        "recommend_score":     body.recommend_score,
        "would_use_again":     body.would_use_again,
        "expectations_met":    body.expectations_met,
        "strongest_aspect":    body.strongest_aspect,
        "weakest_aspect":      body.weakest_aspect,
        "improvements_needed": (body.improvements_needed or "").strip() or None,
    }


@router.get("/status/{user_id}", summary="Which survey phases the user has completed")
async def survey_status(user_id: str):
    sb = _get_supabase()
    pre_done = post_done = False

    if sb:
        try:
            resp = sb.table("study_surveys").select("phase").eq("user_id", user_id).execute()
            phases = {r["phase"] for r in (resp.data or [])}
            pre_done = "pre" in phases
            post_done = "post" in phases
        except Exception:
            pass
    else:
        entry = _local_surveys.get(user_id, {})
        pre_done = "pre" in entry
        post_done = "post" in entry

    return {"user_id": user_id, "pre_done": pre_done, "post_done": post_done}


@router.post("/submit", summary="Submit pre or post study survey")
async def submit_survey(body: SurveySubmit):
    if body.phase not in ("pre", "post"):
        raise HTTPException(status_code=400, detail="phase must be pre or post")

    row = _row_from_body(body)

    sb = _get_supabase()
    if sb:
        try:
            resp = (
                sb.table("study_surveys")
                .upsert(row, on_conflict="user_id,phase")
                .execute()
            )
            saved = (resp.data or [row])[0]
            return {"saved": True, "survey": saved}
        except Exception as e:
            err = str(e)
            if "study_surveys" in err.lower() or "does not exist" in err.lower():
                _local_surveys.setdefault(body.user_id, {})[body.phase] = row
                return {"saved": True, "survey": row, "storage": "local"}
            raise HTTPException(status_code=500, detail=err)

    _local_surveys.setdefault(body.user_id, {})[body.phase] = row
    return {"saved": True, "survey": row, "storage": "local"}
