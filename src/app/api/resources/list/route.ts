import { NextResponse } from 'next/server';
import { getResourcesFromDB } from '@/lib/dataFetcher';
import { createClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'AIDS';
    const semester = Number(searchParams.get('semester') || '4');

    const supabase = await createClient();
    const resources = await getResourcesFromDB(branch, semester, supabase);

    return NextResponse.json({ resources });
  } catch (error: any) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}
