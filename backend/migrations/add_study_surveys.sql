-- Pre/post study surveys (UX research)
CREATE TABLE IF NOT EXISTS study_surveys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  phase               TEXT NOT NULL CHECK (phase IN ('pre', 'post')),
  experience_rating   SMALLINT CHECK (experience_rating BETWEEN 1 AND 5),
  ease_of_use         SMALLINT CHECK (ease_of_use BETWEEN 1 AND 5),
  mood_accuracy       SMALLINT CHECK (mood_accuracy BETWEEN 1 AND 5),
  music_quality       SMALLINT CHECK (music_quality BETWEEN 1 AND 5),
  recommend_score     SMALLINT CHECK (recommend_score BETWEEN 1 AND 5),
  expectations        TEXT,
  improvements_needed TEXT,
  loved_artists       TEXT,
  recommendations     TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, phase)
);

CREATE INDEX IF NOT EXISTS idx_study_surveys_user ON study_surveys (user_id);
CREATE INDEX IF NOT EXISTS idx_study_surveys_phase ON study_surveys (phase);
