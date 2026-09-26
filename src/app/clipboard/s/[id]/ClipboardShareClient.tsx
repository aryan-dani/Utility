"use client";

import { useEffect, useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { notify } from "@/lib/toast";
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  Skeleton,
} from "@/components/ui";

export default function ClipboardShareClient({ shareId }: { shareId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/clipboard/share/${encodeURIComponent(shareId)}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 410 || res.status === 404) {
          setGone(true);
          setText(null);
          return;
        }
        if (!res.ok) throw new Error("load");
        const data = (await res.json()) as {
          text: string;
          share_expires_at: string | null;
        };
        setText(data.text ?? "");
        setExpiresAt(data.share_expires_at);
      } catch {
        if (!cancelled) setError("Could not load this share.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const copy = async () => {
    if (text == null) return;
    try {
      await navigator.clipboard.writeText(text);
      notify.success("Copied to device clipboard");
    } catch {
      notify.error("Could not copy.");
    }
  };

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Clipboard"
        title="Shared note"
        description="This code and link expire after 24 hours and are not editable here."
        divider
      />

      {loading && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {!loading && gone && (
        <EmptyState
          title="Link expired or missing"
          description="Ask the owner to create a new 24-hour share."
          action={<ButtonLink href="/clipboard">Open Clipboard</ButtonLink>}
        />
      )}

      {error && !loading && !gone && (
        <ErrorState title="Could not open share" description={error} />
      )}

      {!loading && text != null && !gone && (
        <div className="space-y-4">
          <pre className="whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-4 text-sm leading-relaxed font-mono min-h-[10rem]">
            {text || "(empty)"}
          </pre>
          {expiresAt && (
            <p className="text-xs text-muted">
              Expires {new Date(expiresAt).toLocaleString()}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copy()}>
              <ClipboardCopy className="w-3.5 h-3.5" />
              Copy
            </Button>
            <ButtonLink href="/clipboard" variant="secondary">
              Save to my clipboard
            </ButtonLink>
          </div>
        </div>
      )}
    </PageShell>
  );
}
