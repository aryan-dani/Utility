/** Browser keys scoped to a signed-in Utility account. Theme is left intact. */
const EXACT_KEYS = [
  "utility-workspace",
  "utility_activity_logs",
  "utility_favorite_resources",
  "utility_recent_resources",
  "utility_reading_progress",
  "utility_syllabus_progress",
  "utility_srs_decks",
  "utility_srs_cards",
  "utility_srs_meta",
  "utility_chat_sessions",
  "utility_focus_sessions",
  "utility_focus_logs",
  "utility_viz_telemetry",
  "gpa_strategy_v1",
  "gpa_roadmap_v1",
];

const PREFIXES = ["utility_planner_v2_"];

export function clearLocalUserData(): void {
  if (typeof window === "undefined") return;

  for (const key of EXACT_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* private mode / quota */
    }
  }

  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && PREFIXES.some((prefix) => key.startsWith(prefix))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }

  document.cookie =
    "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
}
