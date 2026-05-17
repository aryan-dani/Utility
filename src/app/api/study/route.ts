import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, topic, context } = body; // type: 'flashcards' | 'quiz'

    const branch = context?.branch || 'AIDS';
    const branchName = branch === 'AIDS' ? 'Artificial Intelligence & Data Science Engineering' : branch;
    const semester = context?.semester || 4;

    const cacheKey = `study_${type}_${topic}_${branch}_${semester}`.trim().toLowerCase();

    // Semantic Caching Interceptor
    try {
      const supabase = createAdminClient();
      const { data: cached } = await supabase
        .from('semantic_cache')
        .select('response')
        .eq('prompt', cacheKey)
        .single();

      if (cached && cached.response) {
        console.log('⚡ Semantic Cache Hit for study key:', cacheKey);
        return new Response(cached.response, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Semantic-Cache': 'HIT',
          },
        });
      }
    } catch (err) {
      console.warn('Study semantic cache check error:', err);
    }

    // RAG: Fetch relevant snippets from resources to ground the flashcards/quiz in their actual coursework!
    let snippets: string[] = [];
    if (topic && topic.length > 2) {
      try {
        const supabase = createAdminClient();
        const { data: searchResults, error: rpcError } = await supabase.rpc('search_resource_content', {
          query_text: topic,
        });

        let finalResults = searchResults;

        if (rpcError || !finalResults || finalResults.length === 0) {
          const { data: fallbackData } = await supabase
            .from('resource_content')
            .select(`
              content,
              resources!inner (
                title, 
                subjects!inner (name)
              )
            `)
            .ilike('content', `%${topic}%`)
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
        console.error('RAG Search Error in Study API:', err);
      }
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

${snippets.length > 0 ? `Use the following excerpts from the student's actual course materials to ground your quiz questions:\n${snippets.join('\n\n')}\n\n` : ''}
CRITICAL INSTRUCTION: You MUST output ONLY a block of valid JSON matching the exact structure below, with NO markdown formatting, NO backticks, and NO additional commentary:
{
  "quiz": [
    {
      "id": "1",
      "question": "Clear academic question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Explanation of why Option A is correct."
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
      const supabase = createAdminClient();
      await supabase.from('semantic_cache').insert({
        prompt: cacheKey,
        response: JSON.stringify(data),
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
