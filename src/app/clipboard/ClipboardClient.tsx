"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { FileText, GraduationCap, Hash, Link2, Link2Off, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { authFetch } from "@/lib/authFetch";
import { notify } from "@/lib/toast";
import { getDriveEmbedUrl, getDriveFileId } from "@/lib/fileUtils";
import {
  CLIPBOARD_MAX_CHARS,
  formatShareCode,
  isValidShareCode,
  normalizeShareCode,
  sharePath,
  shareUrls,
} from "@/lib/clipboard";
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PageShell,
  Skeleton,
  Textarea,
} from "@/components/ui";

type ClipboardPayload = {
  text: string;
  updated_at: string | null;
  share_id: string | null;
  share_expires_at: string | null;
  drive_file_id: string | null;
  drive_file_name: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 1000;

function formatSaved(iso: string | null): string {
  if (!iso) return "Not saved yet";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "Not saved yet";
  return new Date(ms).toLocaleString();
}

async function copyText(value: string, ok: string, fail: string) {
  try {
    await navigator.clipboard.writeText(value);
    notify.success(ok);
  } catch {
    notify.error(fail);
  }
}

function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const open = (e: FormEvent) => {
    e.preventDefault();
    const id = normalizeShareCode(code);
    if (!isValidShareCode(id)) {
      notify.error("Enter the 6-character code from the owner.");
      return;
    }
    router.push(sharePath(id));
  };

  return (
    <form
      onSubmit={open}
      className="rounded-xl border border-border bg-card p-3 sm:p-4"
    >
      <p className="text-xs font-semibold text-foreground">Have a code?</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        Open a 24-hour share on this site or the campus host — no account needed.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          inputSize="sm"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ab3k-m2"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Share code"
          className="font-mono sm:max-w-xs"
        />
        <Button type="submit" size="sm" variant="secondary" className="shrink-0">
          Open share
        </Button>
      </div>
    </form>
  );
}

