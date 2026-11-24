import { count, countDistinct, desc, eq, gt, gte, inArray, sql, sum } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import {
  activityLogs,
  resourceTotals,
  resourceUsage,
  resources,
  subjects,
  userProfiles,
} from "../db/schema.js";

type Db = ReturnType<typeof getDb>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Activity rows are keyed by the local calendar date (YYYY-MM-DD). */
function dateKeyDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
}

function toIso(value: unknown): string {
  if (value == null || value === "") return "";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function latestIso(a: string, b: string): string {
  return a > b ? a : b;
}

type UsageAggregate = { opens: number; lastOpenedAt: string };

/** Per-user open totals and last-open time, for the given uids only. */
async function usageByUser(db: Db, uids: string[]): Promise<Map<string, UsageAggregate>> {
  if (uids.length === 0) return new Map();
  const rows = await db
    .select({
      uid: resourceUsage.userId,
      opens: sum(resourceUsage.count),
      last: sql<unknown>`max(${resourceUsage.lastOpenedAt})`,
    })
    .from(resourceUsage)
    .where(inArray(resourceUsage.userId, uids))
    .groupBy(resourceUsage.userId);
  return new Map(
    rows.map((r) => [r.uid, { opens: toNumber(r.opens), lastOpenedAt: toIso(r.last) }]),
  );
}

/** Title of each user's most recently opened resource. */
async function lastOpenedTitles(db: Db, uids: string[]): Promise<Map<string, string>> {
  if (uids.length === 0) return new Map();
  const list = sql.join(
    uids.map((uid) => sql`${uid}`),
    sql`, `,
  );
  const result = await db.execute(sql`
    select distinct on (ru.user_id) ru.user_id as uid, r.title as title
    from resource_usage ru
    left join resources r on r.id = ru.resource_id
    where ru.user_id in (${list})
    order by ru.user_id, ru.last_opened_at desc nulls last
  `);
  const rows = result.rows as Array<{ uid: string; title: string | null }>;
  return new Map(rows.map((r) => [r.uid, r.title ?? ""]));
}

export async function computeAdminStats(db: Db) {
  const weekKey = dateKeyDaysAgo(7);
  const monthKey = dateKeyDaysAgo(30);

  const [
    [usersRow = { n: 0 }],
    [active7 = { n: 0 }],
    [active30 = { n: 0 }],
    [withOpens = { n: 0 }],
    [usageRow = { n: null }],
    [totalsRow = { n: null, files: 0 }],
  ] = await Promise.all([
    db.select({ n: count() }).from(userProfiles),
    db
      .select({ n: countDistinct(activityLogs.userId) })
      .from(activityLogs)
      .where(gte(activityLogs.loggedDate, weekKey)),
    db
      .select({ n: countDistinct(activityLogs.userId) })
      .from(activityLogs)
      .where(gte(activityLogs.loggedDate, monthKey)),
    db
      .select({ n: countDistinct(resourceUsage.userId) })
      .from(resourceUsage)
      .where(gt(resourceUsage.count, 0)),
    db.select({ n: sum(resourceUsage.count) }).from(resourceUsage),
    db
      .select({ n: sum(resourceTotals.openCount), files: count() })
      .from(resourceTotals)
      .where(gt(resourceTotals.openCount, 0)),
  ]);

  const userCount = toNumber(usersRow.n);
  const activeLast7d = toNumber(active7.n);
  const activeLast30d = toNumber(active30.n);
  const usersWithOpens = toNumber(withOpens.n);
  const totalUserOpens = toNumber(usageRow.n);
  const totalOpens = toNumber(totalsRow.n);
  const filesWithOpens = toNumber(totalsRow.files);

  const profiles = await db
    .select({
      uid: userProfiles.uid,
      branch: userProfiles.branch,
      semester: userProfiles.semester,
      provider: userProfiles.provider,
    })
    .from(userProfiles);

  const byBranch: Record<string, number> = {};
  const bySemester: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  for (const p of profiles) {
    const branch = (p.branch || "").trim() || "Unknown";
    const provider = (p.provider || "").trim() || "unknown";
    const semKey = p.semester != null && p.semester > 0 ? `Sem ${p.semester}` : "Unset";
    byBranch[branch] = (byBranch[branch] || 0) + 1;
    byProvider[provider] = (byProvider[provider] || 0) + 1;
    bySemester[semKey] = (bySemester[semKey] || 0) + 1;
  }

  const branchBreakdown = Object.entries(byBranch)
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count);

  const semesterBreakdown = Object.entries(bySemester)
    .map(([semester, count]) => ({ semester, count }))
    .sort((a, b) => {
      if (a.semester === "Unset") return 1;
      if (b.semester === "Unset") return -1;
      const na = Number(a.semester.replace(/\D/g, "")) || 99;
      const nb = Number(b.semester.replace(/\D/g, "")) || 99;
      return na - nb;
    });

  const providerBreakdown = Object.entries(byProvider)
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count);

  const topRows = await db
    .select({
      resourceId: resourceTotals.resourceId,
      opens: resourceTotals.openCount,
      title: resources.title,
      subjectName: subjects.name,
    })
    .from(resourceTotals)
    .leftJoin(resources, eq(resources.id, resourceTotals.resourceId))
    .leftJoin(subjects, eq(subjects.id, resources.subjectId))
    .orderBy(desc(resourceTotals.openCount))
    .limit(12);

  const topIds = topRows.map((r) => r.resourceId);
  const openersRows = topIds.length
    ? await db
        .select({
          resourceId: resourceUsage.resourceId,
          openers: countDistinct(resourceUsage.userId),
          last: sql<unknown>`max(${resourceUsage.lastOpenedAt})`,
        })
        .from(resourceUsage)
        .where(inArray(resourceUsage.resourceId, topIds))
        .groupBy(resourceUsage.resourceId)
    : [];
  const openersById = new Map(openersRows.map((r) => [r.resourceId, r]));

  const topResources = topRows.map((r) => {
    const agg = openersById.get(r.resourceId);
    return {
      id: r.resourceId,
      title: r.title || "Untitled",
      subject: r.subjectName || "",
      opens: toNumber(r.opens),
      uniqueOpeners: toNumber(agg?.openers),
      lastOpenedAt: toIso(agg?.last),
    };
  });

  const activeRows = await db
    .select({
      uid: resourceUsage.userId,
      opens: sum(resourceUsage.count),
    })
    .from(resourceUsage)
    .groupBy(resourceUsage.userId)
    .orderBy(desc(sum(resourceUsage.count)))
    .limit(12);

  const topUids = activeRows.map((r) => r.uid);
  const [topProfiles, topTitles, topUsage] = topUids.length
    ? await Promise.all([
        db.select().from(userProfiles).where(inArray(userProfiles.uid, topUids)),
        lastOpenedTitles(db, topUids),
        usageByUser(db, topUids),
      ])
    : [[], new Map<string, string>(), new Map<string, UsageAggregate>()];
  const profileByUid = new Map(topProfiles.map((p) => [p.uid, p]));

  const mostActiveUsers = topUids.map((uid) => {
    const profile = profileByUid.get(uid);
    const usage = topUsage.get(uid);
    const lastOpenedAt = usage?.lastOpenedAt ?? "";
    const lastActive = latestIso(toIso(profile?.lastActiveAt), lastOpenedAt);
    return {
      uid,
      email: profile?.email ?? "",
      displayName: profile?.displayName ?? "",
      photoURL: profile?.photoUrl || undefined,
      resourceOpenCount: usage?.opens ?? 0,
      lastOpenedTitle: topTitles.get(uid) ?? "",
      lastOpenedAt,
      lastActive,
      branch: profile?.branch || "Unknown",
      semester: profile?.semester ?? null,
    };
  });

  return {
    overview: {
      userCount,
      activeLast7d,
      activeLast30d,
      dormant30d: Math.max(0, userCount - activeLast30d),
      neverOpened: Math.max(0, userCount - usersWithOpens),
      totalOpens,
      filesWithOpens,
      usersWithOpens,
      engagementRate: percent(usersWithOpens, userCount),
      activeRate7d: percent(activeLast7d, userCount),
      avgOpensPerEngaged:
        usersWithOpens > 0 ? Math.round((totalUserOpens / usersWithOpens) * 10) / 10 : 0,
      totalUserOpens,
    },
    byBranch: branchBreakdown,
    bySemester: semesterBreakdown,
    byProvider: providerBreakdown,
    topResources,
    mostActiveUsers,
  };
}

/** Users tab: profile mirror joined with each user's usage. */
export async function listAdminUsers(db: Db) {
  const profiles = await db
    .select()
    .from(userProfiles)
    .orderBy(desc(userProfiles.lastActiveAt))
    .limit(500);
  const uids = profiles.map((p) => p.uid);
  const [usage, titles] = await Promise.all([
    usageByUser(db, uids),
    lastOpenedTitles(db, uids),
  ]);

  return profiles.map((p) => {
    const agg = usage.get(p.uid);
    return {
      id: p.uid,
      uid: p.uid,
      email: p.email,
      displayName: p.displayName,
      provider: p.provider,
      branch: p.branch || "",
      semester: p.semester ?? null,
      lastActive: toIso(p.lastActiveAt),
      photoURL: p.photoUrl,
      resourceOpenCount: agg?.opens ?? 0,
      lastOpenedTitle: titles.get(p.uid) ?? "",
      lastOpenedAt: agg?.lastOpenedAt ?? "",
    };
  });
}
