-- Run in Supabase SQL editor after add_study_surveys.sql + extend_study_surveys.sql
-- Lets the admin dashboard read rows with the browser anon key (fallback).
-- Backend should still use SUPABASE_SERVICE_ROLE_KEY for /survey/submit and /admin/surveys.

ALTER TABLE study_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_surveys_select_all ON study_surveys;
CREATE POLICY study_surveys_select_all ON study_surveys
  FOR SELECT USING (true);

DROP POLICY IF EXISTS study_surveys_insert_own ON study_surveys;
CREATE POLICY study_surveys_insert_own ON study_surveys
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS study_surveys_update_own ON study_surveys;
CREATE POLICY study_surveys_update_own ON study_surveys
  FOR UPDATE USING (true);
