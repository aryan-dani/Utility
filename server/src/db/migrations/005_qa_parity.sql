-- Q&A parity with the Firestore contract the web client already uses.
-- Adds the fields the composer sends and the thread reads (category, resource link,
-- attachments, status, accepted answer, AI placeholders, author photo).

ALTER TABLE qa_questions
  ADD COLUMN IF NOT EXISTS category varchar(16) NOT NULL DEFAULT 'doubt',
  ADD COLUMN IF NOT EXISTS resource_id text,
  ADD COLUMN IF NOT EXISTS resource_title text,
  ADD COLUMN IF NOT EXISTS resource_url text,
  ADD COLUMN IF NOT EXISTS topic_unit text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS accepted_answer_id text,
  ADD COLUMN IF NOT EXISTS ai_auto_answered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_answer text,
  ADD COLUMN IF NOT EXISTS needs_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS author_photo_url text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE qa_answers
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS author_photo_url text;

CREATE INDEX IF NOT EXISTS qa_q_resource_idx ON qa_questions (resource_id);
