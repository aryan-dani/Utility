/** Defensive readers for Firestore document fields used by the one-time imports. */

export function toDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value === "object" && "toDate" in value) {
    const fn = (value as { toDate: () => Date }).toDate;
    return typeof fn === "function" ? fn.call(value) : null;
  }
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export function int(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

export function stringArray(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string").slice(0, max)
    : [];
}
