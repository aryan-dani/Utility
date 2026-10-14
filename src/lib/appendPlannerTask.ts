import { localDateKey } from "@/lib/dateLocal";
import { generateId } from "@/lib/id";
import { appendLocalPlannerTask } from "@/lib/plannerStorage";

/** Append one task. Signed-out stays local. Signed-in merges into the cloud plan. */
export async function appendTodayTask(text: string, date = localDateKey()): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const id = generateId();
  appendLocalPlannerTask(date, trimmed, id);

  const { auth } = await import("@/lib/firebase/auth");
  if (!auth.currentUser) return;

  const [year, month] = date.split("-").map(Number);
  const { authFetch } = await import("@/lib/authFetch");
  const existing = await authFetch(`/api/planner?month=${month}&year=${year}`);
  if (!existing.ok) return;
  const body = (await existing.json()) as {
    plan?: {
      title?: string;
      is_public?: boolean;
      data?: Record<string, Array<{ id: string; text: string; done: boolean }>>;
    } | null;
  };
  const planData = { ...(body.plan?.data || {}) };
  const day = Array.isArray(planData[date]) ? planData[date] : [];
  if (day.some((task) => task.id === id)) return;
  planData[date] = [...day, { id, text: trimmed, done: false }];
  await authFetch("/api/planner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      month,
      year,
      title: body.plan?.title || "Study Plan",
      is_public: !!body.plan?.is_public,
      data: planData,
    }),
  });
}
