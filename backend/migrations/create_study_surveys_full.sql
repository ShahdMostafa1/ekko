-- =============================================================================
-- RUN THIS ONCE in Supabase: SQL Editor → New query → Paste → Run
-- Creates study_surveys + indexes + RLS policies for Ekko pre/post surveys
-- =============================================================================

CREATE TABLE IF NOT EXISTS study_surveys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL,
  phase                 TEXT NOT NULL CHECK (phase IN ('pre', 'post')),

  -- Pre-test
  age_group             TEXT,
  music_frequency       SMALLINT CHECK (music_frequency IS NULL OR music_frequency BETWEEN 1 AND 5),
  ai_familiarity        SMALLINT CHECK (ai_familiarity IS NULL OR ai_familiarity BETWEEN 1 AND 5),
  used_mood_apps        TEXT,
  primary_goal          TEXT,
  cultural_importance   SMALLINT CHECK (cultural_importance IS NULL OR cultural_importance BETWEEN 1 AND 5),
  expected_mood_match   SMALLINT CHECK (expected_mood_match IS NULL OR expected_mood_match BETWEEN 1 AND 5),
  expected_quality      SMALLINT CHECK (expected_quality IS NULL OR expected_quality BETWEEN 1 AND 5),
  genre_preferences     TEXT,
  loved_artists         TEXT,

  -- Post-test (Likert 1–5)
  experience_rating     SMALLINT CHECK (experience_rating IS NULL OR experience_rating BETWEEN 1 AND 5),
  ease_of_use           SMALLINT CHECK (ease_of_use IS NULL OR ease_of_use BETWEEN 1 AND 5),
  mood_accuracy         SMALLINT CHECK (mood_accuracy IS NULL OR mood_accuracy BETWEEN 1 AND 5),
  music_quality         SMALLINT CHECK (music_quality IS NULL OR music_quality BETWEEN 1 AND 5),
  cultural_fit          SMALLINT CHECK (cultural_fit IS NULL OR cultural_fit BETWEEN 1 AND 5),
  lyrics_quality        SMALLINT CHECK (lyrics_quality IS NULL OR lyrics_quality BETWEEN 1 AND 5),
  cocreation_rating     SMALLINT CHECK (cocreation_rating IS NULL OR cocreation_rating BETWEEN 1 AND 5),
  recommend_score       SMALLINT CHECK (recommend_score IS NULL OR recommend_score BETWEEN 1 AND 5),
  would_use_again       SMALLINT CHECK (would_use_again IS NULL OR would_use_again BETWEEN 1 AND 5),

  -- Post-test (choices + text)
  expectations_met      TEXT,
  strongest_aspect      TEXT,
  weakest_aspect        TEXT,
  improvements_needed   TEXT,

  -- Legacy columns (optional; safe to leave null)
  expectations          TEXT,
  recommendations       TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, phase)
);

CREATE INDEX IF NOT EXISTS idx_study_surveys_user ON study_surveys (user_id);
CREATE INDEX IF NOT EXISTS idx_study_surveys_phase ON study_surveys (phase);
CREATE INDEX IF NOT EXISTS idx_study_surveys_created ON study_surveys (created_at DESC);

ALTER TABLE study_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_surveys_select_all ON study_surveys;
CREATE POLICY study_surveys_select_all ON study_surveys
  FOR SELECT USING (true);

DROP POLICY IF EXISTS study_surveys_insert_all ON study_surveys;
CREATE POLICY study_surveys_insert_all ON study_surveys
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS study_surveys_update_all ON study_surveys;
CREATE POLICY study_surveys_update_all ON study_surveys
  FOR UPDATE USING (true);
