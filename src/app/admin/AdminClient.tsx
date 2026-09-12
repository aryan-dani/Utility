"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useMemo } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  Trash,
  Edit2,
  Check,
  X,
  File as FileIcon,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  CloudFog,
  ExternalLink,
  HardDrive,
  ShieldAlert,
  Users,
  BarChart3,
  Flame,
  Eye,
  ChevronDown,
  ChevronRight,
  Activity,
  Files,
  Search,
  PieChart,
} from "lucide-react";
import AppLink from "@/components/ui/AppLink";
import type { Branch, Semester } from "@/lib/academic/scope";
import { BRANCH_OPTIONS, SEMESTER_OPTIONS } from "@/lib/academic/scope";
import { Select } from "@/components/ui/Select";
import { PageHeader, Card, Segmented, Button, Input } from "@/components/ui";
import {
  ActivityFunnel,
  DonutChart,
  formatCompact,
  HighlightText,
  KpiTile,
  RankBars,
  ShareBars,
} from "@/components/admin/AdminCharts";
import { fetchAdminStatus } from "@/lib/adminStatus";
import { authFetch } from "@/lib/authFetch";

interface Subject {
  id: string;
  name: string;
  branch: string;
  semester: number;
}

interface Resource {
  id: string;
  title: string;
  file_url: string;
  subject_id: string;
  is_indexed?: boolean;
}

type AdminTab = "overview" | "users" | "manage" | "drive";

type AdminUser = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  provider: string;
  branch: string;
  semester: number | null;
  lastActive: string;
  photoURL?: string;
  resourceOpenCount: number;
  lastOpenedTitle: string;
  lastOpenedAt: string;
};

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
};

type OverviewStats = {
  userCount: number;
  activeLast7d: number;
  activeLast30d?: number;
  dormant30d?: number;
  neverOpened?: number;
  totalOpens: number;
  filesWithOpens: number;
  usersWithOpens?: number;
  engagementRate?: number;
  activeRate7d?: number;
  avgOpensPerEngaged?: number;
  totalUserOpens?: number;
};

type BranchCount = { branch: string; count: number };
type SemesterCount = { semester: string; count: number };
type ProviderCount = { provider: string; count: number };

type UserActiveFilter = "all" | "7d" | "30d";

type UserUsageRow = {
  id: string;
  title: string;
  subject: string;
  count: number;
  lastOpenedAt: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unknown error occurred.";
}

function formatWhen(value: string | undefined): string {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Never";
  return d.toLocaleString();
}

function isActiveWithin(usr: AdminUser, days: number): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const stamps = [usr.lastActive, usr.lastOpenedAt]
    .filter(Boolean)
    .map((s) => new Date(s).getTime())
    .filter((t) => !Number.isNaN(t));
  if (stamps.length === 0) return false;
  return Math.max(...stamps) >= cutoff;
}

const TAB_OPTIONS: { value: AdminTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "users", label: "Users" },
  { value: "manage", label: "Files" },
  { value: "drive", label: "Drive" },
];

const USER_ACTIVE_OPTIONS: { value: UserActiveFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "7d", label: "Active 7d" },
  { value: "30d", label: "Active 30d" },
];

