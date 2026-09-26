import { NextResponse } from 'next/server';
import { getWorkspaceList } from '@/lib/dataFetcher';
import { resolveWorkspace } from '@/lib/workspace';
import { isAuthFailure, requireUser } from '@/lib/apiAuth';

// Query params force dynamic rendering; CDN still caches via Cache-Control below.
export const dynamic = 'force-dynamic';

function isQuotaExhausted(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: number | string; details?: string; message?: string };
  const code = err.code;
  if (code === 8 || code === '8' || code === 'resource-exhausted') return true;
  const text = `${err.details ?? ''} ${err.message ?? ''}`;
  return /RESOURCE_EXHAUSTED|Quota exceeded/i.test(text);
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { academicYear, branch, semester } = resolveWorkspace({
      year: searchParams.get('year'),
      branch: searchParams.get('branch'),
      semester: searchParams.get('semester'),
    });

    const { resources, syllabusUrl } = await getWorkspaceList(
      academicYear,
      branch,
      semester,
    );

    return NextResponse.json(
      { resources, syllabusUrl },
      {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      }
    );
  } catch (error: unknown) {
    console.error('Error fetching resources:', error);
    if (isQuotaExhausted(error)) {
      // Cache briefly so retries don't keep burning Firestore free-tier quota.
      return NextResponse.json(
        {
          error: 'Resources are temporarily unavailable (database quota). Try again later.',
        },
        {
          status: 503,
          headers: {
            'Retry-After': '300',
            'Cache-Control': 'private, max-age=30',
          },
        }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

