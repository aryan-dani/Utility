export const PLANNER_STORAGE_KEY_PREFIX = "utility_planner_v2_";

export type PlannerTask = {
  id: string;
  text: string;
  done: boolean;
  subtasks?: { id: string; text: string; done: boolean }[];
  focusSessions?: number;
  focusMinutes?: number;
  [key: string]: unknown;
};

export type PlannerMonthMeta = {
  title: string;
  month: number;
  year: number;
  is_public?: boolean;
  id?: string;
};

export type PlannerMonthStored = {
  data: Record<string, PlannerTask[]>;
  meta: PlannerMonthMeta;
};

export function plannerStorageKey(year: number, month: number): string {
  return `${PLANNER_STORAGE_KEY_PREFIX}${year}_${month}`;
}

export function parsePlannerDate(
  day: string | null | undefined,
): { year: number; month: number; date: string } | null {
  if (!day) return null;
  // Prefer ISO date keys used by planner v2 (YYYY-MM-DD)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    return { year, month, date: day.trim() };
  }
  return null;
}

export function readPlannerMonth(
  year: number,
  month: number,
): PlannerMonthStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(plannerStorageKey(year, month));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      data: parsed.data || {},
      meta: parsed.meta || { title: "Study Plan", month, year, is_public: false },
    };
  } catch {
    return null;
  }
}

export function writePlannerMonth(
  year: number,
  month: number,
  stored: PlannerMonthStored,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      plannerStorageKey(year, month),
      JSON.stringify(stored),
    );
  } catch {
    // quota / private mode
  }
}

export function appendLocalPlannerTask(dateISO: string, text: string, id: string): void {
  const parsed = parsePlannerDate(dateISO);
  if (!parsed || !text.trim()) return;
  const existing = readPlannerMonth(parsed.year, parsed.month);
  const data = existing?.data ? { ...existing.data } : {};
  const day = Array.isArray(data[parsed.date]) ? data[parsed.date] : [];
  data[parsed.date] = [
    ...day,
    { id, text: text.trim(), done: false, subtasks: [] },
  ];
  writePlannerMonth(parsed.year, parsed.month, {
    data,
    meta: existing?.meta || {
      title: "Study Plan",
      month: parsed.month,
      year: parsed.year,
      is_public: false,
    },
  });
}

/** Increment focus stats on a planner task for the given ISO date. Returns true if updated. */
export function incrementTaskFocus(
  dateISO: string,
  taskId: string,
  minutes: number,
): boolean {
  const parsed = parsePlannerDate(dateISO);
  if (!parsed) return false;

  const existing = readPlannerMonth(parsed.year, parsed.month);
  const data = existing?.data ? { ...existing.data } : {};
  const dayTasks = data[parsed.date];
  if (!Array.isArray(dayTasks)) return false;

  let found = false;
  data[parsed.date] = dayTasks.map((task) => {
    if (task.id !== taskId) return task;
    found = true;
    return {
      ...task,
      focusSessions: (task.focusSessions || 0) + 1,
      focusMinutes: (task.focusMinutes || 0) + minutes,
    };
  });

  if (!found) return false;

  writePlannerMonth(parsed.year, parsed.month, {
    data,
    meta: existing?.meta || {
      title: "Study Plan",
      month: parsed.month,
      year: parsed.year,
      is_public: false,
    },
  });
  return true;
}
