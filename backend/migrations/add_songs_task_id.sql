-- Optional: store Sonauto task id for reliable replay / open-in-tab
ALTER TABLE songs ADD COLUMN IF NOT EXISTS task_id TEXT;
CREATE INDEX IF NOT EXISTS idx_songs_task_id ON songs (task_id) WHERE task_id IS NOT NULL;
