import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { prompt, month, year } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const monthNum = Number(month);
    const yearNum = Number(year);

    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
      return new Response(JSON.stringify({ error: 'Invalid month or year context' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const systemInstructions = `You are a smart academic study planner. Your job is to parse the user's natural language study plans or schedule prompts into structured JSON.

Context:
- Current Month: ${MONTH_NAMES[monthNum - 1]} (Month number: ${monthNum})
- Current Year: ${yearNum}

Instructions:
1. Parse the user's input to extract study activities, topics, and dates.
2. Group the tasks by date, mapping each date to its correct ISO date string ("YYYY-MM-DD").
3. Be smart about date references:
   - Numerical days (e.g., "27th", "28th", "30", "1st") refer to the context month (${MONTH_NAMES[monthNum - 1]}) and year (${yearNum}).
   - Handle month rollovers: if the schedule starts at the end of the context month (e.g., 28th, 29th, 30th, 31st) and continues to 1st, 2nd, 3rd, those latter days belong to the NEXT month (e.g., if context is May, a subsequent "1st" or "2nd" refers to June 1st or 2nd).
   - If they specify relative dates (e.g., "today", "tomorrow"), resolve them relative to the current context.
4. Extract subtasks if the user lists multiple items or breaks down a task (e.g., "DET unit 3 (first write notes, then memorize)" or "1st half notes, second half memorizing 3rd"). Split them into a main task and a list of subtasks.
5. Generate a unique, random 9-character alphanumeric ID for each task and subtask.
6. The field "done" for all tasks and subtasks MUST be false.

CRITICAL INSTRUCTION: You MUST output ONLY a block of valid JSON matching the exact structure below, with NO markdown formatting, NO backticks, and NO additional commentary. If no dates or tasks are found, return an empty array [].

Example JSON output format:
[
  {
    "date": "${yearNum}-${String(monthNum).padStart(2, '0')}-27",
    "tasks": [
      {
        "id": "abc123xyz",
        "text": "DET unit 3 and 4 complete notes",
        "done": false,
        "subtasks": []
      }
    ]
  },
  {
    "date": "${yearNum}-${String(monthNum).padStart(2, '0')}-28",
    "tasks": [
      {
        "id": "def456uvw",
        "text": "1st half notes , second half memorizing 3rd",
        "done": false,
        "subtasks": [
          {
            "id": "sub123456",
            "text": "1st half notes",
            "done": false
          },
          {
            "id": "sub789012",
            "text": "second half memorizing 3rd",
            "done": false
          }
        ]
      }
    ]
  }
]`;

    const response = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: `${systemInstructions}\n\nUser Input to Parse:\n"${prompt}"`,
    });

    const cleanJson = response.text.replace(/```json|```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    return new Response(JSON.stringify({ data: parsedData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Parse API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to parse prompt with AI' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
