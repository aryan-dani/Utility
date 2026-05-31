import { NextResponse, after } from 'next/server';
import syncDrive from '../../../../../runtime/tools/sync-drive.mjs';
import indexContent from '../../../../../runtime/tools/index-content.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for Vercel timeout

async function handleSync(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const supabaseSecret = process.env.SUPABASE_WEBHOOK_SECRET;

    let isAuthorized = false;
    // If no secrets are set, let it pass (development / local testing)
    if (!cronSecret && !supabaseSecret) {
      isAuthorized = true;
    } else {
      if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
        isAuthorized = true;
      }
      if (supabaseSecret && (authHeader === `Bearer ${supabaseSecret}` || authHeader === supabaseSecret)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      console.warn('⚠️  Webhook unauthorized attempt.');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔔 Storage sync webhook triggered. Queuing sync and index pipeline in background...');

    // Run syncDrive and indexContent in the background using Next.js `after`
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

    return NextResponse.json({ success: true, message: 'Sync and index queued in background.' });
  } catch (error: any) {
    console.error('❌ Webhook handler failed:', error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

