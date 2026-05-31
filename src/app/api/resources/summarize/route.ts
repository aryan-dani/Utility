import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { adminDb } from '@/lib/firebaseAdmin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get('id');

  if (!resourceId) {
    return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
  }

  try {
    const db = adminDb();
    
    // 1. Fetch content and any cached summary from the index
    const contentSnapshot = await db
      .collection('resource_content')
      .where('resource_id', '==', resourceId)
      .limit(1)
      .get();

    if (contentSnapshot.empty) {
      return NextResponse.json({ 
        error: 'Resource content not found. This document might still be indexing.' 
      }, { status: 404 });
    }

    const docRef = contentSnapshot.docs[0].ref;
    const data = contentSnapshot.docs[0].data();
    const content = data.content || '';
    const ai_summary = data.ai_summary;
    const title = data.title || 'this document';

    if (ai_summary) {
      return NextResponse.json(
        { summary: ai_summary },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
          },
        }
      );
    }

    // 2. Prepare content for AI (limit to ~6k chars / ~1.5k tokens to prevent Groq rate limits)
    const contextContent = content.substring(0, 6000); 

    // 3. Generate summary
    const { text } = await generateText({
      model: groq('llama-3.1-8b-instant'),
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

    // 4. Cache the summary asynchronously so future requests are instant
    await docRef.update({ ai_summary: text });

    return NextResponse.json(
      { summary: text },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err: any) {
    console.error('Summarization error:', err);
    return NextResponse.json({ 
      error: 'Failed to generate AI summary',
      details: err?.message || String(err),
      stack: err?.stack
    }, { status: 500 });
  }
}
