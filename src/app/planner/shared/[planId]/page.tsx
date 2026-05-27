import { createClient } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";
import SharedPlanView from "@/app/planner/shared/[planId]/SharedPlanView";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("planner_plans")
    .select("title, owner_email, month, year")
    .eq("id", planId)
    .eq("is_public", true)
    .single();

  if (!data) return { title: "Plan Not Found" };

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
  return {
    title: `${data.title} — ${MONTHS[data.month - 1]} ${data.year}`,
    description: `Shared study plan by ${data.owner_email?.split("@")[0] || "a student"}`,
  };
}

export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const supabase = await createClient();

  const { data: plan, error } = await supabase
    .from("planner_plans")
    .select("*")
    .eq("id", planId)
    .eq("is_public", true)
    .single();

  if (error || !plan) {
    notFound();
  }

  return <SharedPlanView plan={plan} />;
}