export default function AdminClient({
  driveFolderUrl,
}: {
  driveFolderUrl?: string | null;
}) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [branch, setBranch] = useState<Branch>("AIDS");
  const [semester, setSemester] = useState<Semester>(5);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");

  const [message, setMessage] = useState("");
  const [syncingDrive, setSyncingDrive] = useState(false);

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [byBranch, setByBranch] = useState<BranchCount[]>([]);
  const [bySemester, setBySemester] = useState<SemesterCount[]>([]);
  const [byProvider, setByProvider] = useState<ProviderCount[]>([]);
  const [topResources, setTopResources] = useState<TopResource[]>([]);
  const [mostActiveUsers, setMostActiveUsers] = useState<ActiveUser[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [userUsage, setUserUsage] = useState<Record<string, UserUsageRow[]>>({});
  const [loadingUsageUid, setLoadingUsageUid] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userActiveFilter, setUserActiveFilter] =
    useState<UserActiveFilter>("all");
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  const currentUid = auth.currentUser?.uid ?? null;

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return usersList.filter((usr) => {
      if (userActiveFilter === "7d" && !isActiveWithin(usr, 7)) return false;
      if (userActiveFilter === "30d" && !isActiveWithin(usr, 30)) return false;
      if (!q) return true;
      const hay = `${usr.displayName} ${usr.email} ${usr.uid}`.toLowerCase();
      return hay.includes(q);
    });
  }, [usersList, userSearch, userActiveFilter]);

  const fetchUsers = useCallback(async () => {
    await Promise.resolve();
    setLoadingUsers(true);
    try {
      const res = await authFetch("/api/admin/users");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsersList(data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    await Promise.resolve();
    setLoadingStats(true);
    try {
      const res = await authFetch("/api/admin/stats");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setOverview(data.overview || null);
      setByBranch(data.byBranch || []);
      setBySemester(data.bySemester || []);
      setByProvider(data.byProvider || []);
      setTopResources(data.topResources || []);
      setMostActiveUsers(data.mostActiveUsers || []);
    } catch (err) {
      console.error("Error fetching admin stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchUserUsage = useCallback(async (uid: string) => {
    setLoadingUsageUid(uid);
    try {
      const res = await authFetch(
        `/api/admin/users/${encodeURIComponent(uid)}/usage`,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUserUsage((prev) => ({ ...prev, [uid]: data.resources || [] }));
    } catch (err) {
      console.error("Error fetching user usage:", err);
      setUserUsage((prev) => ({ ...prev, [uid]: [] }));
    } finally {
      setLoadingUsageUid(null);
    }
  }, []);

  const handleRemoveUser = useCallback(
    async (uid: string, label: string) => {
      if (uid === currentUid) {
        setMessage("You cannot remove your own admin profile.");
        return;
      }
      if (
        !confirm(
          `Remove ${label} from Utility?\n\nThis deletes their Firestore profile and usage stats. Their Google/GitHub login still works and a fresh profile can return on next visit.`,
        )
      ) {
        return;
      }
      setRemovingUid(uid);
      setMessage("");
      try {
        const res = await authFetch(
          `/api/admin/users?uid=${encodeURIComponent(uid)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const text = await res.text();
          let err = text;
          try {
            err = JSON.parse(text).error || text;
          } catch {
            /* keep text */
          }
          throw new Error(err);
        }
        setUsersList((prev) => prev.filter((u) => (u.uid || u.id) !== uid));
        setUserUsage((prev) => {
          const next = { ...prev };
          delete next[uid];
          return next;
        });
        if (expandedUid === uid) setExpandedUid(null);
        setMessage(`✓ Removed profile for ${label}.`);
        void fetchStats();
      } catch (err) {
        setMessage(`Error removing user: ${getErrorMessage(err)}`);
      } finally {
        setRemovingUid(null);
      }
    },
    [currentUid, expandedUid, fetchStats],
  );

  const handleTabChange = (next: AdminTab) => {
    setTab(next);
    if (next === "users") void fetchUsers();
    if (next === "overview") void fetchStats();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUserEmail(user?.email ?? null);
      if (!user) {
        setIsAdmin(false);
        setLoadingAuth(false);
        return;
      }
      try {
        const { isAdmin: admin } = await fetchAdminStatus(
          () => user.getIdToken(),
          user.uid,
        );
        setIsAdmin(admin);
        if (admin) {
          void fetchStats();
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [fetchStats]);

  const handleSyncDrive = async () => {
    setSyncingDrive(true);
    setMessage("");
    try {
      if (!auth.currentUser) {
        throw new Error("You must be signed in to sync Drive.");
      }
      const response = await authFetch("/api/webhooks/storage-sync", {
        method: "POST",
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Server returned status ${response.status} (Not JSON). Response snippet: ${text.substring(0, 300)}`,
        );
      }
      if (response.ok && data.success) {
        setMessage(
          `✓ ${data.message || "Google Drive sync triggered. It will take a few minutes to process."}`,
        );
      } else {
        setMessage(`Error syncing: ${data.error || "Failed to trigger sync"}`);
      }
    } catch (err) {
      setMessage(`Error syncing: ${getErrorMessage(err)}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  const fetchAdminData = useCallback(async () => {
    if (!isAdmin) return;
    await Promise.resolve();
    setLoadingResources(true);
    try {
      const res = await authFetch(
        `/api/admin/resources?branch=${branch}&semester=${semester}`,
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setSubjects(data.subjects || []);
      setResources(data.resources || []);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoadingResources(false);
    }
  }, [branch, semester, isAdmin]);

  const adminDataKey = `${branch}:${semester}:${isAdmin}`;
  const [prevAdminDataKey, setPrevAdminDataKey] = useState(adminDataKey);
  if (isAdmin && prevAdminDataKey !== adminDataKey) {
    setPrevAdminDataKey(adminDataKey);
    void fetchAdminData();
  }

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Warning: If this file still exists in Google Drive, it will be recreated on the next sync. Make sure to delete it from Drive first. Continue with local db deletion?",
      )
    )
      return;
    try {
      const res = await authFetch(`/api/admin/resources?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }

      setResources((prev) => prev.filter((r) => r.id !== id));
      setMessage("✓ File deleted successfully from local database.");
    } catch (error: unknown) {
      alert(`Error deleting: ${getErrorMessage(error)}`);
    }
  };

  const startEdit = (resource: Resource) => {
    setEditingId(resource.id);
    setEditTitle(resource.title);
    setEditSubjectId(resource.subject_id);
  };

  const saveEdit = async (id: string) => {
    try {
      const res = await authFetch("/api/admin/resources", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          title: editTitle,
          subject_id: editSubjectId,
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }

      setResources((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, title: editTitle, subject_id: editSubjectId }
            : r,
        ),
      );
      setEditingId(null);
      setMessage("✓ Resource updated.");
    } catch (error: unknown) {
      alert(`Error updating: ${getErrorMessage(error)}`);
    }
  };

  const toggleUserExpand = (uid: string) => {
    if (expandedUid === uid) {
      setExpandedUid(null);
      return;
    }
    setExpandedUid(uid);
    if (!userUsage[uid]) {
      void fetchUserUsage(uid);
    }
  };

  if (loadingAuth) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
          <p className="text-xs text-muted font-semibold">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center w-full page-gutter py-16 text-center">
        <Card className="max-w-md w-full rounded-2xl p-8 flex flex-col items-center" padding="none">
          <ShieldAlert className="w-12 h-12 text-destructive mb-4 animate-pulse" />
          <PageHeader
            className="text-center sm:flex-col sm:items-center [&_p]:mx-auto mb-2"
            title="Access Denied"
            description="You do not have permissions to access the admin dashboard. Please sign in with an authorized administrator account."
          />
          <AppLink
            href="/"
            className="mt-6 px-4 py-2 bg-foreground text-background font-semibold text-xs rounded-xl hover:opacity-90 transition-all shadow-xs"
          >
            Return Home
          </AppLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto page-gutter py-6 sm:py-10 flex flex-col gap-6">
      <PageHeader
        eyebrow="System"
        title="Admin"
        description={
          userEmail
            ? `Signed in as ${userEmail}. Track who uses the vault and manage Drive sync.`
            : "Platform operations and signed-in usage."
        }
        actions={
          <div className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="w-4 h-4 text-foreground" />
            <span className="font-semibold tracking-tight">Admin access</span>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Segmented
          value={tab}
          options={TAB_OPTIONS}
          onChange={handleTabChange}
          aria-label="Admin sections"
          className="w-full sm:w-auto"
        />
        {tab === "overview" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchStats()}
            disabled={loadingStats}
            className="sm:ml-auto"
          >
            {loadingStats ? "Refreshing…" : "Refresh"}
          </Button>
        )}
        {tab === "users" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchUsers()}
            disabled={loadingUsers}
            className="sm:ml-auto"
          >
            {loadingUsers ? "Refreshing…" : "Refresh"}
          </Button>
        )}
      </div>

      {message && (
        <div className="p-4 rounded-2xl text-sm font-medium border bg-card border-border text-foreground flex items-start gap-3 shadow-card">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p>{message}</p>
        </div>
      )}

      {tab === "overview" && (
        <div className="flex flex-col gap-5 sm:gap-6 animate-fade-in">
          {loadingStats && !overview ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <KpiTile
                  label="Signed-in users"
                  value={formatCompact(overview?.userCount ?? 0)}
                  hint={
                    overview?.activeRate7d != null
                      ? `${overview.activeRate7d}% active in last 7 days`
                      : undefined
                  }
                  icon={<Users className="w-3.5 h-3.5 text-foreground" />}
                />
                <KpiTile
                  label="Engagement"
                  value={`${overview?.engagementRate ?? 0}%`}
                  hint={`${formatCompact(overview?.usersWithOpens ?? 0)} users have opened at least one file`}
                  icon={<Flame className="w-3.5 h-3.5 text-foreground" />}
                />
                <KpiTile
                  label="Resource opens"
                  value={formatCompact(overview?.totalOpens ?? 0)}
                  hint={`Avg ${overview?.avgOpensPerEngaged ?? 0} opens per engaged user`}
                  icon={<Eye className="w-3.5 h-3.5 text-foreground" />}
                />
                <KpiTile
                  label="Catalog reach"
                  value={formatCompact(overview?.filesWithOpens ?? 0)}
                  hint="Files with at least one signed-in open"
                  icon={<Files className="w-3.5 h-3.5 text-foreground" />}
                />
              </div>

              <Card className="rounded-2xl" padding="md">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-foreground" />
                  <h3 className="text-sm font-bold text-foreground">
                    Activity pulse
                  </h3>
                </div>
                <ActivityFunnel
                  segments={[
                    {
                      label: "Active 7d",
                      value: overview?.activeLast7d ?? 0,
                      hint: "Signed in or opened a file",
                    },
                    {
                      label: "Active 30d",
                      value: overview?.activeLast30d ?? 0,
                      hint: "Still in the product monthly",
                    },
                    {
                      label: "Engaged",
                      value: overview?.usersWithOpens ?? 0,
                      hint: "Ever opened a vault file",
                    },
                    {
                      label: "Never opened",
                      value: overview?.neverOpened ?? 0,
                      hint: "Accounts with zero opens",
                    },
                  ]}
                />
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                <Card className="rounded-2xl overflow-hidden" padding="none">
                  <div className="px-5 py-4 border-b border-border bg-surface/40 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-foreground" />
                    <h3 className="text-sm font-bold text-foreground">
                      Users by branch
                    </h3>
                  </div>
                  <div className="p-5">
                    {byBranch.length === 0 ? (
                      <p className="text-sm text-muted text-center py-8">
                        No branch data yet.
                      </p>
                    ) : (
                      <DonutChart
                        items={byBranch.map((r) => ({
                          key: r.branch,
                          label: r.branch,
                          value: r.count,
                        }))}
                        centerLabel="Users"
                        centerValue={formatCompact(overview?.userCount ?? 0)}
                      />
                    )}
                  </div>
                </Card>

                <Card className="rounded-2xl overflow-hidden" padding="none">
                  <div className="px-5 py-4 border-b border-border bg-surface/40 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-foreground" />
                    <h3 className="text-sm font-bold text-foreground">
                      Users by semester
                    </h3>
                  </div>
                  <div className="p-5">
                    {bySemester.length === 0 ? (
                      <p className="text-sm text-muted text-center py-8">
                        No semester data yet.
                      </p>
                    ) : (
                      <ShareBars
                        items={bySemester.map((r) => ({
                          key: r.semester,
                          label: r.semester,
                          value: r.count,
                        }))}
                      />
                    )}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                <Card className="rounded-2xl overflow-hidden" padding="none">
                  <div className="px-5 py-4 border-b border-border bg-surface/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <BarChart3 className="w-4 h-4 text-foreground shrink-0" />
                      <h3 className="text-sm font-bold text-foreground truncate">
                        Top resources
                      </h3>
                    </div>
                    <span className="text-2xs text-muted shrink-0">
                      by signed-in opens
                    </span>
                  </div>
                  <RankBars
                    empty="No signed-in viewer opens yet. Opens are counted when a signed-in user opens a file in the vault."
                    items={topResources.map((r) => ({
                      key: r.id,
                      label: r.title,
                      meta: [
                        r.subject || "Uncategorized",
                        r.uniqueOpeners > 0
                          ? `${r.uniqueOpeners} openers`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      value: r.opens,
                    }))}
                  />
                </Card>

                <Card className="rounded-2xl overflow-hidden" padding="none">
                  <div className="px-5 py-4 border-b border-border bg-surface/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Flame className="w-4 h-4 text-foreground shrink-0" />
                      <h3 className="text-sm font-bold text-foreground truncate">
                        Most active users
                      </h3>
                    </div>
                    <span className="text-2xs text-muted shrink-0">
                      lifetime opens
                    </span>
                  </div>
                  <RankBars
                    empty="Usage will appear here after signed-in students open resources in the app."
                    items={mostActiveUsers
                      .filter((u) => u.resourceOpenCount > 0)
                      .map((u) => ({
                        key: u.uid,
                        label:
                          u.displayName ||
                          u.email?.split("@")[0] ||
                          "Student",
                        meta: u.lastOpenedTitle || u.email || "No file yet",
                        value: u.resourceOpenCount,
                        leading: (
                          <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center text-xs font-black overflow-hidden border border-border/60 shrink-0">
                            {u.photoURL ? (
                              <Image
                                src={u.photoURL}
                                alt=""
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                unoptimized
                              />
                            ) : (
                              u.displayName?.[0] ?? u.email?.[0] ?? "?"
                            )}
                          </div>
                        ),
                      }))}
                  />
                </Card>
              </div>

              {byProvider.length > 1 && (
                <Card className="rounded-2xl overflow-hidden" padding="none">
                  <div className="px-5 py-4 border-b border-border bg-surface/40 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-foreground" />
                    <h3 className="text-sm font-bold text-foreground">
                      Sign-in providers
                    </h3>
                  </div>
                  <div className="p-5">
                    <ShareBars
                      items={byProvider.map((r) => ({
                        key: r.provider,
                        label: r.provider,
                        value: r.count,
                      }))}
                    />
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {tab === "drive" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <Card className="rounded-2xl" padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center">
                <CloudFog className="w-5 h-5 text-foreground" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Google Drive Integration
              </h3>
            </div>
            <p className="text-sm text-muted mb-8 max-w-2xl leading-relaxed">
              Utility uses Google Drive as the single source of truth. Do not
              upload files here. Instead, upload your PDFs, DOCs, and PPTs into
              the Google Drive folder. Once uploaded, click &quot;Sync Now&quot; to
              ingest them into Firebase and start AI indexing.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={driveFolderUrl || "https://drive.google.com/drive/my-drive"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
              >
                <span>Open Utility Drive</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={handleSyncDrive}
                disabled={syncingDrive}
                className="inline-flex items-center justify-center gap-2 bg-surface text-foreground border border-border font-semibold text-sm px-6 py-3 rounded-xl hover:bg-surface-hover hover:border-border-strong transition-all disabled:opacity-50"
              >
                {syncingDrive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <HardDrive className="w-4 h-4" />
                )}
                <span>{syncingDrive ? "Syncing..." : "Sync Now"}</span>
              </button>
            </div>
          </Card>
        </div>
      )}

      {tab === "manage" && (
        <div className="flex flex-col gap-4 sm:gap-6 animate-fade-in">
          <Card className="rounded-2xl" padding="md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                  Branch
                </label>
                <Select<Branch>
                  value={branch}
                  options={BRANCH_OPTIONS}
                  onChange={setBranch}
                  size="lg"
                />
              </div>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                  Semester
                </label>
                <Select<Semester>
                  value={semester}
                  options={SEMESTER_OPTIONS}
                  onChange={setSemester}
                  size="lg"
                />
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl overflow-hidden" padding="none">
            {loadingResources ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted" />
              </div>
            ) : resources.length === 0 ? (
              <div className="p-12 text-center text-muted text-sm">
                No files found for this branch and semester.
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
                {resources.map((resource) => {
                  const subject = subjects.find(
                    (s) => s.id === resource.subject_id,
                  );
                  const isEditing = editingId === resource.id;
                  return (
                    <div
                      key={resource.id}
                      className="p-4 flex items-center justify-between hover:bg-surface/30 transition-all"
                    >
                      <div className="flex-1 mr-4 min-w-0">
                        {isEditing ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-primary text-foreground"
                              placeholder="Resource Title"
                            />
                            <div className="relative">
                              <select
                                value={editSubjectId}
                                onChange={(e) =>
                                  setEditSubjectId(e.target.value)
                                }
                                className="ui-select w-full pr-8"
                              >
                                {subjects.map((sub) => (
                                  <option key={sub.id} value={sub.id}>
                                    {sub.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <FileIcon className="w-4 h-4 text-foreground shrink-0" />
                            <div className="min-w-0">
                              <h3 className="font-bold text-foreground text-sm tracking-tight truncate">
                                {resource.title}
                              </h3>
                              <div className="flex items-center flex-wrap gap-2 mt-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                                  {subject?.name || "Uncategorized"}
                                </span>
                                {(() => {
                                  const indexableExts = [
                                    ".pdf",
                                    ".docx",
                                    ".pptx",
                                    ".doc",
                                    ".ppt",
                                  ];
                                  const isIndexable = indexableExts.some(
                                    (ext) =>
                                      resource.title
                                        .toLowerCase()
                                        .endsWith(ext),
                                  );
                                  if (resource.is_indexed) {
                                    return (
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-foreground" />
                                        Indexed
                                      </span>
                                    );
                                  }
                                  if (isIndexable) {
                                    return (
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted flex items-center gap-1 animate-pulse">
                                        <span className="w-1 h-1 rounded-full bg-muted" />
                                        Indexing...
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted/70 flex items-center gap-1">
                                      <span className="w-1 h-1 rounded-full bg-muted/50" />
                                      Static / Non-Indexable
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(resource.id)}
                              className="p-1.5 bg-foreground text-background rounded-lg hover:opacity-90"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-surface border border-border text-muted hover:text-foreground rounded-lg"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={resource.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded-lg"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => startEdit(resource)}
                              className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded-lg"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(resource.id)}
                              className="p-1.5 text-muted hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "users" && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <Card className="rounded-2xl" padding="md">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <Input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search name or email…"
                  className="pl-9"
                  aria-label="Search users"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Segmented
                value={userActiveFilter}
                options={USER_ACTIVE_OPTIONS}
                onChange={setUserActiveFilter}
                aria-label="Filter by activity"
                size="sm"
              />
            </div>
          </Card>

          <Card className="rounded-2xl overflow-hidden" padding="none">
            <div className="px-5 py-4 border-b border-border bg-surface/40 flex items-center gap-2">
              <Users className="w-4 h-4 text-foreground" />
              <h3 className="text-sm font-bold text-foreground">
                Registered users
              </h3>
              <span className="ml-auto text-2xs text-muted font-medium">
                {filteredUsers.length}
                {filteredUsers.length !== usersList.length
                  ? ` of ${usersList.length}`
                  : ""}{" "}
                · expand for files · remove deletes Firestore only
              </span>
            </div>

            {loadingUsers ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-muted text-sm">
                {usersList.length === 0
                  ? "No registered users found in the database."
                  : "No users match this search or activity filter."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface/40 border-b border-border text-muted font-bold uppercase tracking-wider select-none">
                      <th className="p-4 font-semibold w-8" />
                      <th className="p-4 font-semibold">User</th>
                      <th className="p-4 font-semibold">Email</th>
                      <th className="p-4 font-semibold">Opens</th>
                      <th className="p-4 font-semibold">Last file</th>
                      <th className="p-4 font-semibold">Last active</th>
                      <th className="p-4 font-semibold w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {filteredUsers.map((usr) => {
                      const uid = usr.uid || usr.id;
                      const expanded = expandedUid === uid;
                      const usageRows = userUsage[uid];
                      return (
                        <UserRows
                          key={usr.id}
                          usr={usr}
                          uid={uid}
                          searchQuery={userSearch}
                          expanded={expanded}
                          usageRows={usageRows}
                          loadingUsage={loadingUsageUid === uid}
                          removing={removingUid === uid}
                          canRemove={uid !== currentUid}
                          onToggle={() => toggleUserExpand(uid)}
                          onRemove={() =>
                            void handleRemoveUser(
                              uid,
                              usr.displayName ||
                                usr.email ||
                                uid,
                            )
                          }
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function UserRows({
  usr,
  uid,
  searchQuery,
  expanded,
  usageRows,
  loadingUsage,
  removing,
  canRemove,
  onToggle,
  onRemove,
}: {
  usr: AdminUser;
  uid: string;
  searchQuery: string;
  expanded: boolean;
  usageRows: UserUsageRow[] | undefined;
  loadingUsage: boolean;
  removing: boolean;
  canRemove: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const display =
    usr.displayName || usr.email?.split("@")[0] || "Student";
  return (
    <>
      <tr
        className="hover:bg-surface/10 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="p-4 text-muted">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </td>
        <td className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center text-xs font-black overflow-hidden border border-border/60 shrink-0">
              {usr.photoURL ? (
                <Image
                  src={usr.photoURL}
                  alt=""
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              ) : (
                display[0] ?? "?"
              )}
            </div>
            <div className="min-w-0">
              <HighlightText
                text={display}
                query={searchQuery}
                className="font-semibold text-foreground block truncate"
              />
              <span className="text-[9px] font-extrabold uppercase tracking-wide text-muted block mt-0.5">
                {usr.provider || "Unknown"} · {usr.branch || "AIDS"} Sem{" "}
                {usr.semester || "-"}
              </span>
            </div>
          </div>
        </td>
        <td className="p-4 text-muted font-mono">
          <HighlightText text={usr.email || "No email"} query={searchQuery} />
        </td>
        <td className="p-4 font-bold text-foreground tabular-nums">
          {usr.resourceOpenCount || 0}
        </td>
        <td className="p-4 text-muted max-w-[12rem] truncate">
          {usr.lastOpenedTitle || "-"}
        </td>
        <td className="p-4 text-muted font-mono whitespace-nowrap">
          {formatWhen(usr.lastActive)}
        </td>
        <td className="p-4">
          {canRemove ? (
            <button
              type="button"
              disabled={removing}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1.5 text-muted hover:text-destructive hover:bg-destructive/10 rounded-lg disabled:opacity-50"
              title="Remove Firestore profile"
              aria-label={`Remove ${usr.displayName || usr.email || uid}`}
            >
              {removing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="text-[9px] font-bold uppercase text-muted">You</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface/20">
          <td colSpan={7} className="p-4 sm:px-8">
            {loadingUsage ? (
              <div className="flex items-center gap-2 text-xs text-muted py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading frequent files…
              </div>
            ) : !usageRows || usageRows.length === 0 ? (
              <p className="text-xs text-muted py-2">
                No in-app resource opens recorded for this user yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {usageRows.map((row) => (
                  <li
                    key={`${uid}-${row.id}`}
                    className="flex items-center justify-between gap-3 text-xs rounded-xl border border-border/70 bg-card px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {row.title}
                      </p>
                      <p className="text-2xs text-muted truncate">
                        {row.subject || "Uncategorized"}
                        {row.lastOpenedAt
                          ? ` · ${formatWhen(row.lastOpenedAt)}`
                          : ""}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums text-foreground shrink-0">
                      {row.count}×
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
