export type FocusMode = "work" | "break" | "longBreak";

export type FocusRun = {
  mode: FocusMode;
  endsAt: number;
  label: string;
  minutes: number;
  logged: boolean;
};

const KEY = "utility_focus_run";
const EVENT = "utility-focus-run";

export function readFocusRun(): FocusRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FocusRun;
    if (!parsed || typeof parsed.endsAt !== "number") return null;
    if (parsed.endsAt <= Date.now() - 60_000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeFocusRun(run: FocusRun): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(run));
  window.dispatchEvent(new Event(EVENT));
}

export function clearFocusRun(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function markFocusLogged(): void {
  const run = readFocusRun();
  if (!run || run.logged) return;
  writeFocusRun({ ...run, logged: true });
}

export function subscribeFocusRun(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function formatFocusClock(endsAt: number): string {
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function startFocusMinutes(minutes: number, label = "Focus"): FocusRun {
  const safe = Math.min(180, Math.max(1, Math.floor(minutes)));
  const run: FocusRun = {
    mode: "work",
    endsAt: Date.now() + safe * 60_000,
    label,
    minutes: safe,
    logged: false,
  };
  writeFocusRun(run);
  return run;
}
