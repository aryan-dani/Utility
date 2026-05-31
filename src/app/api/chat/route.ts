import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { adminDb } from '@/lib/firebaseAdmin';
import { performRAGSearch } from '@/lib/ragSearch';
import { z } from 'zod';

const chatSchema = z.object({
  messages: z.array(z.any()).nonempty(),
  context: z.object({
    branch: z.string().optional(),
    semester: z.number().optional(),
    subjects: z.array(z.string()).optional(),
    resourceId: z.string().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const parseResult = chatSchema.safeParse(body);
  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: 'Invalid request payload', details: parseResult.error.format() }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { messages, context } = parseResult.data;

  const lastMessage = messages[messages.length - 1]?.content || '';
  const branch = context?.branch || 'AIDS';
  const semester = context?.semester || 4;
  const subjects = context?.subjects || [];
  const resourceId = context?.resourceId;

  const cleanPrompt = lastMessage.trim().toLowerCase();

  // Semantic Caching Interceptor
  if (cleanPrompt.length > 5) {
    try {
      const db = adminDb();
      const cachedSnapshot = await db
        .collection('semantic_cache')
        .where('prompt', '==', cleanPrompt)
        .limit(1)
        .get();

      if (!cachedSnapshot.empty) {
        const cached = cachedSnapshot.docs[0].data();
        if (cached && cached.response) {
          const streamData = '0:' + JSON.stringify(cached.response) + '\n';
          return new Response(streamData, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Semantic-Cache': 'HIT',
            },
          });
        }
      }
    } catch (err) {
      console.warn('Semantic cache check error:', err);
    }
  }

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
    const finalResults = await performRAGSearch(cleanQuery, 5, resourceId);
    snippets = finalResults.map((r: any) => `[SOURCE: ${r.title} | SUBJECT: ${r.subject_name}]: ${r.snippet}`);
  }

  const subjectList = subjects.length > 0
    ? subjects.join(', ')
    : 'relevant academic subjects';

  // Map messages to CoreMessage format
  const finalMessages = messages?.map((m: any) => ({
    role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
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
    onFinish: async ({ text }) => {
      if (cleanPrompt.length > 5) {
        try {
          const db = adminDb();
          await db.collection('semantic_cache').add({
            prompt: cleanPrompt,
            response: text,
            created_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Semantic cache insert error:', err);
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
