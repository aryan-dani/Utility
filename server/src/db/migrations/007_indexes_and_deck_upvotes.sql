-- Missing query indexes identified across high-traffic routes and admin stats,
-- plus per-user upvote deduplication matching Firestore community_deck_upvotes.

CREATE INDEX IF NOT EXISTS planner_collab_email_idx
  ON planner_collaborators (user_email);

CREATE INDEX IF NOT EXISTS activity_logged_date_idx
  ON activity_logs (logged_date);

CREATE INDEX IF NOT EXISTS resource_usage_resource_idx
  ON resource_usage (resource_id);

CREATE INDEX IF NOT EXISTS qa_votes_target_idx
  ON qa_votes (target_type, target_id);

CREATE TABLE IF NOT EXISTS community_deck_upvotes (
  id text PRIMARY KEY,
  deck_id text NOT NULL REFERENCES community_decks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS community_deck_upvotes_uid_deck_idx
  ON community_deck_upvotes (user_id, deck_id);
