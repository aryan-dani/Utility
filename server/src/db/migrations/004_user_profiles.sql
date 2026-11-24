-- Profile mirror for admin stats and the users tab. Firestore `users` stays the
-- source for account preferences; this table only holds what the admin views need.
CREATE TABLE IF NOT EXISTS user_profiles (
  uid text PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT '',
  branch varchar(32),
  semester integer,
  last_active_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_profiles_last_active_idx ON user_profiles (last_active_at DESC);
