"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ClipboardCopy, Link2, Link2Off } from "lucide-react";
import { auth } from "@/lib/firebase";
import { authFetch } from "@/lib/authFetch";
import { notify } from "@/lib/toast";
import { CLIPBOARD_MAX_CHARS } from "@/lib/clipboard";
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
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
};

function shareUrl(id: string): string {
  if (typeof window === "undefined") return `/clipboard/s/${id}`;
  return `${window.location.origin}/clipboard/s/${id}`;
}

function formatSaved(iso: string | null): string {
  if (!iso) return "Not saved yet";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "Not saved yet";
  return new Date(ms).toLocaleString();
}

export default function ClipboardClient() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const applyPayload = (data: ClipboardPayload) => {
    setText(data.text ?? "");
    setUpdatedAt(data.updated_at);
    setShareId(data.share_id);
    setShareExpiresAt(data.share_expires_at);
    setDirty(false);
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
        setError(null);
        setLoading(false);
        return;
      }
      await load();
    });
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/api/clipboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 400) {
        notify.error("Text is too long.");
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
      setDirty(false);
      notify.success("Clipboard saved");
    } catch {
      setError("Could not save clipboard.");
    } finally {
      setSaving(false);
    }
  }, [text]);

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
      const res = await authFetch("/api/clipboard/share", { method: "POST" });
      if (!res.ok) throw new Error("share");
      const data = (await res.json()) as {
        share_id: string;
        share_expires_at: string;
      };
      setShareId(data.share_id);
      setShareExpiresAt(data.share_expires_at);
      const url = shareUrl(data.share_id);
      try {
        await navigator.clipboard.writeText(url);
        notify.success("Share link copied", {
          description: "Anyone with the link can read this for 24 hours.",
        });
      } catch {
        notify.success("Share link ready", { description: url });
      }
    } catch {
      notify.error("Could not create a share link.");
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
      notify.success("Share link revoked");
    } catch {
      notify.error("Could not revoke the share link.");
    } finally {
      setSharing(false);
    }
  };

  const copyShare = async () => {
    if (!shareId) return;
    try {
      await navigator.clipboard.writeText(shareUrl(shareId));
      notify.success("Share link copied");
    } catch {
      notify.error("Could not copy the link.");
    }
  };

  const showLoading = signedIn === null || (signedIn && loading);

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Tools"
        title="Clipboard"
        description="One synced pad on your account. Optional 24-hour link if you need to hand text to a lab PC."
        divider
      />

      {showLoading && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-11 w-32" />
        </div>
      )}

      {!showLoading && signedIn === false && (
        <EmptyState
          title="Sign in to use Clipboard"
          description="Your notes stay on your account so you can paste them on another device."
          action={<ButtonLink href="/login?redirectTo=/clipboard">Sign in</ButtonLink>}
        />
      )}

      {error && signedIn && !showLoading && (
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
              setText(e.target.value.slice(0, CLIPBOARD_MAX_CHARS));
              setDirty(true);
            }}
            placeholder="Paste notes, commands, or a snippet…"
            className="min-h-[16rem] font-mono text-[13px] leading-relaxed"
            maxLength={CLIPBOARD_MAX_CHARS}
            spellCheck={false}
            aria-label="Clipboard text"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <p>
              {text.length.toLocaleString()} / {CLIPBOARD_MAX_CHARS.toLocaleString()}{" "}
              · {dirty ? "Unsaved" : formatSaved(updatedAt)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              {shareId ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void copyShare()}
                    disabled={sharing}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Copy link
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
                </>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void createShare()}
                  disabled={sharing}
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  Share 24h
                </Button>
              )}
            </div>
          </div>

          {shareId && shareExpiresAt && (
            <p className="text-xs text-muted">
              Live until {formatSaved(shareExpiresAt)}. Saving updates what the
              link shows.
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
