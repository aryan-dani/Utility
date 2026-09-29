import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  readLocalClipboardPad,
  writeLocalClipboardPad,
} from "./clipboardLocal";

describe("clipboardLocal", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a pad through localStorage", () => {
    const written = writeLocalClipboardPad({
      text: "lab notes",
      drive_file_id: null,
      drive_file_name: null,
    });
    expect(written.text).toBe("lab notes");
    expect(readLocalClipboardPad()?.text).toBe("lab notes");
  });

  it("returns null when nothing is stored", () => {
    expect(readLocalClipboardPad()).toBe(null);
  });
});
