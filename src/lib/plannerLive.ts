import { homeOrVercelJson } from "@/lib/homeApi";
import {
  readPlannerMonth,
  writePlannerMonth,
  type PlannerTask,
} from "@/lib/plannerStorage";

export type LivePlan = {
  id?: string;
  title: string;
  isPublic: boolean;
  data: Record<string, PlannerTask[]>;
  source: "home" | "local";
};

function fromLocal(year: number, month: number): LivePlan {
  const local = readPlannerMonth(year, month);
  return {
    id: local?.meta.id,
    title: local?.meta.title || "Study Plan",
    isPublic: Boolean(local?.meta.is_public),
    data: local?.data || {},
    source: "local",
  };
}

/** Home planner for this month, or the local month when that request misses. */
export async function loadPlannerMonth(
  year: number,
  month: number,
): Promise<LivePlan> {
  try {
    const res = await homeOrVercelJson(
      `/api/planner?month=${month}&year=${year}`,
    );
    if (!res.ok) return fromLocal(year, month);
    const body = (await res.json()) as {
      plan?: {
        id?: string;
        title?: string;
        is_public?: boolean;
        data?: Record<string, PlannerTask[]>;
      } | null;
    };
    if (!body.plan?.data) return fromLocal(year, month);
    const live: LivePlan = {
      id: body.plan.id,
      title: body.plan.title || "Study Plan",
      isPublic: Boolean(body.plan.is_public),
      data: body.plan.data,
      source: "home",
    };
    writePlannerMonth(year, month, {
      data: live.data,
      meta: {
        title: live.title,
        month,
        year,
        is_public: live.isPublic,
        id: live.id,
      },
    });
    return live;
  } catch {
    return fromLocal(year, month);
  }
}

/** Same payload the planner page saves. Also keeps the local month in step. */
export async function savePlannerMonth(
  year: number,
  month: number,
  plan: LivePlan,
): Promise<LivePlan> {
  writePlannerMonth(year, month, {
    data: plan.data,
    meta: {
      title: plan.title,
      month,
      year,
      is_public: plan.isPublic,
      id: plan.id,
    },
  });
  const res = await homeOrVercelJson("/api/planner", {
    method: "POST",
    body: {
      month,
      year,
      title: plan.title,
      is_public: plan.isPublic,
      data: plan.data,
      ...(plan.id ? { planId: plan.id } : {}),
    },
  });
  if (!res.ok) return plan;
  const saved = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!saved?.id) return plan;
  const next = { ...plan, id: saved.id, source: "home" as const };
  writePlannerMonth(year, month, {
    data: next.data,
    meta: {
      title: next.title,
      month,
      year,
      is_public: next.isPublic,
      id: next.id,
    },
  });
  return next;
}
