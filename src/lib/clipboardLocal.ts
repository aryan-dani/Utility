const CLIPBOARD_LOCAL_KEY = "utility.clipboard.local";

export type LocalClipboardPad = {
  text: string;
  drive_file_id: string | null;
  drive_file_name: string | null;
  updated_at: string;
};

export function readLocalClipboardPad(): LocalClipboardPad | null {
  try {
    const raw = localStorage.getItem(CLIPBOARD_LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalClipboardPad>;
    if (typeof parsed.text !== "string") return null;
    return {
      text: parsed.text,
      drive_file_id:
        typeof parsed.drive_file_id === "string" ? parsed.drive_file_id : null,
      drive_file_name:
        typeof parsed.drive_file_name === "string"
          ? parsed.drive_file_name
          : null,
      updated_at:
        typeof parsed.updated_at === "string"
          ? parsed.updated_at
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeLocalClipboardPad(pad: {
  text: string;
  drive_file_id: string | null;
  drive_file_name: string | null;
}): LocalClipboardPad {
  const next: LocalClipboardPad = {
    text: pad.text,
    drive_file_id: pad.drive_file_id,
    drive_file_name: pad.drive_file_name,
    updated_at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CLIPBOARD_LOCAL_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
  return next;
}
