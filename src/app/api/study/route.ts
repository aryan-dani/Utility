import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { adminDb } from '@/lib/firebaseAdmin';
import { performRAGSearch } from '@/lib/ragSearch';
import { z } from 'zod';

const studySchema = z.object({
  type: z.enum(['flashcards', 'quiz']),
  topic: z.string().min(2),
  context: z.object({
    branch: z.string().optional(),
    semester: z.number().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
    }

    const parseResult = studySchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: 'Invalid request payload', details: parseResult.error.format() }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { type, topic, context } = parseResult.data;

    const branch = context?.branch || 'AIDS';
    const branchName = branch === 'AIDS' ? 'Artificial Intelligence & Data Science Engineering' : branch;
    const semester = context?.semester || 4;

    const cacheKey = `study_${type}_${topic}_${branch}_${semester}`.trim().toLowerCase();

    // Semantic Caching Interceptor
    try {
      const db = adminDb();
      const cachedSnapshot = await db
        .collection('semantic_cache')
        .where('prompt', '==', cacheKey)
        .limit(1)
        .get();

      if (!cachedSnapshot.empty) {
        const cached = cachedSnapshot.docs[0].data();
        if (cached && cached.response) {
          return new Response(cached.response, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Semantic-Cache': 'HIT',
            },
          });
        }
      }
    } catch (err) {
      console.warn('Study semantic cache check error:', err);
    }

    // RAG: Fetch relevant snippets from resources to ground the flashcards/quiz in their actual coursework!
    let snippets: string[] = [];
    if (topic && topic.length > 2) {
      const finalResults = await performRAGSearch(topic, 5);
      snippets = finalResults.map((r: any) => `[SOURCE: ${r.title} | SUBJECT: ${r.subject_name}]: ${r.snippet}`);
    }

    const basePromptContext = `You are an expert academic AI tutor for university engineering students in the ${branchName} program, Semester ${semester}.
CRITICAL DOMAIN NOTICE:
- The student is in an Engineering / Computer Science / AI & Data Science degree.
- "AIDS" stands for Artificial Intelligence & Data Science Engineering. It is NOT related to medical science or viral diseases.
- "DAA" stands for Design and Analysis of Algorithms (a core computer science subject covering dynamic programming, greedy algorithms, complexity, etc.).
- "DBMS" stands for Database Management Systems.
- "CNM" stands for Computer Networks.
- "COA" stands for Computer Organization & Architecture.
- "OS" stands for Operating Systems.
DO NOT under any circumstances generate medical, clinical, or biological content. Ground all questions strictly in computer science and engineering syllabus.`;

    const prompt = type === 'flashcards'
      ? `${basePromptContext}

Generate 8 high-quality study flashcards on the academic topic: "${topic}".

${snippets.length > 0 ? `Use the following excerpts from the student's actual course materials to ground your flashcards:\n${snippets.join('\n\n')}\n\n` : ''}
CRITICAL INSTRUCTION: You MUST output ONLY a block of valid JSON matching the exact structure below, with NO markdown formatting, NO backticks, and NO additional commentary:
{
  "flashcards": [
    {
      "id": "1",
      "question": "Clear, concise academic question here?",
      "answer": "Precise, accurate academic answer here."
    }
  ]
}`
      : `${basePromptContext}

Generate a 5-question multiple-choice practice quiz on the academic topic: "${topic}".

${snippets.length > 0 ? `Use the following excerpts from the student's actual course materials to ground your quiz questions. Cite the specific file names using the [SOURCE: ...] tags in the "citations" field:\n${snippets.join('\n\n')}\n\n` : ''}
CRITICAL INSTRUCTION: You MUST output ONLY a block of valid JSON matching the exact structure below, with NO markdown formatting, NO backticks, and NO additional commentary:
{
  "quiz": [
    {
      "id": "1",
      "question": "Clear academic question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Explanation of why Option A is correct.",
      "citations": ["Source name matching the [SOURCE: ...] tag from context (e.g., 'Data_Engineering_Unit_1.pdf'). Leave empty array if no context snippet was used."]
    }
  ]
}`;

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: prompt,
    });

    const cleanJson = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(cleanJson);

    // Save to Semantic Cache
    try {
      const db = adminDb();
      await db.collection('semantic_cache').add({
        prompt: cacheKey,
        response: JSON.stringify(data),
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Study semantic cache insert error:', err);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Study API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate study material' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
