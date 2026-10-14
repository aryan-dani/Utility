const KEY = "utility.campus.lookup.v1";
const TTL_MS = 24 * 60 * 60 * 1000;

export type CampusLookup = {
  staff: Array<{ name: string; designation: string; group: string }>;
  seats: Array<{ name: string; seat: string; department: string }>;
  labs: Array<{ name: string; room: string; floor: string }>;
  savedAt: number;
};

const EMPTY: CampusLookup = { staff: [], seats: [], labs: [], savedAt: 0 };

function read(): CampusLookup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampusLookup;
    if (!parsed || !Array.isArray(parsed.staff)) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

let inflight: Promise<CampusLookup> | null = null;

/** One campus index fetch per day, then local search. */
export async function loadCampusLookup(): Promise<CampusLookup> {
  const cached = read();
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/campus/lookup");
      if (!res.ok) return EMPTY;
      const data = (await res.json()) as Omit<CampusLookup, "savedAt">;
      const next: CampusLookup = {
        staff: Array.isArray(data.staff) ? data.staff : [],
        seats: Array.isArray(data.seats) ? data.seats : [],
        labs: Array.isArray(data.labs) ? data.labs : [],
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    } catch {
      return EMPTY;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
