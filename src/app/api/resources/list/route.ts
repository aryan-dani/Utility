import { NextResponse } from 'next/server';
import { getResourcesFromDB } from '@/lib/dataFetcher';


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'AIDS';
    const semester = Number(searchParams.get('semester') || '4');

    const resources = await getResourcesFromDB(branch, semester);

    return NextResponse.json(
      { resources },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

