const RETURNING_AFTER_MS = 36 * 60 * 60 * 1000;

export type OnboardingKind = "new" | "returning";

/** Accounts older than 36 hours already used the site — skip the long tour. */
export function onboardingKindFromCreatedAt(
  createdAt: string | number | Date | null | undefined,
  now = Date.now(),
): OnboardingKind {
  if (createdAt == null || createdAt === "") return "new";
  const ms =
    typeof createdAt === "number"
      ? createdAt
      : createdAt instanceof Date
        ? createdAt.getTime()
        : Date.parse(createdAt);
  if (!Number.isFinite(ms)) return "new";
  return now - ms >= RETURNING_AFTER_MS ? "returning" : "new";
}
