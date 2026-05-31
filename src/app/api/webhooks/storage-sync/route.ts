import { NextResponse, after } from 'next/server';
import syncDrive from '../../../../../runtime/tools/sync-drive.mjs';
import indexContent from '../../../../../runtime/tools/index-content.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for Vercel timeout

export async function POST(request: Request) {
  try {
    // Optional: Verify webhook secret if configured
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}` && authHeader !== expectedSecret) {
      console.warn('⚠️  Webhook unauthorized attempt.');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔔 Storage webhook triggered. Queuing sync and index pipeline in background...');

    // 1. Run syncDrive and indexContent in the background using Next.js `after`
    after(async () => {
      try {
        console.log('🚀 Starting background sync and index...');
        await syncDrive();
        await indexContent();
        console.log('✅ Background sync and index completed successfully.');
      } catch (err) {
        console.error('❌ Background pipeline failed:', err);
      }
    });

    // 2. Respond immediately to Supabase to prevent webhook timeout
    return NextResponse.json({ success: true, message: 'Sync and index queued in background.' });
  } catch (error: any) {
    console.error('❌ Webhook handler failed:', error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
