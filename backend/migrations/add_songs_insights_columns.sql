-- Journey features: album covers + memory capsules
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS memory_note TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS memory_location TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS memory_photo_url TEXT;
