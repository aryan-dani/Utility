import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'edge';

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, context } = body;

  const lastMessage = messages[messages.length - 1]?.content || '';
  const branch = context?.branch || 'AIDS';
  const semester = context?.semester || 4;
  const subjects = context?.subjects || [];

  // RAG: Fetch relevant snippets from resources
  let snippets: string[] = [];
  
  // Clean query: remove common filler to extract keywords
  const cleanQuery = lastMessage
    .toLowerCase()
    .replace(/^(what are|what is|tell me about|explain|do you have|can you|show me|tell me)\s+/i, '')
    .replace(/\s+(from|in|about)\s+(my|the)\s+(slides|notes|ppt|resources|material|coursework|studies)$/i, '')
    .replace(/^(context of|information on|details about)\s+/i, '')
    .trim();

  // Only search if there's a substantial query left
  if (cleanQuery.length > 2) {
    try {
      const supabase = createAdminClient();
      
      // Try the RPC first (fixed search function)
      const { data: searchResults, error: rpcError } = await supabase.rpc('search_resource_content', {
        query_text: cleanQuery,
      });

      let finalResults = searchResults;

      // Robust Fallback: Use standard ILIKE search if RPC fails or returns nothing
      // This ensures we find matches even if the full-text search index is still updating or strict
      if (rpcError || !finalResults || finalResults.length === 0) {
        console.warn('RAG RPC failed or empty, falling back to ILIKE search:', rpcError?.message);
        
        const { data: fallbackData } = await supabase
          .from('resource_content')
          .select(`
            content,
            resources!inner (
              title, 
              subjects!inner (name)
            )
          `)
          .ilike('content', `%${cleanQuery}%`)
          .limit(3);
        
        if (fallbackData) {
          finalResults = (fallbackData as any[]).map(r => ({
            title: r.resources.title,
            subject_name: r.resources.subjects.name,
            snippet: r.content.substring(0, 500) + '...'
          }));
        }
      }

      if (finalResults && Array.isArray(finalResults)) {
        snippets = finalResults
          .slice(0, 5)
          .map(r => `[SOURCE: ${r.title} | SUBJECT: ${r.subject_name}]: ${r.snippet}`);
      }
    } catch (err) {
      console.error('RAG Search Critical Error:', err);
    }
  }

  const subjectList = subjects.length > 0
    ? subjects.join(', ')
    : 'relevant academic subjects';

  // Map messages to CoreMessage format
  const finalMessages = messages?.map((m: any) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content || m.parts?.map((p: any) => p.text || '').join('\n') || '',
  }));

  const systemPrompt = `You are the Academic OS AI, a high-performance tutor for university students.
  
STUDENT IDENTITY:
- Program: ${branch} ${branch === 'AIDS' ? '(Artificial Intelligence & Data Science)' : ''}
- Year/Semester: ${semester}
- Current Subjects: ${subjectList}

INTELLIGENCE RECALL:
- You have a direct link to the student's indexed library of PDFs, PPTs, and DOCs.
- If snippets appear below, they are REAL data from their specific university files.
- CRITICAL: Never claim you don't have access to documents if snippets are provided. Ground your answer in them.

${snippets.length > 0 
  ? `CONTEXT FROM STUDENT RESOURCES:\n${snippets.join('\n\n')}` 
  : 'Note: No direct matches found in local documents for this specific query. Provide a general academic explanation but advise the student to check their slides for specific university-mandated definitions.'}

MODERN TUTOR GUIDELINES:
1. Formatting: Use H3 (###) for sections. Use **bold** for key terms. Use bullet points.
2. Tone: Professional, encouraging, and technically precise.
3. Code: Use fenced code blocks for algorithms or examples.
4. Accuracy: If snippets are present, prioritize them over your general knowledge. Mention resource titles if helpful.`;

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: finalMessages,
  });

  return result.toUIMessageStreamResponse();
}
