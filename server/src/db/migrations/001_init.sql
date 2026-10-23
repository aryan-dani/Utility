CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS subjects (
  id text PRIMARY KEY,
  name text NOT NULL,
  academic_year varchar(16) NOT NULL,
  branch varchar(32) NOT NULL,
  semester integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subjects_scope_idx ON subjects (academic_year, branch, semester);

CREATE TABLE IF NOT EXISTS resources (
  id text PRIMARY KEY,
  subject_id text REFERENCES subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  academic_year varchar(16) NOT NULL,
  branch varchar(32) NOT NULL,
  semester integer NOT NULL,
  drive_file_id text,
  drive_path text,
  drive_modified_at timestamptz,
  mime_type text,
  file_url text,
  native jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resources_scope_idx ON resources (academic_year, branch, semester);
CREATE INDEX IF NOT EXISTS resources_drive_idx ON resources (drive_file_id);

CREATE TABLE IF NOT EXISTS resource_content (
  resource_id text PRIMARY KEY REFERENCES resources(id) ON DELETE CASCADE,
  content text NOT NULL,
  ai_summary text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_chunks (
  id text PRIMARY KEY,
  resource_id text NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  text text NOT NULL,
  section_label text,
  section_index integer,
  heading text,
  chunk_tokens text[] NOT NULL DEFAULT '{}',
  token_count integer NOT NULL DEFAULT 0,
  academic_year varchar(16) NOT NULL,
  branch varchar(32) NOT NULL,
  semester integer NOT NULL,
  embedding vector(768),
  search_tsv tsvector,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chunks_resource_idx ON resource_chunks (resource_id);
CREATE INDEX IF NOT EXISTS chunks_scope_idx ON resource_chunks (academic_year, branch, semester);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON resource_chunks USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
  ON resource_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE FUNCTION resource_chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector('english', coalesce(NEW.text, '') || ' ' || coalesce(NEW.heading, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS resource_chunks_tsv ON resource_chunks;
CREATE TRIGGER resource_chunks_tsv
  BEFORE INSERT OR UPDATE OF text, heading ON resource_chunks
  FOR EACH ROW EXECUTE FUNCTION resource_chunks_tsv_trigger();

CREATE TABLE IF NOT EXISTS semantic_cache (
  id text PRIMARY KEY,
  academic_year varchar(16),
  branch varchar(32),
  semester integer,
  resource_id text,
  query_hash text NOT NULL,
  query_text text NOT NULL,
  query_embedding vector(768),
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS semantic_cache_hash_idx ON semantic_cache (query_hash);
CREATE INDEX IF NOT EXISTS semantic_cache_expires_idx ON semantic_cache (expires_at);

CREATE TABLE IF NOT EXISTS activity_logs (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  action_type text NOT NULL,
  logged_date varchar(10) NOT NULL,
  count integer NOT NULL DEFAULT 1,
  meta jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS activity_user_date_action_idx
  ON activity_logs (user_id, logged_date, action_type);
CREATE INDEX IF NOT EXISTS activity_user_date_idx ON activity_logs (user_id, logged_date);

CREATE TABLE IF NOT EXISTS resource_usage (
  user_id text NOT NULL,
  resource_id text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz,
  PRIMARY KEY (user_id, resource_id)
);

CREATE TABLE IF NOT EXISTS resource_totals (
  resource_id text PRIMARY KEY,
  open_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS qa_questions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  author_name text,
  academic_year varchar(16) NOT NULL,
  branch varchar(32) NOT NULL,
  semester integer NOT NULL,
  subject_name text,
  title text NOT NULL,
  body text NOT NULL,
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  answer_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_q_scope_idx
  ON qa_questions (academic_year, branch, semester, created_at DESC);

CREATE TABLE IF NOT EXISTS qa_answers (
  id text PRIMARY KEY,
  question_id text NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  author_name text,
  body text NOT NULL,
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_a_question_idx ON qa_answers (question_id);

CREATE TABLE IF NOT EXISTS qa_votes (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  target_type varchar(16) NOT NULL,
  target_id text NOT NULL,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qa_votes_unique_idx
  ON qa_votes (user_id, target_type, target_id);

CREATE TABLE IF NOT EXISTS qa_saved (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  question_id text NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qa_saved_unique_idx ON qa_saved (user_id, question_id);

CREATE TABLE IF NOT EXISTS visualize_telemetry (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  event text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migrate_checkpoint (
  collection text PRIMARY KEY,
  cursor text,
  reads_today integer NOT NULL DEFAULT 0,
  reads_day varchar(10),
  done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_meta (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
