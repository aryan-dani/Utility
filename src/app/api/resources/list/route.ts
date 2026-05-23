import { NextResponse, after } from 'next/server';
import { getResourcesFromDB } from '@/lib/dataFetcher';
import { createClient } from '@/lib/supabaseServer';
import syncProject from '../../../../../runtime/tools/sync.mjs';

export const dynamic = 'force-dynamic';

let lastSyncTime = 0;
const SYNC_COOLDOWN_MS = 15000; // 15 seconds cooldown to prevent overlapping scans

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch') || 'AIDS';
    const semester = Number(searchParams.get('semester') || '4');

    const supabase = await createClient();
    const resources = await getResourcesFromDB(branch, semester, supabase);

    // Trigger automatic storage-to-database sync in the background
    const now = Date.now();
    if (now - lastSyncTime > SYNC_COOLDOWN_MS) {
      lastSyncTime = now;
      after(async () => {
        try {
          console.log('🔄 [Background Sync] Starting automatic storage-to-database sync...');
          await syncProject();
          console.log('✅ [Background Sync] Finished automatic storage-to-database sync.');
        } catch (syncErr) {
          console.error('❌ [Background Sync] Automatic sync failed:', syncErr);
        }
      });
    }

    return NextResponse.json({ resources });
  } catch (error: any) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

