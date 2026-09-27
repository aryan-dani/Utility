import { auth } from "@/lib/firebase/auth";
import { localDateKey } from "@/lib/dateLocal";

const STORAGE_KEY = "utility_activity_logs";
const FLUSH_INTERVAL_MS = 60_000;
const OPEN_DEBOUNCE_MS = 30_000;
const MAX_TITLE = 200;
const MAX_SUBJECT = 120;
const MAX_ID = 128;

type PendingOpen = {
  id: string;
  title: string;
  subject: string;
  count: number;
};

const pending = new Map<string, number>();
const pendingOpens = new Map<string, PendingOpen>();
const openDebounce = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lifecycleRegistered = false;

export { localDateKey };

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

function ensureLifecycleHooks() {
  if (typeof window === "undefined" || lifecycleRegistered) return;
  lifecycleRegistered = true;

  const flush = () => {
    void flushPending();
  };

  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPending();
  }, FLUSH_INTERVAL_MS);
}

function requeue(
  actions: Map<string, number>,
  opens: Map<string, PendingOpen>,
) {
  for (const [actionType, count] of actions) {
    pending.set(actionType, (pending.get(actionType) || 0) + count);
  }
  for (const [id, open] of opens) {
    const existing = pendingOpens.get(id);
    if (existing) {
      existing.count += open.count;
      existing.title = open.title || existing.title;
      existing.subject = open.subject || existing.subject;
    } else {
      pendingOpens.set(id, { ...open });
    }
  }
  scheduleFlush();
}

async function flushPending() {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (pending.size === 0 && pendingOpens.size === 0) return;

  const actionBatch = new Map(pending);
  const openBatch = new Map(pendingOpens);
  pending.clear();
  pendingOpens.clear();

  const user = auth.currentUser;
  if (!user) return;

  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch (err) {
    console.error("API logActivity token error:", err);
    requeue(actionBatch, openBatch);
    return;
  }

  const actions = [...actionBatch.entries()].map(([actionType, count]) => ({
    actionType,
    count,
  }));
  const opens = [...openBatch.values()].slice(0, 15);

  try {
    const res = await fetch("/api/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        ...(actions.length > 0 ? { actions } : {}),
        ...(opens.length > 0 ? { opens } : {}),
      }),
    });
    if (!res.ok) {
      console.error("API logActivity failed:", res.status);
      requeue(actionBatch, openBatch);
    }
  } catch (err) {
    console.error("API logActivity error:", err);
    requeue(actionBatch, openBatch);
  }
}

function bumpLocalHeatmap(count: number) {
  const today = localDateKey();
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const logs: Record<string, number> = existing ? JSON.parse(existing) : {};
    logs[today] = (logs[today] || 0) + count;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    window.dispatchEvent(new Event("activity_logged"));
  } catch (err) {
    console.error("Local activity log error:", err);
  }
}

/** Log study activity locally + optionally to Firestore API. No React UI deps. */
export function logActivity(actionType: string, count = 1) {
  if (typeof window === "undefined") return;

  ensureLifecycleHooks();
  bumpLocalHeatmap(count);

  if (!auth.currentUser) return;

  pending.set(actionType, (pending.get(actionType) || 0) + count);
  scheduleFlush();
}

export type ResourceOpenInput = {
  id: string;
  title?: string;
  subject?: string;
};

/**
 * Signed-in only: queue an in-app viewer open for the batched activity flush.
 * Same resourceId is debounced for 30s so remounts do not double-count.
 */
export function logResourceOpen(input: ResourceOpenInput) {
  if (typeof window === "undefined") return;
  if (!auth.currentUser) return;

  const id = truncate(String(input.id || ""), MAX_ID);
  if (!id) return;

  const now = Date.now();
  const last = openDebounce.get(id) || 0;
  if (now - last < OPEN_DEBOUNCE_MS) return;
  openDebounce.set(id, now);

  ensureLifecycleHooks();
  bumpLocalHeatmap(1);

  const title = truncate(String(input.title || ""), MAX_TITLE);
  const subject = truncate(String(input.subject || ""), MAX_SUBJECT);
  const existing = pendingOpens.get(id);
  if (existing) {
    existing.count += 1;
    if (title) existing.title = title;
    if (subject) existing.subject = subject;
  } else {
    pendingOpens.set(id, { id, title, subject, count: 1 });
  }
  scheduleFlush();
}

export { STORAGE_KEY as ACTIVITY_STORAGE_KEY };
