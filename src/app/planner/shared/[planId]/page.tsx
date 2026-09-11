import { adminDb } from "@/lib/firebaseAdmin";
import { notFound } from "next/navigation";
import SharedPlanView from "@/app/planner/shared/[planId]/SharedPlanView";
import type { Metadata } from "next";
import { cache } from "react";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getPublicPlan = cache(async (planId: string) => {
  const db = adminDb();
  const docSnap = await db.collection("planner_plans").doc(planId).get();
  if (!docSnap.exists) return null;
  const data = docSnap.data();
  if (!data || !data.is_public) return null;
  return {
    id: docSnap.id,
    title: String(data.title || "Study Plan"),
    owner_email: String(data.owner_email || ""),
    month: Number(data.month || 1),
    year: Number(data.year || new Date().getFullYear()),
    data: (data.data || {}) as Record<
      string,
      { id: string; text: string; done: boolean; subtasks: { id: string; text: string; done: boolean }[] }[]
    >,
    is_public: true as const,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ planId: string }>;
}): Promise<Metadata> {
  const { planId } = await params;

  try {
    const plan = await getPublicPlan(planId);
    if (!plan) return { title: "Plan Not Found" };

    const monthIndex = Number(plan.month) - 1;
    const monthLabel =
      monthIndex >= 0 && monthIndex < 12 ? MONTHS[monthIndex] : "";

    return {
      title: `${plan.title} | ${monthLabel} ${plan.year}`,
      description: `Shared study plan by ${String(plan.owner_email || "").split("@")[0] || "a student"}`,
    };
  } catch {
    return { title: "Plan Not Found" };
  }
}

export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  let plan: Awaited<ReturnType<typeof getPublicPlan>> = null;
  try {
    plan = await getPublicPlan(planId);
  } catch {
    notFound();
  }
  if (!plan) notFound();
  return <SharedPlanView plan={plan} />;
}
