-- Academic preferences move from the Firestore `users` doc to the home profile row,
-- so sign-in and onboarding no longer read or write Firestore.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS academic_year varchar(16),
  ADD COLUMN IF NOT EXISTS workspace_scope_version integer,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
