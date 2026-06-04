-- Permanent artist unlocks purchased with XP (max 5 per user on free plan).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlocked_artists jsonb DEFAULT '[]'::jsonb;
