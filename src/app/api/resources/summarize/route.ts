import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

const groqClient = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get('id');

  if (!resourceId) {
    return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    
    // 1. Fetch content from the index
    const { data, error } = await supabase
      .from('resource_content')
      .select('content, resources(title)')
      .eq('resource_id', resourceId)
      .single();

    if (error || !data) {
      return NextResponse.json({ 
        error: 'Resource content not found. This document might still be indexing.' 
      }, { status: 404 });
    }

    const { content, resources } = data as any;
    const title = resources?.title || 'this document';

    // 2. Prepare content for AI (limit to ~14k chars / ~3.5k tokens to prevent Groq rate limits)
    const contextContent = content.substring(0, 14000); 

    // 3. Generate summary
    const { text } = await generateText({
      model: groqClient('llama-3.1-8b-instant'),
      maxOutputTokens: 1024,
      system: `You are an elite academic summarizer. Your goal is to help students quickly grasp the core concepts of their study materials.`,
      prompt: `Summarize the following study material titled "${title}".
      
      Structure your response as follows:
      1. **Quick Overview**: A 2-3 sentence summary of what this document covers.
      2. **Key Core Concepts**: A bulleted list (5-7 points) of the most important technical concepts or formulas.
      3. **Exam Tips**: 2-3 brief tips on what might be important for exams based on this content.
      
      Keep it professional, high-density, and well-formatted with markdown.
      
      CONTENT:
      ${contextContent}`,
    });

    return NextResponse.json({ summary: text });
  } catch (err: any) {
    console.error('Summarization error:', err);
    return NextResponse.json({ error: 'Failed to generate AI summary' }, { status: 500 });
  }
}
