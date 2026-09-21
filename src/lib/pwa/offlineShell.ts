/** Exact title rendered on `/~offline` (PageHeader). */
export const OFFLINE_SHELL_TITLE = "You're offline";

/** Case-insensitive match for stuck App Shell offline pages. */
export function isOfflineShellTitle(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.trim().toLowerCase() === OFFLINE_SHELL_TITLE.toLowerCase();
}
