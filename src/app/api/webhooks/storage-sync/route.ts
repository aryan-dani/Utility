import { NextResponse } from 'next/server';
import syncProject from '../../../../../runtime/tools/sync.mjs';
import indexContent from '../../../../../runtime/tools/index-content.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Optional: Verify webhook secret if configured
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}` && authHeader !== expectedSecret) {
      console.warn('⚠️  Webhook unauthorized attempt.');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔔 Storage webhook triggered. Starting sync and index pipeline...');

    // 1. Run syncProject
    await syncProject();

    // 2. Run indexContent
    await indexContent();

    console.log('✅ Webhook sync and index pipeline completed successfully.');
    return NextResponse.json({ success: true, message: 'Sync and index completed.' });
  } catch (error: any) {
    console.error('❌ Webhook pipeline failed:', error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
