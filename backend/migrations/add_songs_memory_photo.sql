-- Memory capsule photo (Supabase Storage URL or compressed data URL fallback)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS memory_photo_url TEXT;
