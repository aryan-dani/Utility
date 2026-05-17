import { getClient } from '../lib/supabase.mjs';

const supabase = getClient();

async function setupCommunityAndCache() {
  console.log('🚀 Setting up Community Shared Decks and verifying Semantic Cache infrastructure...');

  const sql = `
    -- 1. Ensure vector extension exists
    CREATE EXTENSION IF NOT EXISTS vector;

    -- 2. Verify/Create Semantic Cache Table
    CREATE TABLE IF NOT EXISTS semantic_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prompt TEXT NOT NULL UNIQUE,
      embedding vector(1024),
      response TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding ON semantic_cache USING hnsw (embedding vector_cosine_ops);

    -- 3. Create Community Shared Decks Table
    CREATE TABLE IF NOT EXISTS community_decks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      branch TEXT NOT NULL,
      semester INTEGER NOT NULL,
      author_name TEXT NOT NULL DEFAULT 'Anonymous Scholar',
      upvotes INTEGER NOT NULL DEFAULT 1,
      flashcards JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS on community_decks
    ALTER TABLE community_decks ENABLE ROW LEVEL SECURITY;

    -- Allow public read access to community decks
    CREATE POLICY "Public can read community decks"
      ON community_decks
      FOR SELECT
      USING (true);

    -- Allow authenticated users (or public students) to insert community decks
    CREATE POLICY "Anyone can insert community decks"
      ON community_decks
      FOR INSERT
      WITH CHECK (true);

    -- Allow upvoting (updating upvotes count)
    CREATE POLICY "Anyone can update community decks upvotes"
      ON community_decks
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    if (error.message.includes('function "exec_sql" does not exist')) {
      console.warn('⚠️ exec_sql function not found. Please run the SQL manually in Supabase SQL Editor:');
      console.log(sql);
    } else {
      console.error('❌ Error setting up community & cache:', error.message);
    }
  } else {
    console.log('✅ Community Decks and Semantic Cache setup successfully!');
  }
}

setupCommunityAndCache();
