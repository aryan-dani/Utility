/**
 * Decide whether a waiting service worker should toast or silent-apply.
 *
 * Silent apply: cold start (waiting already present), hidden tab, or recovery.
 * Toast: page was already controlled AND visible when this worker finished install.
 */

export type UpdateDecision = "silent" | "toast" | "skip";

export type UpdateDecisionInput = {
  /** True when a controller already owns this page (not first SW install). */
  hasController: boolean;
  /** document.visibilityState === "visible" */
  isVisible: boolean;
  /** Waiting worker existed before this page's updatefound for this worker. */
  wasWaitingOnLoad: boolean;
  /** User dismissed "Later" this session. */
  dismissedThisSession: boolean;
  /** Already applying / reloading. */
  updateInFlight: boolean;
  /** Stuck offline shell while online — always force activate. */
  forceRecovery: boolean;
};

export function decideWaitingWorkerAction(
  input: UpdateDecisionInput,
): UpdateDecision {
  if (input.updateInFlight) return "skip";
  if (input.forceRecovery) return "silent";

  // Cold start / reopen: waiting SW from a previous visit → apply without toast.
  if (input.wasWaitingOnLoad) return "silent";

  // Tab not visible (background / minimized Store window) → silent apply.
  if (!input.isVisible) return "silent";

  // First SW install (no controller yet) — browser will claim; no update toast.
  if (!input.hasController) return "silent";

  // User said Later — do not re-prompt this session; next open silent-applies.
  if (input.dismissedThisSession) return "skip";

  // Live, controlled, visible page discovered a new waiting worker → toast.
  return "toast";
}

export const SW_UPDATE_SESSION = {
  applying: "utility-sw-applying",
  justUpdated: "utility-sw-just-updated",
  dismissed: "utility-sw-update-dismissed",
} as const;
