-- Vault catalog per academic year / branch / semester, served by the home server
-- instead of Firestore workspace_catalogs docs. One row per scope; rewritten only
-- when its content hash changes.
CREATE TABLE IF NOT EXISTS workspace_catalogs (
  id text PRIMARY KEY,
  academic_year varchar(16) NOT NULL,
  branch varchar(32) NOT NULL,
  semester integer NOT NULL,
  content_hash text NOT NULL,
  resource_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
