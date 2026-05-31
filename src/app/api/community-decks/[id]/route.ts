import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { adminDb } from '@/lib/firebaseAdmin';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Deck ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmailPrefix = userData.user.email?.split('@')[0];

    if (!userEmailPrefix) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 401 });
    }

    const db = adminDb();

    // Fetch the deck to check the author
    const deckDoc = await db.collection('community_decks').doc(id).get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const deck = deckDoc.data();

    // Verify authorship
    if (deck?.author_name !== userEmailPrefix) {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own decks' }, { status: 403 });
    }

    // Perform deletion
    await deckDoc.ref.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting deck:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
