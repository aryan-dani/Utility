-- Create planner_data table for cloud sync
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS planner_data (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE planner_data ENABLE ROW LEVEL SECURITY;

-- Users can only read and write their own planner data
CREATE POLICY "Users can read own planner data"
  ON planner_data
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own planner data"
  ON planner_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own planner data"
  ON planner_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own planner data"
  ON planner_data
  FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_planner_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planner_updated_at_trigger
  BEFORE UPDATE ON planner_data
  FOR EACH ROW
  EXECUTE FUNCTION update_planner_updated_at();
