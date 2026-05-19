import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

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

    // Initialize admin client to bypass RLS for fetching and deleting
    const adminSupabase = createAdminClient();

    // Fetch the deck to check the author
    const { data: deck, error: fetchError } = await adminSupabase
      .from('community_decks')
      .select('author_name')
      .eq('id', id)
      .single();

    if (fetchError || !deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    // Verify authorship
    if (deck.author_name !== userEmailPrefix) {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own decks' }, { status: 403 });
    }

    // Perform deletion
    const { error: deleteError } = await adminSupabase
      .from('community_decks')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting deck:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
