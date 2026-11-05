"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { utilityFetch } from "@/lib/utilityServer";
import { useAcademicStore } from "@/store/academicStore";
import { useSRSStore } from "@/store/srsStore";
import { notify } from "@/lib/toast";

type PackCard = { question?: string; answer?: string };
type PackQuiz = {
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
};

export function StudyPackPanel() {
  const semester = useAcademicStore((s) => s.semester);
  const decks = useSRSStore((s) => s.decks);
  const createDeck = useSRSStore((s) => s.createDeck);
  const addMultipleCards = useSRSStore((s) => s.addMultipleCards);
  const [cards, setCards] = useState<PackCard[]>([]);
  const [quiz, setQuiz] = useState<PackQuiz[]>([]);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [deckId, setDeckId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await utilityFetch(`/v1/study-pack?semester=${semester}`);
      if (cancelled) return;
        if (!res?.ok) {
        setEmpty(true);
        setLoaded(true);
        return;
      }
      const data = (await res.json()) as {
        pack?: { flashcards?: PackCard[]; quiz?: PackQuiz[] } | null;
        created_at?: string;
      };
      const flashcards = Array.isArray(data.pack?.flashcards) ? data.pack.flashcards : [];
      const questions = Array.isArray(data.pack?.quiz) ? data.pack.quiz : [];
      setCards(flashcards.filter((card) => card.question && card.answer));
      setQuiz(questions.filter((item) => item.question));
      setCreatedAt(data.created_at || null);
      setEmpty(flashcards.length === 0 && questions.length === 0);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [semester]);

  const copyCards = () => {
    const items = cards.map((card) => ({
      question: String(card.question),
      answer: String(card.answer),
    }));
    if (items.length === 0) return;
    const existing = decks.find((deck) => deck.id === deckId);
    const deck = existing ?? createDeck(`Semester ${semester} pack`);
    addMultipleCards(deck.id, items);
    notify.success(`Added ${items.length} cards to ${deck.name}`);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-muted" />
        <h2 className="text-sm font-semibold">Semester {semester} study pack</h2>
      </div>
      {!loaded ? (
        <p className="text-sm text-muted">Loading the nightly pack…</p>
      ) : empty ? (
        <EmptyState
          className="py-8"
          title="No pack for this semester yet"
          description="A fresh pack is generated at 04:45 IST from the notes already in the vault."
        />
      ) : (
        <>
          <p className="text-sm text-muted">
            {cards.length} flashcards
            {quiz.length ? ` and ${quiz.length} quiz questions` : ""}
            {createdAt ? ` · ${new Date(createdAt).toLocaleDateString()}` : ""}
          </p>
          <ul className="space-y-2">
            {cards.slice(0, 5).map((card, index) => (
              <li key={`${card.question}-${index}`} className="text-sm">
                <p className="font-medium">{card.question}</p>
                <p className="text-muted">{card.answer}</p>
              </li>
            ))}
          </ul>
          {quiz.length > 0 ? (
            <ul className="space-y-3">
              {quiz.slice(0, 5).map((item, index) => {
                const options = item.options || [];
                const correct = options[item.correctIndex ?? 0];
                return (
                  <li key={`${item.question}-${index}`} className="text-sm">
                    <p className="font-medium">{item.question}</p>
                    <p className="text-muted">
                      {correct || item.explanation || "See the explanation in review."}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={deckId}
              onChange={(event) => setDeckId(event.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
              aria-label="Deck for pack cards"
            >
              <option value="">New semester deck</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" onClick={copyCards} disabled={cards.length === 0}>
              Copy cards into deck
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
