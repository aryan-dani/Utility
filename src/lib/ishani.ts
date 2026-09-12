/**
 * Server-side client for Ishani FastAPI campus data.
 * Same public endpoints Ishani uses - no local copy of JSON.
 */

export type FacultySeat = {
  Sr?: number;
  Name_of_Faculty?: string;
  Designation?: string;
  Department?: string;
  Seating_ID?: string;
  Type?: string;
  [key: string]: unknown;
};

export type StaffMember = {
  srNo?: number;
  name?: string;
  designation?: string;
  qualification?: string;
  experience?: string;
  specialization?: string;
  email?: string;
  mobile?: string;
  profileLink?: string;
  facultyGroup?: string;
  details?: Record<string, string>;
  [key: string]: unknown;
};

export type LabFacility = {
  srNo?: number;
  labName?: string;
  roomNo?: string;
  machineMake?: string;
  systems?: number;
  capacity?: number;
  labAssistant?: string;
  floor?: string;
  internet?: string;
  [key: string]: unknown;
};

export type HomeCampusData = {
  staff: StaffMember[];
  infrastructure: LabFacility[];
};

const FETCH_TIMEOUT_MS = 12_000;

/** Same public FastAPI host Ishani Pages uses (`VITE_API_URL`). */
export const DEFAULT_ISHANI_API_URL = "https://api.aryandani.com";

/** Normalize ISHANI_API_URL like Ishani's VITE_API_URL → …/api */
export function getIshaniApiBase(): string | null {
  // Prefer explicit env; on Vercel fall back to the live Ishani API so campus works
  // even if the env var was forgotten. Local stays opt-in via .env.local.
  const raw =
    process.env.ISHANI_API_URL?.trim() ||
    (process.env.VERCEL ? DEFAULT_ISHANI_API_URL : null);
  if (!raw) return null;
  let base = raw.replace(/\/$/, "");
  if (!base.endsWith("/api")) {
    base += "/api";
  }
  return base;
}

export function isIshaniConfigured(): boolean {
  return !!getIshaniApiBase();
}

export async function ishaniGet<T>(
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const base = getIshaniApiBase();
  if (!base) {
    return { ok: false, error: "ISHANI_API_URL is not configured" };
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `Ishani responded with ${res.status}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Ishani request timed out"
          : err.message
        : "Failed to reach Ishani";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

function asciiLetters(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function emailLocalPart(email: string | undefined): string {
  return asciiLetters(String(email || "").split("@")[0] || "");
}

function staffNameTokens(name: string | undefined): string[] {
  return String(name || "")
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s.]+/)
    .map(asciiLetters)
    .filter(
      (token) =>
        token.length >= 3 &&
        !["dr", "mrs", "mr", "ms", "prof", "smt", "miss"].includes(token),
    );
}

/** True when the email local-part contains this person's first name. */
function emailHasFirstName(
  name: string | undefined,
  email: string | undefined,
): boolean {
  const tokens = staffNameTokens(name);
  const local = emailLocalPart(email);
  const first = tokens[0];
  return Boolean(first && first.length >= 4 && local.includes(first));
}

function withStaffEmail(member: StaffMember, email: string): StaffMember {
  if (member.email === email) return member;
  const details = member.details
    ? { ...member.details, "Mail Id": email }
    : member.details;
  return { ...member, email, details };
}

/**
 * Ishani's staff dump sometimes rotates emails by one inside a contiguous
 * block (person N has person N-1's address; the first row holds the last).
 * Rotate that block back so names and emails line up.
 */
export function realignStaffEmails(staff: StaffMember[]): StaffMember[] {
  if (staff.length < 2) return staff;

  const next = staff.slice();
  let i = 0;

  while (i < next.length) {
    if (emailHasFirstName(next[i].name, next[i].email)) {
      i += 1;
      continue;
    }

    let end = i;
    while (
      end + 1 < next.length &&
      emailHasFirstName(next[end].name, next[end + 1].email)
    ) {
      end += 1;
    }

    const wraps = emailHasFirstName(next[end].name, next[i].email);
    if (end > i && wraps) {
      const emails = next.slice(i, end + 1).map((member) => member.email || "");
      for (let offset = 0; offset <= end - i; offset += 1) {
        const source = (offset + 1) % emails.length;
        next[i + offset] = withStaffEmail(next[i + offset], emails[source]);
      }
      i = end + 1;
      continue;
    }

    i += 1;
  }

  return next;
}

export async function getFacultySeating(): Promise<FacultySeat[]> {
  const result = await ishaniGet<{ faculty_seating?: FacultySeat[] }>(
    "/faculty-seating",
  );
  if (!result.ok) return [];
  return Array.isArray(result.data.faculty_seating)
    ? result.data.faculty_seating
    : [];
}

export async function getHomeCampusData(): Promise<HomeCampusData> {
  const result = await ishaniGet<{
    staff?: StaffMember[];
    infrastructure?: LabFacility[];
  }>("/home-data");
  if (!result.ok) {
    return { staff: [], infrastructure: [] };
  }
  return {
    staff: realignStaffEmails(
      Array.isArray(result.data.staff) ? result.data.staff : [],
    ),
    infrastructure: Array.isArray(result.data.infrastructure)
      ? result.data.infrastructure
      : [],
  };
}
