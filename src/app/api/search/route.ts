import { createAdminClient } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const supabase = createAdminClient();

    // Try to use the optimized search function with snippets
    const { data, error } = await supabase.rpc('search_resource_content', {
      query_text: query,
    });

    if (error) {
      console.warn('Search RPC failed, falling back to basic search:', error.message);
      
      // Fallback: Search using standard Supabase text search
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('resource_content')
        .select(`
          resource_id,
          content,
          resources!inner (
            title,
            file_url,
            subject:subjects (
              name,
              branch,
              semester
            )
          )
        `)
        .textSearch('content', query, {
          type: 'websearch',
          config: 'english'
        })
        .limit(10);

      if (fallbackError) throw fallbackError;

      // Transform fallback data to match the RPC structure
      const results = (fallbackData as any[]).map(item => ({
        resource_id: item.resource_id,
        title: item.resources.title,
        file_url: item.resources.file_url,
        subject_name: item.resources.subject.name,
        branch: item.resources.subject.branch,
        semester: item.resources.subject.semester,
        snippet: item.content.substring(0, 200) + '...', // Very basic snippet
        rank: 0
      }));

      return NextResponse.json({ results });
    }

    return NextResponse.json({ results: data });
  } catch (err: any) {
    console.error('Search API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
