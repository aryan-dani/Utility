"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useAcademicStore } from "@/store/academicStore";
import { useSRSStore } from "@/store/srsStore";
import {
  Search,
  ThumbsUp,
  Layers,
  User,
  BookOpen,
  ArrowRight,
  Check,
  Trash2,
  Clock,
  ExternalLink,
  Megaphone,
  MessagesSquare,
  Bug,
  Pin,
} from "lucide-react";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/toast";
import { Button, Badge, Card, Modal, Segmented, PageHeader, PageShell } from "@/components/ui";
import { authFetch } from "@/lib/authFetch";

const WHATSAPP_COMMUNITY_URL =
  "https://chat.whatsapp.com/IptJTcvj4F848iY2riZ3YZ";

const WHATSAPP_GROUPS = [
  {
    name: "Announcements",
    blurb: "Official updates, feature launches, and the pinned community guide.",
    tip: "Start here",
    Icon: Megaphone,
  },
  {
    name: "General",
    blurb: "Everyday chat with peers. New here? Check Announcements first.",
    tip: "Hang out",
    Icon: MessagesSquare,
  },
  {
    name: "Academic Help",
    blurb: "Syllabus doubts, resources, labs, and exam-season questions.",
    tip: "Ask peers",
    Icon: BookOpen,
  },
  {
    name: "Feedback & Bugs",
    blurb: "Report broken previews, request features, or flag site issues.",
    tip: "Improve Utility",
    Icon: Bug,
  },
] as const;

export interface CommunityFlashcard {
  question: string;
  answer: string;
}

export interface CommunityDeck {
  id: string;
  title: string;
  branch: string;
  semester: number;
  author_name: string;
  author_uid?: string;
  upvotes: number;
  cardCount?: number;
  flashcards: CommunityFlashcard[];
  created_at: string;
}

interface CommunityClientProps {
  initialDecks: CommunityDeck[];
}

