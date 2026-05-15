import { getClient } from '../lib/supabase.mjs';

const supabase = getClient();

async function setup() {
  console.log('🚀 Setting up search infrastructure...');

  const sql = `
    -- 1. Create a function for intelligent search with snippets
    CREATE OR REPLACE FUNCTION search_resource_content(query_text TEXT)
    RETURNS TABLE (
      resource_id UUID,
      title TEXT,
      file_url TEXT,
      subject_name TEXT,
      branch TEXT,
      semester INTEGER,
      snippet TEXT,
      rank REAL
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        rc.resource_id,
        r.title,
        r.file_url,
        s.name as subject_name,
        s.branch,
        s.semester,
        ts_headline('english', rc.content, websearch_to_tsquery('english', query_text), 'StartSel=<mark class="bg-primary/20 text-primary px-0.5 rounded">, StopSel=</mark>, MaxWords=35, MinWords=15') as snippet,
        ts_rank(to_tsvector('english', rc.content), websearch_to_tsquery('english', query_text)) as rank
      FROM resource_content rc
      JOIN resources r ON rc.resource_id = r.id
      JOIN subjects s ON r.subject_id = s.id
      WHERE to_tsvector('english', rc.content) @@ websearch_to_tsquery('english', query_text)
      ORDER BY rank DESC
      LIMIT 10;
    END;
    $$ LANGUAGE plpgsql;

    -- 2. Ensure the GIN index exists for fast searching
    CREATE INDEX IF NOT EXISTS idx_resource_content_fts ON resource_content USING GIN (to_tsvector('english', content));
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    if (error.message.includes('function "exec_sql" does not exist')) {
      console.warn('⚠️ exec_sql function not found. Please run the SQL manually in Supabase SQL Editor:');
      console.log(sql);
    } else {
      console.error('❌ Error setting up search:', error.message);
    }
  } else {
    console.log('✅ Search infrastructure setup successfully!');
  }
}

setup();
