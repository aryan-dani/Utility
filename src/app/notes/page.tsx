"use client";

import { FormEvent, useEffect, useState } from "react";
import { filesOrigins, utilityFetch } from "@/lib/utilityServer";
import { Button, Input, PageHeader, PageShell } from "@/components/ui";

type NoteRow = { id: string; title: string; path: string; created_at: string };

export default function NotesPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [status, setStatus] = useState("");

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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const res = await utilityFetch("/v1/notes", {
      method: "POST",
      body: { title, body },
    });
    if (!res?.ok) {
      setStatus("Could not save the note.");
      return;
    }
    setTitle("");
    setBody("");
    await refresh();
  }

  const origin = filesOrigins()[0] || "";

  return (
    <PageShell>
      <PageHeader title="Notes" description="Private markdown on the home server, served as files." />
      <form onSubmit={onSubmit} className="flex flex-col gap-3 max-w-xl">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note"
          className="min-h-32 rounded-xl border border-border bg-surface p-3 text-sm"
        />
        <Button type="submit">Save note</Button>
      </form>
      {status ? <p className="text-sm text-muted mt-4">{status}</p> : null}
      <ul className="mt-6 flex flex-col gap-2">
        {notes.map((note) => (
          <li key={note.id}>
            <a className="text-sm underline" href={`${origin}${note.path}`}>
              {note.title}
            </a>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
