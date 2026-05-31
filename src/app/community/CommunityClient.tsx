'use client';

import { useState, useMemo, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { useAcademicStore } from '@/store/academicStore';
import { Search, ThumbsUp, Layers, User, Calendar, BookOpen, X, ArrowRight, Check, Trash2, Flame, Clock } from 'lucide-react';
import { logActivity } from '@/components/ActivityHeatmap';
import { toast } from 'sonner';

interface CommunityDeck {
  id: string;
  title: string;
  branch: string;
  semester: number;
  author_name: string;
  upvotes: number;
  flashcards: any[];
  created_at: string;
}

interface CommunityClientProps {
  initialDecks: CommunityDeck[];
}

export default function CommunityClient({ initialDecks }: CommunityClientProps) {
  const { searchQuery } = useAcademicStore();
  const [decks, setDecks] = useState<CommunityDeck[]>(initialDecks);
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [upvotedDecks, setUpvotedDecks] = useState<Record<string, boolean>>({});
  const [activeDeck, setActiveDeck] = useState<CommunityDeck | null>(null);
  const [currentCardIdx, setCurrentCardIdx] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [copiedDeckId, setCopiedDeckId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'top' | 'newest'>('top');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setCurrentUserEmail(user.email);
      } else {
        setCurrentUserEmail(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUpvote = async (deckId: string, currentUpvotes: number) => {
    if (upvotedDecks[deckId]) return;

    const newUpvotes = currentUpvotes + 1;
    setUpvotedDecks((prev) => ({ ...prev, [deckId]: true }));
    setDecks((prev) => prev.map((d) => (d.id === deckId ? { ...d, upvotes: newUpvotes } : d)));

    try {
      const docRef = doc(db, 'community_decks', deckId);
      await updateDoc(docRef, { upvotes: increment(1) });
      logActivity('community_deck_upvoted', 1);
    } catch (err) {
      console.warn('Upvote error:', err);
      toast.error('Failed to upvote deck.');
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!window.confirm('Are you sure you want to delete this deck? This action cannot be undone.')) return;
    
    setIsDeleting(deckId);
    try {
      const res = await fetch(`/api/community-decks/${deckId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      toast.success('Deck deleted successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to delete deck');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCopyDeck = (deck: CommunityDeck) => {
    try {
      // Store into local custom decks or trigger study hub
      localStorage.setItem(`custom_deck_${deck.id}`, JSON.stringify(deck));
      setCopiedDeckId(deck.id);
      logActivity('community_deck_copied', 1);
      toast.success('Deck saved to your local storage!');
      setTimeout(() => setCopiedDeckId(null), 2000);
    } catch (err) {
      toast.error('Failed to save deck.');
    }
  };

  const filteredDecks = useMemo(() => {
    let result = decks.filter((deck) => {
      const matchBranch = selectedBranch === 'ALL' || deck.branch === selectedBranch;
      const matchSearch =
        !searchQuery.trim() ||
        deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.author_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchBranch && matchSearch;
    });

    if (sortBy === 'top') {
      result.sort((a, b) => b.upvotes - a.upvotes);
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [decks, selectedBranch, searchQuery, sortBy]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 min-h-[80vh]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Community Study Decks</h1>
          <p className="text-muted text-sm mt-1">
            Browse, upvote, and study flashcard decks shared by peer scholars across all engineering branches.
          </p>
        </div>

        {/* Branch Filter Pills */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'AIDS', 'CORE', 'CSF'].map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBranch(b)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedBranch === b
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          
          <div className="h-6 w-px bg-border hidden sm:block"></div>
          
          <div className="flex bg-surface border border-border rounded-xl p-0.5">
            <button
              onClick={() => setSortBy('top')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sortBy === 'top' ? 'bg-background shadow-sm text-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${sortBy === 'top' ? 'text-primary' : ''}`} />
              Top
            </button>
            <button
              onClick={() => setSortBy('newest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sortBy === 'newest' ? 'bg-background shadow-sm text-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Newest
            </button>
          </div>
        </div>
      </div>

      {/* Decks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDecks.map((deck) => {
          const cardCount = Array.isArray(deck.flashcards) ? deck.flashcards.length : 0;
          const isUpvoted = upvotedDecks[deck.id];

          return (
            <div
              key={deck.id}
              className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between shadow-card hover:border-muted transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-surface border border-border text-foreground shrink-0">
                    {deck.branch} · Sem {deck.semester}
                  </span>
                  <div className="flex items-center gap-2">
                    {currentUserEmail && currentUserEmail.split('@')[0] === deck.author_name && (
                      <button
                        onClick={() => handleDeleteDeck(deck.id)}
                        disabled={isDeleting === deck.id}
                        className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete Deck"
                      >
                        <Trash2 className={`w-4 h-4 ${isDeleting === deck.id ? 'opacity-50' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={() => handleUpvote(deck.id, deck.upvotes)}
                      disabled={isUpvoted}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isUpvoted
                          ? 'bg-primary/10 border border-primary/30 text-primary'
                          : 'bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover group-hover:border-border-strong'
                      }`}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${isUpvoted ? 'fill-current' : ''}`} />
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
                    <span className="truncate max-w-[120px]">{deck.author_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{cardCount} Cards</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setActiveDeck(deck);
                    setCurrentCardIdx(0);
                    setShowAnswer(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs"
                >
                  <BookOpen className="w-4 h-4" />
                  Study Deck
                </button>
                <button
                  onClick={() => handleCopyDeck(deck)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-foreground text-xs font-semibold hover:bg-surface-hover transition-all"
                >
                  {copiedDeckId === deck.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    'Save Deck'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty States */}
      {filteredDecks.length === 0 && (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-2xl bg-surface my-12">
          <Search className="w-10 h-10 text-muted/30 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No community decks found</p>
          <p className="text-sm text-muted mb-6">
            {searchQuery ? `No matches for "${searchQuery}"` : 'Be the first scholar to publish a deck!'}
          </p>
          <a
            href="/ask"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Generate & Publish a Deck
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Modal Flashcard Viewer */}
      {activeDeck && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl relative flex flex-col min-h-[400px]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Interactive Study Room
                </span>
                <h2 className="text-lg font-bold text-foreground mt-0.5">{activeDeck.title}</h2>
              </div>
              <button
                onClick={() => setActiveDeck(null)}
                className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Flashcard Display Area */}
            <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center">
              {activeDeck.flashcards && activeDeck.flashcards[currentCardIdx] ? (
                <div
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="w-full max-w-lg min-h-[220px] p-8 rounded-2xl border border-border-strong bg-surface hover:border-primary/50 transition-all flex flex-col items-center justify-center cursor-pointer shadow-card select-none group relative"
                >
                  <span className="absolute top-4 right-4 text-[10px] font-mono text-muted uppercase bg-card border border-border px-2 py-1 rounded-md">
                    {showAnswer ? 'Answer' : 'Question'}
                  </span>
                  <p className="text-sm sm:text-base font-semibold text-foreground leading-relaxed px-4">
                    {showAnswer
                      ? activeDeck.flashcards[currentCardIdx].answer
                      : activeDeck.flashcards[currentCardIdx].question}
                  </p>
                  <span className="text-xs text-muted mt-6 italic group-hover:text-foreground transition-colors">
                    Click card to flip
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted">Invalid flashcard format.</p>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between border-t border-border pt-6 mt-auto">
              <span className="text-xs font-bold text-muted">
                Card {currentCardIdx + 1} of {activeDeck.flashcards?.length || 0}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setCurrentCardIdx((prev) => Math.max(0, prev - 1));
                    setShowAnswer(false);
                  }}
                  disabled={currentCardIdx === 0}
                  className="px-4 py-2 rounded-xl bg-surface border border-border text-foreground text-xs font-semibold hover:bg-surface-hover disabled:opacity-40 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    setCurrentCardIdx((prev) => Math.min((activeDeck.flashcards?.length || 1) - 1, prev + 1));
                    setShowAnswer(false);
                  }}
                  disabled={currentCardIdx === (activeDeck.flashcards?.length || 1) - 1}
                  className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  Next Card
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
