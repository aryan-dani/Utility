import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';

export const runtime = 'edge';

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, context, text } = body;

  // Map messages to CoreMessage format (Groq expects role/content)
  let finalMessages = messages?.map((m: any) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content || m.parts?.map((p: any) => p.text || '').join('\n') || '',
  }));

  if (!finalMessages && text) {
    finalMessages = [{ role: 'user', content: text }];
  }

  if (!finalMessages || finalMessages.length === 0) {
    return new Response('No messages provided', { status: 400 });
  }

  const branch = context?.branch || 'AIDS';
  const semester = context?.semester || 4;
  const subjects = context?.subjects || [];

  const subjectList = subjects.length > 0
    ? subjects.join(', ')
    : 'general engineering subjects';

  const systemPrompt = `You are an expert academic tutor and study assistant for university students.

Context:
- Branch: ${branch} (${branch === 'AIDS' ? 'Artificial Intelligence & Data Science' : 'Computer Science & Engineering'})
- Semester: ${semester}
- Subjects this semester: ${subjectList}

Guidelines:
- Give clear, concise, and accurate explanations
- Use examples when helpful
- Format responses with markdown: use **bold** for key terms, \`code\` for technical terms, and bullet points for lists
- When explaining algorithms or code, use fenced code blocks with language specification
- If asked to create flashcards, format them as numbered Q&A pairs
- If asked to summarize, use structured bullet points with headings
- Be encouraging and supportive — you're helping students learn
- Keep responses focused and not unnecessarily long
- If a question is outside your knowledge, say so honestly`;

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: finalMessages,
  });

  return result.toUIMessageStreamResponse();
}
