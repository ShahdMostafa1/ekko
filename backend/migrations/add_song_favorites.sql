-- Run once in Supabase SQL editor
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
