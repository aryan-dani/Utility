"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { homeOrVercelStudy } from "@/lib/homeApi";
import { notify } from "@/lib/toast";
import { useSRSStore } from "@/store/srsStore";
import { useAcademicStore } from "@/store/academicStore";
import { matchVisualizer } from "@/lib/visualizeMatch";
import { workspaceQuery } from "@/lib/workspace";
import type { AcademicYear, Branch, Semester } from "@/lib/academic/scope";
import { Button } from "@/components/ui";

export function SyllabusUnitActions({
  subject,
  unit,
  description,
  academicYear,
  branch,
  semester,
}: {
  subject: string;
  unit: string;
  description: string;
  academicYear: string;
  branch: string;
  semester: number;
}) {
  const setStudyFocus = useAcademicStore((s) => s.setStudyFocus);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const visualizer = matchVisualizer(`${unit} ${description}`);
  const qs = workspaceQuery(
    academicYear as AcademicYear,
    branch as Branch,
    semester as Semester,
  );

  const remember = () => setStudyFocus(subject, unit);

  const saveCards = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const data = await homeOrVercelStudy({
        type: "flashcards",
        topic: `${subject} — ${unit}. ${description}`.slice(0, 500),
        context: { academicYear, branch, semester, subjects: [subject] },
      });
      const flashcards = Array.isArray(data.flashcards)
        ? (data.flashcards as Array<{ question?: string; answer?: string }>)
        : [];
      const cards = flashcards
        .map((card) => ({
          question: (card.question || "").trim(),
          answer: (card.answer || "").trim(),
        }))
        .filter((card) => card.question && card.answer)
        .slice(0, 10);
      if (cards.length === 0) {
        notify.error(
          typeof data.error === "string" ? data.error : "No cards came back.",
        );
        return;
      }
      const store = useSRSStore.getState();
      store.initStore();
      const existing = store.decks.find((deck) => deck.name === subject);
      const deck = existing || store.createDeck(subject);
      store.addMultipleCards(deck.id, cards);
      notify.success(`Saved ${cards.length} cards to ${subject}`);
    } catch {
      notify.error("Could not generate cards.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          remember();
          router.push(
            `/ask?tab=chat&prompt=${encodeURIComponent(`Explain ${subject}, ${unit}. ${description}`)}&${qs}`,
          );
        }}
      >
        Ask
      </Button>
      <Button variant="secondary" size="sm" disabled={saving} onClick={saveCards}>
        {saving ? "Saving…" : "Save SRS"}
      </Button>
      {visualizer && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(`/visualize/${visualizer}`)}
        >
          Visualize
        </Button>
      )}
    </div>
  );
}
