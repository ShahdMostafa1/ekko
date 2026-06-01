-- Extend study surveys for thesis research (scales + structured options)
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS music_frequency SMALLINT CHECK (music_frequency BETWEEN 1 AND 5);
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS ai_familiarity SMALLINT CHECK (ai_familiarity BETWEEN 1 AND 5);
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS used_mood_apps TEXT;
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS primary_goal TEXT;
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS cultural_importance SMALLINT CHECK (cultural_importance BETWEEN 1 AND 5);
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS expected_mood_match SMALLINT CHECK (expected_mood_match BETWEEN 1 AND 5);
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS expected_quality SMALLINT CHECK (expected_quality BETWEEN 1 AND 5);
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS genre_preferences TEXT;
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS cultural_fit SMALLINT CHECK (cultural_fit BETWEEN 1 AND 5);
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS lyrics_quality SMALLINT CHECK (lyrics_quality BETWEEN 1 AND 5);
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS cocreation_rating SMALLINT CHECK (cocreation_rating BETWEEN 1 AND 5);
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS expectations_met TEXT;
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS would_use_again SMALLINT CHECK (would_use_again BETWEEN 1 AND 5);
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS strongest_aspect TEXT;
ALTER TABLE study_surveys ADD COLUMN IF NOT EXISTS weakest_aspect TEXT;
