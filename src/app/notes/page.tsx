"use client";

import { FormEvent, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { StickyNote } from "lucide-react";
import { utilityFetch } from "@/lib/utilityServer";
import { Button, EmptyState, Input, PageHeader, PageShell } from "@/components/ui";

type NoteRow = { id: string; title: string; path: string; created_at: string };
type NoteDraft = { id: string; title: string; body: string };

export default function NotesPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await utilityFetch("/v1/notes");
    if (!res?.ok) {
      setStatus("Notes stay on this device until the home server is reachable.");
      return;
    }
    const data = (await res.json()) as { notes?: NoteRow[] };
    setNotes(data.notes || []);
    setStatus("");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await utilityFetch("/v1/notes");
      if (cancelled) return;
      if (!res?.ok) {
        setStatus("Notes stay on this device until the home server is reachable.");
        return;
      }
      const data = (await res.json()) as { notes?: NoteRow[] };
      setNotes(data.notes || []);
      setStatus("");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const res = await utilityFetch("/v1/notes", {
      method: "POST",
      body: { title, body },
    });
    setBusy(false);
    if (!res?.ok) {
      setStatus("Could not save the note.");
      return;
    }
    const created = (await res.json()) as { id?: string };
    const savedTitle = title.trim() || "Note";
    const savedBody = body;
    setTitle("");
    setBody("");
    await refresh();
    if (created.id) {
      setDraft({ id: created.id, title: savedTitle, body: savedBody });
      setPreview(true);
    }
  }

  async function openNote(id: string) {
    setStatus("");
    const res = await utilityFetch(`/v1/notes/${encodeURIComponent(id)}`);
    if (!res?.ok) {
      setStatus("Could not open that note.");
      return;
    }
    const data = (await res.json()) as { id: string; title: string; body: string };
    setDraft({ id: data.id, title: data.title, body: data.body || "" });
    setPreview(false);
  }

  async function saveDraft(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    const res = await utilityFetch(`/v1/notes/${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      body: { title: draft.title, body: draft.body },
    });
    setBusy(false);
    if (!res?.ok) {
      setStatus("Could not save the note.");
      return;
    }
    setStatus("Saved.");
    await refresh();
  }

  async function removeDraft() {
    if (!draft) return;
    setBusy(true);
    const res = await utilityFetch(`/v1/notes/${encodeURIComponent(draft.id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res?.ok) {
      setStatus("Could not delete the note.");
      return;
    }
    setDraft(null);
    await refresh();
  }

  return (
    <PageShell>
      <PageHeader
        title="Notes"
        description="Private markdown on the home server. Notes stay in this page."
      />
      <form onSubmit={onCreate} className="flex flex-col gap-3 max-w-xl">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note"
          className="min-h-32 rounded-xl border border-border bg-surface p-3 text-sm"
        />
        <Button type="submit" disabled={busy || !body.trim()}>
          Save note
        </Button>
      </form>
      {status ? <p className="text-sm text-muted mt-4">{status}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {notes.length === 0 ? (
          <EmptyState
            icon={<StickyNote className="w-5 h-5" />}
            title="No notes yet"
            description="Write a note above. It is stored on the home server, not as a downloaded file."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => void openNote(note.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-surface ${
                    draft?.id === note.id ? "bg-surface font-medium" : ""
                  }`}
                >
                  {note.title}
                </button>
              </li>
            ))}
          </ul>
        )}

        {draft ? (
          <form onSubmit={saveDraft} className="flex flex-col gap-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={preview ? "secondary" : "primary"}
                onClick={() => setPreview(false)}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant={preview ? "primary" : "secondary"}
                onClick={() => setPreview(true)}
              >
                Preview
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void removeDraft()}
              >
                Delete
              </Button>
            </div>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Title"
            />
            {preview ? (
              <div className="prose prose-sm max-w-none min-h-40 rounded-xl border border-border bg-surface p-4 text-sm">
                <ReactMarkdown>{draft.body || "_Empty note._"}</ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                className="min-h-64 rounded-xl border border-border bg-surface p-3 text-sm font-mono"
              />
            )}
            <Button type="submit" disabled={busy || !draft.body.trim()}>
              Save changes
            </Button>
          </form>
        ) : null}
      </div>
    </PageShell>
  );
}
