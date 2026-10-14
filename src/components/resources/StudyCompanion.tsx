"use client";

import { FormEvent, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { notify } from "@/lib/toast";
import { useSRSStore } from "@/store/srsStore";
import { readLocalClipboardPad, writeLocalClipboardPad } from "@/lib/clipboardLocal";
import { useAcademicStore } from "@/store/academicStore";
import { pageFromSectionLabel } from "@/lib/resourceUrl";
import { renderWithCitations } from "@/components/ask/SourceCard";
import type { RetrievalSource } from "@/lib/rag/types";
import type { ResourceItem } from "@/lib/dataFetcher";

type Tab = "ask" | "cards" | "pad";

type Turn = {
  role: "user" | "assistant";
  text: string;
  sources?: RetrievalSource[];
};

function pageOf(source: RetrievalSource): number | null {
  return (
    pageFromSectionLabel(source.section_label) ??
    pageFromSectionLabel(source.heading) ??
    slideNumber(source.section_label) ??
    slideNumber(source.heading)
  );
}

function slideNumber(label: string | undefined): number | null {
  if (!label) return null;
  const match = label.match(/slide\s*(\d+)/i);
  if (!match) return null;
  const page = Number(match[1]);
  return Number.isFinite(page) && page > 0 ? page : null;
}

async function readGroundedReply(res: Response): Promise<Turn> {
  const reader = res.body?.getReader();
  if (!reader) return { role: "assistant", text: "" };
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let sources: RetrievalSource[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          data?: RetrievalSource[];
        };
        if (event.type === "text-delta" && event.delta) text += event.delta;
        if (event.type === "data-sources" && Array.isArray(event.data)) {
          sources = event.data;
        }
      } catch {
        /* partial frame */
      }
    }
  }
  return { role: "assistant", text, sources };
}

export function StudyCompanion({
  resource,
  onJump,
}: {
  resource: ResourceItem;
  onJump?: (page: number) => void;
}) {
  const academicYear = useAcademicStore((s) => s.academicYear);
  const branch = useAcademicStore((s) => s.branch);
  const semester = useAcademicStore((s) => s.semester);
  const [tab, setTab] = useState<Tab>("ask");
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [pad, setPad] = useState("");
  const [padReady, setPadReady] = useState(false);

  const openAsk = async (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim() || `Explain ${resource.title}`;
    if (asking) return;
    setAsking(true);
    setTurns((prev) => [...prev, { role: "user", text }]);
    setPrompt("");
    try {
      const res = await authFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          context: {
            academicYear,
            branch,
            semester,
            subjects: resource.subject_name ? [resource.subject_name] : [],
            resourceId: resource.id,
            answerMode: "quick",
          },
        }),
      });
      if (res.status === 401) {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", text: "Sign in to ask about this file." },
        ]);
        return;
      }
      if (!res.ok) {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", text: "Ask could not answer just now." },
        ]);
        return;
      }
      const reply = await readGroundedReply(res);
      setTurns((prev) => [...prev, reply]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { role: "assistant", text: "Ask could not answer just now." },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const saveCard = (event: FormEvent) => {
    event.preventDefault();
    if (!term.trim() || !definition.trim()) return;
    const store = useSRSStore.getState();
    store.initStore();
    const subject = resource.subject_name || "Vault";
    const existing = store.decks.find((deck) => deck.name === subject);
    const deck = existing || store.createDeck(subject);
    store.addCard(deck.id, term.trim(), definition.trim());
    setTerm("");
    setDefinition("");
    notify.success("Saved to SRS");
  };

  const showPad = () => {
    if (!padReady) {
      setPad(readLocalClipboardPad()?.text || "");
      setPadReady(true);
    }
    setTab("pad");
  };

  return (
    <aside className="hidden lg:flex w-80 shrink-0 flex-col border-l border-border bg-background min-h-0">
      <div className="flex border-b border-border">
        {(
          [
            ["ask", "Ask"],
            ["cards", "Card"],
            ["pad", "Pad"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 h-10 text-xs font-medium ${tab === id ? "text-foreground" : "text-muted"}`}
            onClick={() => (id === "pad" ? showPad() : setTab(id))}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-3 flex-1 min-h-0 overflow-y-auto space-y-3">
        {tab === "ask" && (
          <>
            <div className="space-y-2">
              {turns.map((turn, index) => (
                <div key={`${turn.role}-${index}`} className="text-sm leading-relaxed">
                  {turn.role === "user" ? (
                    <p className="font-medium">{turn.text}</p>
                  ) : (
                    <div>
                      {renderWithCitations(turn.text, (marker) => {
                        const source = turn.sources?.find((item) => item.marker === marker);
                        const page = source ? pageOf(source) : null;
                        if (page) onJump?.(page);
                      }, turn.sources)}
                    </div>
                  )}
                </div>
              ))}
              {asking && <p className="text-xs text-muted">Looking through this file…</p>}
            </div>
            <form onSubmit={openAsk} className="space-y-2">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={resource.title}
                className="w-full min-h-20 rounded-lg border border-border bg-card p-2 text-sm"
              />
              <button
                type="submit"
                disabled={asking}
                className="h-9 px-3 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-40"
              >
                Ask this file
              </button>
            </form>
          </>
        )}
        {tab === "cards" && (
          <form onSubmit={saveCard} className="space-y-2">
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Term"
              className="w-full h-9 px-2 rounded-lg border border-border bg-card text-sm"
            />
            <textarea
              value={definition}
              onChange={(event) => setDefinition(event.target.value)}
              placeholder="Definition"
              className="w-full min-h-24 rounded-lg border border-border bg-card p-2 text-sm"
            />
            <button type="submit" className="h-9 px-3 rounded-lg border border-border text-xs font-medium">
              Save card
            </button>
          </form>
        )}
        {tab === "pad" && (
          <textarea
            value={pad}
            onChange={(event) => {
              setPad(event.target.value);
              writeLocalClipboardPad({
                text: event.target.value,
                drive_file_id: null,
                drive_file_name: null,
              });
            }}
            className="w-full min-h-48 rounded-lg border border-border bg-card p-2 text-sm font-mono"
            aria-label="Scratchpad"
          />
        )}
      </div>
    </aside>
  );
}
