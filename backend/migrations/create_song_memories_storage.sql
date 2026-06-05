-- Run in Supabase SQL editor: public bucket for memory capsule photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('song-memories', 'song-memories', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "song_memories_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'song-memories');

CREATE POLICY "song_memories_auth_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'song-memories'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "song_memories_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'song-memories'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "song_memories_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'song-memories'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
