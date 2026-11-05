CREATE TABLE IF NOT EXISTS clipboards (
  user_id text PRIMARY KEY,
  text text NOT NULL DEFAULT '',
  updated_at timestamptz,
  share_id text,
  share_expires_at timestamptz,
  drive_file_id text,
  drive_file_name text
);

CREATE TABLE IF NOT EXISTS clipboard_shares (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planner_plans (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  owner_email text,
  month integer NOT NULL,
  year integer NOT NULL,
  title text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS planner_owner_month_idx
  ON planner_plans (owner_id, year, month);

CREATE TABLE IF NOT EXISTS planner_collaborators (
  id text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES planner_plans(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  role varchar(16) NOT NULL,
  owner_id text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS planner_collab_unique_idx
  ON planner_collaborators (plan_id, user_email);

CREATE TABLE IF NOT EXISTS planner_presence (
  plan_id text NOT NULL,
  user_id text NOT NULL,
  display_name text,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_decks (
  id text PRIMARY KEY,
  title text NOT NULL,
  branch varchar(32) NOT NULL,
  semester integer NOT NULL,
  author_name text,
  author_uid text NOT NULL,
  flashcards jsonb NOT NULL DEFAULT '[]'::jsonb,
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS srs_state (
  user_id text PRIMARY KEY,
  decks jsonb NOT NULL DEFAULT '[]'::jsonb,
  cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_notes (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  title text NOT NULL,
  bytes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_notes_user_idx ON user_notes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS study_packs (
  id text PRIMARY KEY,
  scope_key text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_packs_scope_idx ON study_packs (scope_key, created_at DESC);
