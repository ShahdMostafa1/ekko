-- Studio API keys (profiles.api_key)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_api_key ON profiles (api_key) WHERE api_key IS NOT NULL;