export default function CommunityClient({
  initialDecks,
}: CommunityClientProps) {
  const router = useRouter();
  const { searchQuery } = useAcademicStore();
  const { createDeck, addMultipleCards, initStore } = useSRSStore();
  const [decks, setDecks] = useState<CommunityDeck[]>(initialDecks);
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [upvotedDecks, setUpvotedDecks] = useState<Record<string, boolean>>({});
  const [activeDeck, setActiveDeck] = useState<CommunityDeck | null>(null);
  const [currentCardIdx, setCurrentCardIdx] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [copiedDeckId, setCopiedDeckId] = useState<string | null>(null);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"top" | "newest">("top");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    initStore();
  }, [initStore]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserUid(user?.uid ?? null);
    });
    return () => unsubscribe();
  }, []);

  const handleUpvote = async (deckId: string, currentUpvotes: number) => {
    if (upvotedDecks[deckId]) return;

    const user = auth.currentUser;
    if (!user) {
      notify.error("Sign in to upvote decks.");
      return;
    }

    const newUpvotes = currentUpvotes + 1;
    setUpvotedDecks((prev) => ({ ...prev, [deckId]: true }));
    setDecks((prev) =>
      prev.map((d) => (d.id === deckId ? { ...d, upvotes: newUpvotes } : d)),
    );

    try {
      const res = await authFetch(`/api/community-decks/${deckId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "upvote" }),
      });
      if (!res.ok) {
        throw new Error("Failed to upvote");
      }
      const data = await res.json();
      if (typeof data.upvotes === "number") {
        setDecks((prev) =>
          prev.map((d) =>
            d.id === deckId ? { ...d, upvotes: data.upvotes } : d,
          ),
        );
      }
      logActivity("community_deck_upvoted", 1);
    } catch (err) {
      console.warn("Upvote error:", err);
      setUpvotedDecks((prev) => {
        const next = { ...prev };
        delete next[deckId];
        return next;
      });
      setDecks((prev) =>
        prev.map((d) =>
          d.id === deckId ? { ...d, upvotes: currentUpvotes } : d,
        ),
      );
      notify.error("Could not upvote deck.");
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this deck? This action cannot be undone.",
      )
    )
      return;

    setIsDeleting(deckId);
    try {
      await notify.promise(
        (async () => {
          const res = await authFetch(`/api/community-decks/${deckId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to delete");
          }
          setDecks((prev) => prev.filter((d) => d.id !== deckId));
        })(),
        {
          loading: "Deleting deck…",
          success: "Deck deleted",
          error: "Could not delete deck",
          id: "community-delete-deck",
        }
      );
    } catch {
      // notify.promise already surfaced the error
    } finally {
      setIsDeleting(null);
    }
  };

  const ensureDeckCards = async (deck: CommunityDeck): Promise<CommunityDeck> => {
    if (Array.isArray(deck.flashcards) && deck.flashcards.length > 0) {
      return deck;
    }
    const res = await fetch(`/api/community-decks/${deck.id}`);
    if (!res.ok) {
      throw new Error("Failed to load deck cards");
    }
    const data = await res.json();
    const flashcards = Array.isArray(data.flashcards) ? data.flashcards : [];
    const hydrated = {
      ...deck,
      flashcards,
      cardCount: data.cardCount ?? flashcards.length,
    };
    setDecks((prev) =>
      prev.map((d) => (d.id === deck.id ? hydrated : d)),
    );
    return hydrated;
  };

  const handleCopyDeck = async (deck: CommunityDeck) => {
    let full: CommunityDeck;
    try {
      full = await ensureDeckCards(deck);
    } catch {
      notify.error("Could not save deck.");
      return;
    }

    initStore();
    const newDeck = createDeck(full.title || "Community Deck");
    const cards = (Array.isArray(full.flashcards) ? full.flashcards : [])
      .map((card: { question?: string; answer?: string }) => ({
        question: String(card?.question || "").trim(),
        answer: String(card?.answer || "").trim(),
      }))
      .filter((card) => card.question.length > 0);

    if (cards.length === 0) {
      notify.error("This deck has no cards to save.");
      return;
    }

    try {
      await notify.promise(
        Promise.resolve().then(() => {
          addMultipleCards(newDeck.id, cards);
          setCopiedDeckId(deck.id);
          logActivity("community_deck_copied", 1);
        }),
        {
          loading: "Saving deck…",
          success: `Saved “${newDeck.name}” to SRS (${cards.length} cards)`,
          error: "Could not save deck",
          id: "community-save-deck",
        }
      );
      router.push("/srs");
      setTimeout(() => setCopiedDeckId(null), 2000);
    } catch {
      // notify.promise already surfaced the error
    }
  };

  const handleStudyDeck = async (deck: CommunityDeck) => {
    try {
      const full = await ensureDeckCards(deck);
      setActiveDeck(full);
      setCurrentCardIdx(0);
      setShowAnswer(false);
    } catch {
      notify.error("Could not load deck.");
    }
  };

  const filteredDecks = useMemo(() => {
    const result = decks.filter((deck) => {
      const matchBranch =
        selectedBranch === "ALL" || deck.branch === selectedBranch;
      const matchSearch =
        !searchQuery.trim() ||
        deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.author_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchBranch && matchSearch;
    });

    if (sortBy === "top") {
      result.sort((a, b) => b.upvotes - a.upvotes);
    } else {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    return result;
  }, [decks, selectedBranch, searchQuery, sortBy]);

  return (
    <PageShell>
      {/* WhatsApp community */}
      <section className="mb-12 space-y-5">
        <PageHeader
          className="border-b border-border pb-6"
          eyebrow="WhatsApp community"
          title="Utility OS · MIT-WPU"
          description="One community invite unlocks four rooms. Pick what you need: updates, casual chat, academic help, or product feedback."
          actions={
            <Button
              variant="primary"
              size="md"
              className="shrink-0 rounded-xl"
              onClick={() => window.open(WHATSAPP_COMMUNITY_URL, "_blank", "noopener,noreferrer")}
            >
              Join on WhatsApp
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WHATSAPP_GROUPS.map(({ name, blurb, tip, Icon }) => (
            <a
              key={name}
              href={WHATSAPP_COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 text-left transition-colors hover:bg-surface/60 hover:border-border-strong focus-visible:outline-offset-2"
            >
              <div className="w-10 h-10 rounded-xl border border-border bg-surface flex items-center justify-center shrink-0 text-foreground group-hover:border-foreground/30 transition-colors">
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h2 className="text-sm font-bold text-foreground">{name}</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted shrink-0">
                    {tip}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{blurb}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Pin className="w-4 h-4 text-muted shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">
              <span className="font-semibold text-foreground">New members:</span>{" "}
              WhatsApp often hides messages posted before you joined. Open{" "}
              <span className="font-semibold text-foreground">Announcements</span>{" "}
              and read the pinned guide. That&apos;s the standing reference, not
              the dated update posts.
            </p>
          </div>
          <a
            href={WHATSAPP_COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 shrink-0 text-xs font-semibold text-foreground underline underline-offset-4 hover:text-muted transition-colors"
          >
            Open community
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* Decks header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Community Study Decks
          </h2>
          <p className="text-muted text-sm mt-1">
            Browse, upvote, and study flashcard decks shared by peer scholars
            across all engineering branches.
          </p>
        </div>

        {/* Branch Filter Pills */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Segmented
            value={selectedBranch}
            onChange={setSelectedBranch}
            size="sm"
            aria-label="Filter by branch"
            options={["ALL", "AIDS", "CORE", "CSF"].map((b) => ({
              value: b,
              label: b,
            }))}
          />

          <div className="h-6 w-px bg-border hidden sm:block" />

          <Segmented
            value={sortBy}
            onChange={setSortBy}
            size="sm"
            aria-label="Sort decks"
            options={[
              { value: "top", label: <span className="inline-flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5" />Top</span> },
              { value: "newest", label: <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Newest</span> },
            ]}
          />
        </div>
      </div>

      {/* Decks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm">
        {filteredDecks.map((deck) => {
          const cardCount =
            typeof deck.cardCount === "number"
              ? deck.cardCount
              : Array.isArray(deck.flashcards)
                ? deck.flashcards.length
                : 0;
          const isUpvoted = upvotedDecks[deck.id];

          return (
            <div
              key={deck.id}
              className="bg-card p-6 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <Badge uppercase className="font-bold tracking-wider shrink-0">
                    {deck.branch} · Sem {deck.semester}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {currentUserUid &&
                      deck.author_uid === currentUserUid && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDeck(deck.id)}
                          disabled={isDeleting === deck.id}
                          className="tap-target hover:text-destructive hover:bg-destructive/10"
                          title="Delete Deck"
                        >
                          <Trash2
                            className={`w-4 h-4 ${isDeleting === deck.id ? "opacity-50" : ""}`}
                          />
                        </Button>
                      )}
                    <button
                      onClick={() => handleUpvote(deck.id, deck.upvotes)}
                      disabled={isUpvoted}
                      className={`inline-flex items-center gap-1.5 px-3 min-h-11 rounded-xl text-xs font-bold transition-all ${
                        isUpvoted
                          ? "bg-primary/10 border border-primary/30 text-primary"
                          : "bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover group-hover:border-border-strong"
                      }`}
                    >
                      <ThumbsUp
                        className={`w-3.5 h-3.5 ${isUpvoted ? "fill-current" : ""}`}
                      />
                      {deck.upvotes}
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                  {deck.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-muted mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[120px]">
                      {deck.author_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{cardCount} Cards</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-border">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleStudyDeck(deck)}
                  className="rounded-xl shadow-xs"
                >
                  <BookOpen className="w-4 h-4" />
                  Study Deck
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopyDeck(deck)}
                  className="rounded-xl"
                >
                  {copiedDeckId === deck.id ? (
                    <>
                      <Check className="w-4 h-4 text-foreground" />
                      Copied!
                    </>
                  ) : (
                    "Save Deck"
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty States */}
      {filteredDecks.length === 0 && (
        <Card
          padding="lg"
          className="flex flex-col items-center justify-center p-16 text-center border-dashed bg-surface my-12"
        >
          <Search className="w-10 h-10 text-muted/30 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">
            No community decks found
          </p>
          <p className="text-sm text-muted mb-6">
            {searchQuery
              ? `No matches for "${searchQuery}"`
              : "Be the first scholar to publish a deck!"}
          </p>
          <Button variant="primary" size="sm" className="rounded-xl" onClick={() => { window.location.href = "/ask"; }}>
            Generate & Publish a Deck
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Card>
      )}

      <Modal
        open={!!activeDeck}
        onClose={() => setActiveDeck(null)}
        size="lg"
        title={
          activeDeck ? (
            <div>
              <Badge variant="outline" className="font-bold uppercase tracking-wider text-primary mb-1">
                Interactive Study Room
              </Badge>
              <div className="text-lg font-bold text-foreground">{activeDeck.title}</div>
            </div>
          ) : undefined
        }
        className="min-h-[400px]"
      >
        {activeDeck && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center -mt-2">
              {activeDeck.flashcards &&
              activeDeck.flashcards[currentCardIdx] ? (
                <Card
                  padding="lg"
                  hover
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="w-full max-w-lg min-h-[220px] cursor-pointer shadow-sm select-none group relative hover:-translate-y-0.5 flex flex-col items-center justify-center"
                >
                  <Badge className="absolute top-4 right-4 font-mono uppercase">
                    {showAnswer ? "Answer" : "Question"}
                  </Badge>
                  <p className="text-sm sm:text-base font-semibold text-foreground leading-relaxed px-4">
                    {showAnswer
                      ? activeDeck.flashcards[currentCardIdx].answer
                      : activeDeck.flashcards[currentCardIdx].question}
                  </p>
                  <span className="text-xs text-muted mt-6 italic group-hover:text-foreground transition-colors">
                    Click card to flip
                  </span>
                </Card>
              ) : (
                <p className="text-sm text-muted">Invalid flashcard format.</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-6 mt-auto">
              <span className="text-xs font-bold text-muted">
                Card {currentCardIdx + 1} of{" "}
                {activeDeck.flashcards?.length || 0}
              </span>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCurrentCardIdx((prev) => Math.max(0, prev - 1));
                    setShowAnswer(false);
                  }}
                  disabled={currentCardIdx === 0}
                  className="rounded-xl"
                >
                  Previous
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setCurrentCardIdx((prev) =>
                      Math.min(
                        (activeDeck.flashcards?.length || 1) - 1,
                        prev + 1,
                      ),
                    );
                    setShowAnswer(false);
                  }}
                  disabled={
                    currentCardIdx === (activeDeck.flashcards?.length || 1) - 1
                  }
                  className="rounded-xl"
                >
                  Next Card
                </Button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </PageShell>
  );
}
