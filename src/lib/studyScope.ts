const SCOPE_KEY = "utility-study-scope";

export type StudyScope = {
  subject: string;
  unit: string;
};

export function readStudyScope(): StudyScope {
  if (typeof window === "undefined") return { subject: "", unit: "" };
  try {
    const raw = localStorage.getItem(SCOPE_KEY);
    if (!raw) return { subject: "", unit: "" };
    const parsed = JSON.parse(raw) as Partial<StudyScope>;
    return {
      subject: typeof parsed.subject === "string" ? parsed.subject : "",
      unit: typeof parsed.unit === "string" ? parsed.unit : "",
    };
  } catch {
    return { subject: "", unit: "" };
  }
}

export function writeStudyScope(subject: string, unit: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SCOPE_KEY,
      JSON.stringify({ subject: subject.trim(), unit: unit.trim() }),
    );
  } catch {
    /* quota */
  }
}
