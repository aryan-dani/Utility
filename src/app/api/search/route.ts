import { performRAGSearch } from '@/lib/ragSearch';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const searchSchema = z.object({
  q: z.string().min(2),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  const parseResult = searchSchema.safeParse({ q: query });
  
  if (!parseResult.success) {
    return NextResponse.json({ results: [] });
  }

  const validQuery = parseResult.data.q;

  try {
    const results = await performRAGSearch(validQuery, 10);
    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('Search API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
