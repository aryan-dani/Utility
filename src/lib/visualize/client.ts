import { auth } from "@/lib/firebase/auth";
import { SavedGridData } from "@/lib/visualize/grid";

export type SavedGrid = {
  id: string;
  name: string;
  gridData: SavedGridData;
  created_at: string | null;
};

export type AlgorithmProgress = {
  algorithmId: string;
  completed: boolean;
  timeSpentSeconds: number;
  updated_at: string | null;
};

async function authHeaders(required: boolean): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    if (required) throw new Error("Sign in required");
    return { "Content-Type": "application/json" };
  }
  const token = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchSavedGrids(): Promise<SavedGrid[]> {
  const headers = await authHeaders(true);
  const res = await fetch("/api/visualize/grids", { headers });
  if (!res.ok) throw new Error("Failed to load mazes");
  const data = await res.json();
  return data.grids ?? [];
}

export async function fetchSavedGrid(id: string): Promise<SavedGrid | null> {
  const headers = await authHeaders(true);
  const res = await fetch(`/api/visualize/grids?id=${encodeURIComponent(id)}`, {
    headers,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load maze");
  const data = await res.json();
  return data.grid ?? null;
}

export async function saveGrid(
  name: string,
  gridData: SavedGridData,
): Promise<string> {
  const headers = await authHeaders(true);
  const res = await fetch("/api/visualize/grids", {
    method: "POST",
    headers,
    body: JSON.stringify({ name, gridData }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to save maze");
  }
  const data = await res.json();
  return data.id;
}

export async function deleteGrid(id: string): Promise<void> {
  const headers = await authHeaders(true);
  const res = await fetch(`/api/visualize/grids?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete maze");
}

export async function fetchProgress(): Promise<AlgorithmProgress[]> {
  const headers = await authHeaders(true);
  const res = await fetch("/api/visualize/progress", { headers });
  if (!res.ok) throw new Error("Failed to load progress");
  const data = await res.json();
  return data.progress ?? [];
}

export async function markAlgorithmComplete(
  algorithmId: string,
  timeSpentSeconds: number,
): Promise<void> {
  if (!auth.currentUser) return;
  const headers = await authHeaders(true);
  const normalizedId = algorithmId.replace(/-tree$/, "");
  await fetch("/api/visualize/progress", {
    method: "POST",
    headers,
    body: JSON.stringify({
      algorithmId: normalizedId,
      completed: true,
      timeSpentSeconds,
    }),
  });
}

export async function logTelemetryEvent(payload: {
  sessionId: string;
  algorithmId: string;
  action: string;
}): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("utility_viz_telemetry") !== "1") return;
  } catch {
    return;
  }
  const headers = await authHeaders(false);
  // Strip -tree so graph/tree sessions share the same algorithm id in telemetry.
  const algorithmId = payload.algorithmId.replace(/-tree$/, "");
  await fetch("/api/visualize/telemetry", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...payload, algorithmId }),
  });
}