export default function ClipboardClient() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [driveFileName, setDriveFileName] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState("");

  const textRef = useRef(text);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const driveIdRef = useRef<string | null>(null);
  const driveNameRef = useRef<string | null>(null);

  useEffect(() => {
    textRef.current = text;
    dirtyRef.current = dirty;
    driveIdRef.current = driveFileId;
    driveNameRef.current = driveFileName;
  }, [text, dirty, driveFileId, driveFileName]);

  const applyPayload = (data: ClipboardPayload) => {
    setText(data.text ?? "");
    setUpdatedAt(data.updated_at);
    setShareId(data.share_id);
    setShareExpiresAt(data.share_expires_at);
    setDriveFileId(data.drive_file_id ?? null);
    setDriveFileName(data.drive_file_name ?? null);
    setDirty(false);
    dirtyRef.current = false;
    setSaveState(data.updated_at ? "saved" : "idle");
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/clipboard");
      if (!res.ok) throw new Error("load");
      const data = (await res.json()) as ClipboardPayload;
      applyPayload(data);
    } catch {
      setError("Could not load your clipboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setSignedIn(!!user);
      if (!user) {
        setText("");
        setUpdatedAt(null);
        setShareId(null);
        setShareExpiresAt(null);
        setDriveFileId(null);
        setDriveFileName(null);
        setDriveUrl("");
        setError(null);
        setDirty(false);
        dirtyRef.current = false;
        setSaveState("idle");
        setLoading(false);
        return;
      }
      await load();
    });
  }, [load]);

  const save = useCallback(async () => {
    if (!dirtyRef.current || savingRef.current) return;
    const payload = textRef.current;
    savingRef.current = true;
    setSaveState("saving");
    setError(null);
    try {
      const res = await authFetch("/api/clipboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: payload,
          drive_file_id: driveIdRef.current,
          drive_file_name: driveNameRef.current,
        }),
      });
      if (res.status === 400) {
        notify.error("Text is too long.");
        setSaveState("error");
        return;
      }
      if (!res.ok) throw new Error("save");
      const data = (await res.json()) as {
        updated_at: string;
        share_id: string | null;
        share_expires_at: string | null;
      };
      setUpdatedAt(data.updated_at);
      setShareId(data.share_id);
      setShareExpiresAt(data.share_expires_at);
      if (textRef.current !== payload) {
        dirtyRef.current = true;
        setDirty(true);
      } else {
        dirtyRef.current = false;
        setDirty(false);
        setSaveState("saved");
      }
    } catch {
      setSaveState("error");
      setError("Could not save clipboard.");
    } finally {
      savingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!signedIn || !dirty) return;
    const timer = window.setTimeout(() => {
      void save();
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [signedIn, dirty, text, driveFileId, driveFileName, save]);

  useEffect(() => {
    if (!signedIn) return;
    const flush = () => {
      if (dirtyRef.current) void save();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("visibilitychange", onVis);
    return () => window.removeEventListener("visibilitychange", onVis);
  }, [signedIn, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        if (!signedIn || loading) return;
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signedIn, loading, save]);

  const createShare = async () => {
    setSharing(true);
    try {
      if (dirtyRef.current) await save();
      const res = await authFetch("/api/clipboard/share", { method: "POST" });
      if (!res.ok) throw new Error("share");
      const data = (await res.json()) as {
        share_id: string;
        share_expires_at: string;
      };
      setShareId(data.share_id);
      setShareExpiresAt(data.share_expires_at);
      const { canonical } = shareUrls(data.share_id);
      try {
        await navigator.clipboard.writeText(canonical);
        notify.success("Share ready", {
          description: `Code ${formatShareCode(data.share_id)} — link copied.`,
        });
      } catch {
        notify.success("Share ready", {
          description: `Code ${formatShareCode(data.share_id)}`,
        });
      }
    } catch {
      notify.error("Could not create a share.");
    } finally {
      setSharing(false);
    }
  };

  const revokeShare = async () => {
    setSharing(true);
    try {
      const res = await authFetch("/api/clipboard/share", { method: "DELETE" });
      if (!res.ok) throw new Error("revoke");
      setShareId(null);
      setShareExpiresAt(null);
      notify.success("Share revoked");
    } catch {
      notify.error("Could not revoke the share.");
    } finally {
      setSharing(false);
    }
  };

  const showLoading = signedIn === null || (signedIn && loading);
  const links = shareId ? shareUrls(shareId) : null;

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Could not save"
        : dirty
          ? "Unsaved"
          : formatSaved(updatedAt);

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Tools"
        title="Clipboard"
        description="One pad on your account — it saves as you type. Attach a Google Drive PDF as a link (bytes stay on Drive). Hand someone a 24-hour code if they are on a lab PC."
        divider
      />

      <div className="mb-6">
        <JoinCodeForm />
      </div>

      {showLoading && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-11 w-32" />
        </div>
      )}

      {!showLoading && signedIn === false && (
        <EmptyState
          title="Sign in to use your pad"
          description="Your notes stay on your account so you can paste them on another device."
          action={<ButtonLink href="/login?redirectTo=/clipboard">Sign in</ButtonLink>}
        />
      )}

      {error && signedIn && !showLoading && saveState !== "error" && (
        <ErrorState
          className="mb-4"
          title="Clipboard unavailable"
          description={error}
          onRetry={() => {
            void load();
          }}
        />
      )}

      {!showLoading && signedIn && (
        <div className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => {
              const next = e.target.value.slice(0, CLIPBOARD_MAX_CHARS);
              textRef.current = next;
              dirtyRef.current = true;
              setText(next);
              setDirty(true);
            }}
            onBlur={() => {
              if (dirtyRef.current) void save();
            }}
            placeholder="Paste notes, commands, or a snippet…"
            className="min-h-[16rem] font-mono text-[13px] leading-relaxed"
            maxLength={CLIPBOARD_MAX_CHARS}
            spellCheck={false}
            aria-label="Clipboard text"
          />

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold text-foreground">Drive file</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Paste a Google Drive share link. The PDF stays on Drive — this pad
              only stores the file id.
            </p>
            {driveFileId ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={getDriveEmbedUrl(driveFileId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {driveFileName || "Open attached file"}
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDriveFileId(null);
                    setDriveFileName(null);
                    driveIdRef.current = null;
                    driveNameRef.current = null;
                    dirtyRef.current = true;
                    setDirty(true);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  inputSize="sm"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/…"
                  aria-label="Google Drive file URL"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    const id = getDriveFileId(driveUrl.trim());
                    if (!id) {
                      notify.error("That does not look like a Drive file link.");
                      return;
                    }
                    setDriveFileId(id);
                    setDriveFileName("Drive file");
                    driveIdRef.current = id;
                    driveNameRef.current = "Drive file";
                    setDriveUrl("");
                    dirtyRef.current = true;
                    setDirty(true);
                  }}
                >
                  Attach
                </Button>
              </div>
            )}
          </div>

          <p className="text-xs text-muted">
            {text.length.toLocaleString()} / {CLIPBOARD_MAX_CHARS.toLocaleString()}
            {" · "}
            <span className={saveState === "error" ? "text-destructive" : undefined}>
              {saveLabel}
            </span>
          </p>

          {shareId && links ? (
            <div className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Join code
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tracking-wide text-foreground">
                  {formatShareCode(shareId)}
                </p>
                {shareExpiresAt && (
                  <p className="mt-1 text-[11px] text-muted">
                    Live until {formatSaved(shareExpiresAt)}. Typing updates what
                    others see.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void copyText(
                      formatShareCode(shareId),
                      "Code copied",
                      "Could not copy the code.",
                    )
                  }
                  disabled={sharing}
                >
                  <Hash className="w-3.5 h-3.5" />
                  Copy code
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void copyText(
                      links.canonical,
                      "Link copied",
                      "Could not copy the link.",
                    )
                  }
                  disabled={sharing}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Copy link
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void copyText(
                      links.campus,
                      "Campus link copied",
                      "Could not copy the campus link.",
                    )
                  }
                  disabled={sharing}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Campus link
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void revokeShare()}
                  disabled={sharing}
                >
                  <Link2Off className="w-3.5 h-3.5" />
                  Revoke
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void createShare()}
              disabled={sharing}
            >
              Share for 24 hours
            </Button>
          )}
        </div>
      )}
    </PageShell>
  );
}
