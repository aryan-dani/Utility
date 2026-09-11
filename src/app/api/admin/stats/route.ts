import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

type TopResource = {
  id: string;
  title: string;
  subject: string;
  opens: number;
  uniqueOpeners: number;
  lastOpenedAt: string;
};

type ActiveUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  resourceOpenCount: number;
  lastOpenedTitle: string;
  lastOpenedAt: string;
  lastActive: string;
  branch?: string;
  semester?: number | null;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function isRecent(iso: string, cutoff: string): boolean {
  return Boolean(iso && iso >= cutoff);
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) return auth;

  try {
    const db = adminDb();
    const weekAgo = daysAgoIso(7);
    const monthAgo = daysAgoIso(30);

    const [usersSnap, usageStatsSnap, totalsSnap, totalsCountSnap] =
      await Promise.all([
        db.collection("users").limit(500).get(),
        db.collection("stats").doc("usage").get(),
        db
          .collection("resource_totals")
          .orderBy("opens", "desc")
          .limit(20)
          .get()
          .catch(async () => {
            // Index may not exist yet — fall back to unordered sample.
            return db.collection("resource_totals").limit(40).get();
          }),
        db
          .collection("resource_totals")
          .count()
          .get()
          .catch(() => null),
      ]);

    let activeLast7d = 0;
    let activeLast30d = 0;
    let usersWithOpens = 0;
    let totalUserOpens = 0;
    let dormant30d = 0;
    let neverOpened = 0;
    const byBranch: Record<string, number> = {};
    const bySemester: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    const activeUsers: ActiveUser[] = [];

    for (const doc of usersSnap.docs) {
      const d = doc.data();
      const uid = String(d.uid || doc.id);
      const lastActive = String(d.lastActive || d.updatedAt || "");
      const lastOpenedAt = String(d.lastOpenedAt || "");
      const resourceOpenCount = Number(d.resourceOpenCount) || 0;
      const branch = String(d.branch || "Unknown").trim() || "Unknown";
      const semesterRaw = d.semester;
      const semester =
        typeof semesterRaw === "number"
          ? semesterRaw
          : Number(semesterRaw) || null;
      const provider = String(d.provider || "unknown").trim() || "unknown";

      byBranch[branch] = (byBranch[branch] || 0) + 1;
      byProvider[provider] = (byProvider[provider] || 0) + 1;
      const semKey =
        semester != null && semester > 0 ? `Sem ${semester}` : "Unset";
      bySemester[semKey] = (bySemester[semKey] || 0) + 1;

      totalUserOpens += resourceOpenCount;
      if (resourceOpenCount > 0) usersWithOpens += 1;
      else neverOpened += 1;

      const recent7 =
        isRecent(lastActive, weekAgo) || isRecent(lastOpenedAt, weekAgo);
      const recent30 =
        isRecent(lastActive, monthAgo) || isRecent(lastOpenedAt, monthAgo);
      if (recent7) activeLast7d += 1;
      if (recent30) activeLast30d += 1;
      else dormant30d += 1;

      activeUsers.push({
        uid,
        email: String(d.email || ""),
        displayName: String(d.displayName || ""),
        photoURL: d.photoURL ? String(d.photoURL) : undefined,
        resourceOpenCount,
        lastOpenedTitle: String(d.lastOpenedTitle || ""),
        lastOpenedAt,
        lastActive,
        branch,
        semester,
      });
    }

    activeUsers.sort((a, b) => {
      if (b.resourceOpenCount !== a.resourceOpenCount) {
        return b.resourceOpenCount - a.resourceOpenCount;
      }
      return (b.lastOpenedAt || b.lastActive).localeCompare(
        a.lastOpenedAt || a.lastActive,
      );
    });

    const topResources: TopResource[] = totalsSnap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: String(d.resource_id || doc.id),
          title: String(d.title || "Untitled"),
          subject: String(d.subject || ""),
          opens: Number(d.opens) || 0,
          uniqueOpeners: Number(d.uniqueOpeners) || 0,
          lastOpenedAt: String(d.lastOpenedAt || ""),
        };
      })
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 12);

    const totalOpensFromStats = Number(usageStatsSnap.data()?.totalOpens) || 0;
    const totalOpensFallback = topResources.reduce((sum, r) => sum + r.opens, 0);
    const totalOpens = totalOpensFromStats || totalOpensFallback || totalUserOpens;
    const filesWithOpens =
      totalsCountSnap?.data().count ?? topResources.length;
    const userCount = usersSnap.size;

    const branchBreakdown = Object.entries(byBranch)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count);

    const semesterBreakdown = Object.entries(bySemester)
      .map(([semester, count]) => ({ semester, count }))
      .sort((a, b) => {
        const na = Number(a.semester.replace(/\D/g, "")) || 99;
        const nb = Number(b.semester.replace(/\D/g, "")) || 99;
        if (a.semester === "Unset") return 1;
        if (b.semester === "Unset") return -1;
        return na - nb;
      });

    const providerBreakdown = Object.entries(byProvider)
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count);

    const engagementRate =
      userCount > 0 ? Math.round((usersWithOpens / userCount) * 1000) / 10 : 0;
    const activeRate7d =
      userCount > 0 ? Math.round((activeLast7d / userCount) * 1000) / 10 : 0;
    const avgOpensPerEngaged =
      usersWithOpens > 0
        ? Math.round((totalUserOpens / usersWithOpens) * 10) / 10
        : 0;

    return NextResponse.json(
      {
        overview: {
          userCount,
          activeLast7d,
          activeLast30d,
          dormant30d,
          neverOpened,
          totalOpens,
          filesWithOpens,
          usersWithOpens,
          engagementRate,
          activeRate7d,
          avgOpensPerEngaged,
          totalUserOpens,
        },
        byBranch: branchBreakdown,
        bySemester: semesterBreakdown,
        byProvider: providerBreakdown,
        topResources,
        mostActiveUsers: activeUsers.slice(0, 12),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error: unknown) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage stats" },
      { status: 500 },
    );
  }
}
