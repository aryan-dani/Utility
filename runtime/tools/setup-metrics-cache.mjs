import { getClient } from '../lib/supabase.mjs';

const supabase = getClient();

async function setupMetricsAndCache() {
  console.log('🚀 Setting up Semantic Caching (pgvector) and Activity Metrics infrastructure...');

  const sql = `
    -- 1. Enable pgvector extension
    CREATE EXTENSION IF NOT EXISTS vector;

    -- 2. Create Semantic Cache Table
    CREATE TABLE IF NOT EXISTS semantic_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prompt TEXT NOT NULL UNIQUE,
      embedding vector(1024),
      response TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 3. Create HNSW index for lightning-fast vector cosine similarity search
    CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding ON semantic_cache USING hnsw (embedding vector_cosine_ops);

    -- 4. Create matching function for semantic cache
    CREATE OR REPLACE FUNCTION match_semantic_cache(
      query_embedding vector(1024),
      match_threshold float,
      match_count int
    )
    RETURNS TABLE (
      id UUID,
      prompt TEXT,
      response TEXT,
      similarity float
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        semantic_cache.id,
        semantic_cache.prompt,
        semantic_cache.response,
        1 - (semantic_cache.embedding <=> query_embedding) AS similarity
      FROM semantic_cache
      WHERE 1 - (semantic_cache.embedding <=> query_embedding) > match_threshold
      ORDER BY similarity DESC
      LIMIT match_count;
    END;
    $$ LANGUAGE plpgsql;

    -- 5. Create Activity Logs Table for GitHub-style Contribution Grid
    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, action_type, logged_date)
    );

    -- Enable RLS on activity_logs
    ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can read own activity logs"
      ON activity_logs
      FOR SELECT
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert own activity logs"
      ON activity_logs
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update own activity logs"
      ON activity_logs
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    if (error.message.includes('function "exec_sql" does not exist')) {
      console.warn('⚠️ exec_sql function not found. Please run the SQL manually in Supabase SQL Editor:');
      console.log(sql);
    } else {
      console.error('❌ Error setting up metrics & cache:', error.message);
    }
  } else {
    console.log('✅ Semantic Caching (pgvector) and Activity Metrics setup successfully!');
  }
}

setupMetricsAndCache();
