import { adminDb } from "@/lib/firebaseAdmin";
import { notFound } from "next/navigation";
import SharedPlanView from "@/app/planner/shared/[planId]/SharedPlanView";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const db = adminDb();
  
  try {
    const docRef = db.collection("planner_plans").doc(planId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) return { title: "Plan Not Found" };
    
    const data = docSnap.data();
    if (!data || !data.is_public) return { title: "Plan Not Found" };

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
  } catch (error) {
    return { title: "Plan Not Found" };
  }
}

export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const db = adminDb();

  try {
    const docRef = db.collection("planner_plans").doc(planId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      notFound();
    }
    
    const plan = { id: docSnap.id, ...docSnap.data() } as any;
    if (!plan.is_public) {
      notFound();
    }
    
    return <SharedPlanView plan={plan} />;
  } catch (error) {
    notFound();
  }
}
