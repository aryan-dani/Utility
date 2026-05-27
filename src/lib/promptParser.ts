/**
 * promptParser.ts
 * 
 * Parses natural-language schedule prompts like:
 *   "27th -> DET unit 3 and 4 complete notes"
 *   "28th -> 1st half notes , second half memorizing 3rd"
 *   "1st -> complexity theory first half, second half -> 3rd chapter solving"
 * 
 * Into structured calendar entries with tasks and subtasks.
 */

export type SubTask = {
  id: string;
  text: string;
  done: boolean;
};

export type Task = {
  id: string;
  text: string;
  done: boolean;
  subtasks: SubTask[];
};

export type ParsedEntry = {
  date: string;   // ISO date "2026-05-27"
  tasks: Task[];
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Parse a single line like "27th -> DET unit 3 and 4 complete notes"
 * Returns { day: number, rawTasks: string } or null if unparseable.
 */
function parseLine(line: string): { day: number; rawTasks: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Match patterns like: "27th -> ...", "27 - ...", "27: ...", "27th : ...", "27th– ..."
  const match = trimmed.match(
    /^(\d{1,2})\s*(?:st|nd|rd|th)?\s*[-–—→>:]+\s*(.+)$/i
  );

  if (!match) return null;

  const day = parseInt(match[1], 10);
  const rawTasks = match[2].trim();

  if (day < 1 || day > 31 || !rawTasks) return null;

  return { day, rawTasks };
}

/**
 * Split a raw task string into individual tasks.
 * 
 * We split on commas that appear to separate distinct items,
 * but preserve commas within logical phrases.
 * 
 * Also handles sub-arrows like "second half -> 3rd chapter solving"
 * within a line — these become subtasks of a grouped task.
 */
function splitTasks(rawTasks: string): Task[] {
  // Split by comma to get potential task segments
  const segments = rawTasks.split(/\s*,\s*/);
  const tasks: Task[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // Check if segment has internal arrows (sub-task structure)
    // e.g. "second half -> 3rd chapter solving"
    // But only if it's clearly a sub-structure, not the main arrow
    const subParts = trimmed.split(/\s*[-–—→>]+\s*>?\s*/);

    if (subParts.length > 1 && subParts.every(p => p.trim().length > 0)) {
      // Create a parent task with the full text, plus subtasks for each part
      const mainText = trimmed;
      const subtasks: SubTask[] = subParts.map(part => ({
        id: generateId(),
        text: part.trim(),
        done: false,
      }));

      tasks.push({
        id: generateId(),
        text: mainText,
        done: false,
        subtasks,
      });
    } else {
      tasks.push({
        id: generateId(),
        text: trimmed,
        done: false,
        subtasks: [],
      });
    }
  }

  return tasks;
}

/**
 * Get the number of days in a given month/year.
 */
function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Convert a day number to an ISO date string.
 * Handles month rollover: if day > days in given month, wraps to next month.
 */
function dayToDate(day: number, month: number, year: number): string {
  const maxDays = daysInMonth(month, year);

  if (day <= maxDays) {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  } else {
    // Shouldn't normally happen if user is referencing the right month,
    // but handle gracefully
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const overflowDay = day - maxDays;
    const m = String(nextMonth).padStart(2, '0');
    const d = String(overflowDay).padStart(2, '0');
    return `${nextYear}-${m}-${d}`;
  }
}

/**
 * Main parser function.
 * 
 * Takes raw prompt text and a month/year context,
 * returns an array of ParsedEntry objects.
 * 
 * Smart month detection: if the prompt references days that have already
 * passed in the current month AND days that haven't, it spans two months.
 * e.g. "27th... 28th... 29th... 30th... 31st... 1st... 2nd..."
 * If today is May 27, days 1-2 likely mean June 1-2.
 */
export function parsePrompt(
  text: string,
  month: number,
  year: number,
): ParsedEntry[] {
  const lines = text.split('\n');
  const results: ParsedEntry[] = [];
  const dateMap = new Map<string, Task[]>();

  // First pass: collect all day numbers to detect month rollover
  const parsedLines = lines.map(parseLine).filter(Boolean) as { day: number; rawTasks: string }[];

  if (parsedLines.length === 0) return [];

  // Detect month rollover: if we see days going from high to low,
  // the low days belong to the next month
  let seenDecrease = false;
  let prevDay = 0;

  for (const { day, rawTasks } of parsedLines) {
    // Detect rollover (e.g. 31 -> 1)
    if (day < prevDay && prevDay > 20 && day < 10) {
      seenDecrease = true;
    }

    let targetMonth = month;
    let targetYear = year;

    if (seenDecrease && day < 10) {
      // This day belongs to the next month
      targetMonth = month === 12 ? 1 : month + 1;
      targetYear = month === 12 ? year + 1 : year;
    }

    const date = dayToDate(day, targetMonth, targetYear);
    const tasks = splitTasks(rawTasks);

    if (dateMap.has(date)) {
      dateMap.get(date)!.push(...tasks);
    } else {
      dateMap.set(date, tasks);
    }

    prevDay = day;
  }

  // Convert map to sorted array
  for (const [date, tasks] of dateMap) {
    results.push({ date, tasks });
  }

  results.sort((a, b) => a.date.localeCompare(b.date));

  return results;
}

/**
 * Merge parsed entries into existing plan data.
 * Does NOT overwrite existing tasks — appends to them.
 */
export function mergeEntries(
  existing: Record<string, Task[]>,
  parsed: ParsedEntry[],
): Record<string, Task[]> {
  const result = { ...existing };

  for (const entry of parsed) {
    if (result[entry.date]) {
      result[entry.date] = [...result[entry.date], ...entry.tasks];
    } else {
      result[entry.date] = [...entry.tasks];
    }
  }

  return result;
}
