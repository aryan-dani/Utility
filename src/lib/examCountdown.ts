import {
  PLANNER_STORAGE_KEY_PREFIX,
  readPlannerMonth,
  type PlannerTask,
} from "@/lib/plannerStorage";

export type UpcomingExam = {
  date: string;
  text: string;
  daysUntil: number;
};

function parseISODate(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function isExamTask(task: PlannerTask): boolean {
  const category =
    typeof task.category === "string" ? task.category : undefined;
  if (category && /exam/i.test(category)) return true;
  if (typeof task.text === "string" && /exam/i.test(task.text)) return true;
  return false;
}

function listStoredMonthKeys(): Array<{ year: number; month: number }> {
  if (typeof window === "undefined") return [];
  const out: Array<{ year: number; month: number }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PLANNER_STORAGE_KEY_PREFIX)) continue;
      const rest = key.slice(PLANNER_STORAGE_KEY_PREFIX.length);
      const m = /^(\d+)_(\d+)$/.exec(rest);
      if (!m) continue;
      out.push({ year: Number(m[1]), month: Number(m[2]) });
    }
  } catch {
    return [];
  }
  return out;
}

/** Soonest open exam task across the given planner month maps. */
export function soonestExamFromRecords(
  records: Array<Record<string, PlannerTask[]> | null | undefined>,
  now: Date = new Date(),
): UpcomingExam | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayMs = today.getTime();
  let best: UpcomingExam | null = null;

  for (const data of records) {
    if (!data) continue;
    for (const [date, tasks] of Object.entries(data)) {
      if (!Array.isArray(tasks)) continue;
      const day = parseISODate(date);
      if (!day || day.getTime() < todayMs) continue;
      for (const task of tasks) {
        if (!isExamTask(task) || task.done) continue;
        const daysUntil = daysBetween(today, day);
        if (!best || daysUntil < best.daysUntil) {
          best = {
            date,
            text: typeof task.text === "string" ? task.text : "Exam",
            daysUntil,
          };
        }
      }
    }
  }

  return best;
}

/** Soonest future planner task whose category (or text) matches /exam/i. */
export function getSoonestUpcomingExam(
  now: Date = new Date(),
): UpcomingExam | null {
  if (typeof window === "undefined") return null;

  const keys = listStoredMonthKeys();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  if (!keys.some((k) => k.year === curY && k.month === curM)) {
    keys.push({ year: curY, month: curM });
  }

  return soonestExamFromRecords(
    keys.map(({ year, month }) => readPlannerMonth(year, month)?.data),
    now,
  );
}
