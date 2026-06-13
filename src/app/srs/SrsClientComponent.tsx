'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSRSStore, Flashcard, Deck } from '@/store/srsStore';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  ArrowLeft, 
  RotateCcw, 
  Sparkles, 
  Info,
  Calendar,
  Layers,
  ChevronRight,
  PlusCircle,
  HelpCircle,
  FolderOpen,
  Trophy,
  Award,
  Star,
  Volume2,
  Download,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export default function SrsClient() {
  const { 
    decks, 
    cards, 
    initialized, 
    initStore, 
    createDeck, 
    deleteDeck, 
    addCard, 
    deleteCard, 
    gradeCard,
    toggleStarCard,
    addMultipleCards
  } = useSRSStore();

  const [view, setView] = useState<'dashboard' | 'review' | 'manage' | 'session-complete'>('dashboard');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  
  // Modals / Input states
  const [showCreateDeckModal, setShowCreateDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  
  const [newCardQ, setNewCardQ] = useState('');
  const [newCardA, setNewCardA] = useState('');

  // Active Review State
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<{ gotIt: number; forgot: number } | null>(null);
  const [forgottenCards, setForgottenCards] = useState<Flashcard[]>([]);
  const [isStarredOnlyReview, setIsStarredOnlyReview] = useState(false);
  const srsFileInputRef = useRef<HTMLInputElement>(null);

  // Auth Status
  const [user, setUser] = useState<{ email?: string } | null>(null);

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const exportDeck = (deck: Deck) => {
    const deckCards = cards.filter(c => c.deckId === deck.id);
    const payload = {
      version: 'utility-srs-v1',
      deckName: deck.name,
      cards: deckCards.map(c => ({ question: c.question, answer: c.answer }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deck-${deck.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Deck exported successfully');
  };

  const handleImportDeck = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.deckName && Array.isArray(data.cards)) {
          const newD = createDeck(data.deckName);
          addMultipleCards(newD.id, data.cards);
          toast.success(`Imported deck "${data.deckName}" with ${data.cards.length} cards`);
        } else {
          toast.error('Invalid deck format. File must contain deckName and cards array.');
        }
      } catch {
        toast.error('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    initStore();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({ email: firebaseUser.email || undefined });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, [initStore]);

  const activeDeck = useMemo(() => decks.find(d => d.id === selectedDeckId), [decks, selectedDeckId]);

  const deckStats = useMemo(() => {
    const today = getTodayString();
    return decks.map(deck => {
      const deckCards = cards.filter(c => c.deckId === deck.id);
      const dueCards = deckCards.filter(c => c.nextReviewDate <= today);
      const mastered = deckCards.filter(c => c.box >= 4).length;
      const masteryPct = deckCards.length > 0 ? Math.round((mastered / deckCards.length) * 100) : 0;
      
      return {
        id: deck.id,
        total: deckCards.length,
        due: dueCards.length,
        mastery: masteryPct
      };
    });
  }, [decks, cards]);

  const selectedDeckStats = useMemo(() => {
    return deckStats.find(s => s.id === selectedDeckId);
  }, [deckStats, selectedDeckId]);

  // Start Review Session
  const startReview = (deckId: string, starredOnly = false) => {
    const today = getTodayString();
    const activeCards = cards.filter(c => c.deckId === deckId);
    const queue = starredOnly 
      ? activeCards.filter(c => c.starred) 
      : activeCards.filter(c => c.nextReviewDate <= today);
      
    if (queue.length === 0) {
      if (starredOnly) toast.error("No starred cards in this deck.");
      return;
    }
    
    setIsStarredOnlyReview(starredOnly);
    // Shuffle queue
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    setReviewQueue(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewSummary({ gotIt: 0, forgot: 0 });
    setForgottenCards([]);
    setSelectedDeckId(deckId);
    setView('review');
  };

  // Grade Current Card
  const handleGrade = (gotIt: boolean) => {
    if (reviewQueue.length === 0) return;
    const currentCard = reviewQueue[currentIndex];
    
    // Update store
    gradeCard(currentCard.id, gotIt);

    // Track forgotten cards
    if (!gotIt) {
      setForgottenCards(prev => {
        if (prev.some(c => c.id === currentCard.id)) return prev;
        return [...prev, currentCard];
      });
    }

    // Update session summary
    setReviewSummary(prev => {
      if (!prev) return null;
      return {
        gotIt: prev.gotIt + (gotIt ? 1 : 0),
        forgot: prev.forgot + (gotIt ? 0 : 1),
      };
    });

    // Move to next card
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex + 1 < reviewQueue.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Complete review and show session complete view
        setView('session-complete');
      }
    }, 150);
  };

  const startForgottenReview = () => {
    if (forgottenCards.length === 0) return;
    const shuffled = [...forgottenCards].sort(() => Math.random() - 0.5);
    setReviewQueue(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewSummary({ gotIt: 0, forgot: 0 });
    setForgottenCards([]);
    setView('review');
  };

  const restartFullSession = () => {
    if (!selectedDeckId) return;
    startReview(selectedDeckId, isStarredOnlyReview);
  };

  const backToDashboard = () => {
    setView('dashboard');
    setReviewSummary(null);
  };

  // Keyboard Shortcuts for Review Mode
  useEffect(() => {
    if (view !== 'review' || reviewQueue.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === '1') {
        e.preventDefault();
        handleGrade(false);
      } else if (e.key === '2') {
        e.preventDefault();
        handleGrade(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setView('dashboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, currentIndex, reviewQueue, isFlipped]);

  const handleCreateDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    createDeck(newDeckName.trim());
    setNewDeckName('');
    setShowCreateDeckModal(false);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeckId || !newCardQ.trim() || !newCardA.trim()) return;
    addCard(selectedDeckId, newCardQ.trim(), newCardA.trim());
    setNewCardQ('');
    setNewCardA('');
  };

  if (!initialized) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
      
      {/* ── 1. DASHBOARD VIEW ─────────────────────────────────────────────── */}
      {view === 'dashboard' && (
        <div className="space-y-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Flashcards (SRS)</h1>
              <p className="text-xs text-muted mt-1">
                Active Leitner spacing system. Review due terms to lock them in long-term memory.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Import button */}
              <button
                onClick={() => srsFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border bg-surface hover:bg-surface-hover rounded-xl px-4 py-2.5 transition-all text-foreground"
                title="Import Deck from JSON"
              >
                <Upload className="w-4 h-4" />
                Import Deck
              </button>
              <input
                ref={srsFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportDeck}
              />
              
              <button
                onClick={() => setShowCreateDeckModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-background bg-foreground hover:bg-foreground/90 rounded-xl px-4 py-2.5 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create Deck
              </button>
            </div>
          </div>

          {/* Review Finished Notification Banner */}
          {reviewSummary && (reviewSummary.gotIt > 0 || reviewSummary.forgot > 0) && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface border border-border rounded-2xl p-4 flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 text-primary border border-primary/20 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Review Completed!</h4>
                  <p className="text-[10px] text-muted font-medium mt-0.5">
                    You reviewed {reviewSummary.gotIt + reviewSummary.forgot} cards: {reviewSummary.gotIt} got it, {reviewSummary.forgot} forgot.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setReviewSummary(null)} 
                className="text-xs text-muted hover:text-foreground font-semibold px-2 py-1 rounded-lg"
              >
                Dismiss
              </button>
            </motion.div>
          )}

          {/* Empty State */}
          {decks.length === 0 && (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card">
              <FolderOpen className="w-10 h-10 text-muted/50 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-foreground">No card decks yet</h3>
              <p className="text-xs text-muted mt-1 max-w-[280px] mx-auto leading-relaxed">
                Create a deck to start organizing your definitions, formulas, or general syllabus concepts.
              </p>
              <button
                onClick={() => setShowCreateDeckModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold border border-border bg-surface hover:bg-surface-hover rounded-xl px-3.5 py-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Get Started
              </button>
            </div>
          )}

          {/* Decks Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map(deck => {
              const stat = deckStats.find(s => s.id === deck.id);
              const due = stat?.due || 0;
              const total = stat?.total || 0;
              const mastery = stat?.mastery || 0;

              return (
                <div key={deck.id} className="group flex flex-col justify-between bg-card border-2 border-foreground p-5 transition-all shadow-[3px_3px_0px_0px_rgb(var(--foreground))] relative overflow-hidden">
                  
                  {/* Mastery Progress Bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-surface">
                    <div 
                      className="h-full bg-foreground transition-all duration-500" 
                      style={{ width: `${mastery}%` }}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-surface rounded-xl border border-border/80 text-muted group-hover:text-primary transition-colors">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => exportDeck(deck)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-foreground rounded-lg transition-all"
                          title="Export Deck to JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete deck "${deck.name}"? All cards will be deleted permanently.`)) {
                              deleteDeck(deck.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-red-500 rounded-lg transition-all"
                          title="Delete Deck"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-foreground truncate">{deck.name}</h3>
                    
                    <div className="flex items-center gap-4 mt-4 text-[10px] font-bold text-muted uppercase select-none">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        {total} {total === 1 ? 'Card' : 'Cards'}
                      </span>
                      <span>•</span>
                      <span className={`flex items-center gap-1 ${due > 0 ? 'text-primary-hover font-extrabold' : ''}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        {due} Due
                      </span>
                    </div>

                    {/* Leitner Box visual distribution spectrum chart */}
                    {total > 0 && (() => {
                      const dist = [0, 0, 0, 0, 0];
                      const deckCards = cards.filter(c => c.deckId === deck.id);
                      deckCards.forEach(c => {
                        const b = Math.max(1, Math.min(c.box, 5));
                        dist[b - 1]++;
                      });
                      const colors = [
                        'bg-foreground/20',
                        'bg-foreground/40',
                        'bg-foreground/60',
                        'bg-foreground/80',
                        'bg-foreground'
                      ];
                      return (
                        <div className="mt-4 space-y-1">
                          <div className="flex justify-between items-center text-[9px] text-muted font-bold uppercase select-none">
                            <span>Leitner Boxes (1-5)</span>
                            <span>{deckCards.filter(c => c.starred).length} ⭐</span>
                          </div>
                          <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-surface border border-border">
                            {dist.map((count, idx) => {
                              if (count === 0) return null;
                              return (
                                <div
                                  key={idx}
                                  style={{ width: `${(count / total) * 100}%` }}
                                  className={`${colors[idx]} transition-all duration-300`}
                                  title={`Box ${idx + 1}: ${count} card(s)`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col gap-2 mt-5 pt-3 border-t border-border/60">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startReview(deck.id)}
                        disabled={due === 0}
                        className={`flex-1 text-center font-bold text-xs rounded-xl py-2.5 transition-all ${
                          due > 0 
                            ? 'bg-foreground text-background hover:bg-foreground/90 shadow-sm'
                            : 'bg-surface text-muted cursor-not-allowed border border-border/60'
                        }`}
                      >
                        {due > 0 ? `Review (${due})` : 'All Reviewed'}
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedDeckId(deck.id);
                          setView('manage');
                        }}
                        className="px-3 py-2.5 font-bold text-xs border border-border text-muted hover:text-foreground hover:bg-surface rounded-xl transition-all"
                        title="Manage Deck"
                      >
                        Edit
                      </button>
                    </div>

                    {cards.filter(c => c.deckId === deck.id && c.starred).length > 0 && (
                      <button
                        onClick={() => startReview(deck.id, true)}
                        className="w-full text-center font-bold text-[10px] text-foreground bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 rounded-lg py-1.5 transition-all flex items-center justify-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5 fill-foreground text-foreground" />
                        Review Starred ({cards.filter(c => c.deckId === deck.id && c.starred).length})
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. REVIEW SESSION VIEW ────────────────────────────────────────── */}
      {view === 'review' && reviewQueue.length > 0 && (
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[75vh]">
          
          {/* Header Controls */}
          <div className="w-full flex justify-between items-center mb-8 pb-4 border-b border-border">
            <button
              onClick={() => setView('dashboard')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Quit Session
            </button>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              Card {currentIndex + 1} of {reviewQueue.length}
            </span>
          </div>

          {/* Session Progress Bar */}
          <div className="w-full h-1 bg-surface rounded-full overflow-hidden mb-12">
            <div 
              className="h-full bg-foreground transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / reviewQueue.length) * 100}%` }}
            />
          </div>

          {/* 3D Flip Flashcard */}
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full h-80 cursor-pointer [perspective:1000px] mb-12 group select-none"
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="relative w-full h-full [transform-style:preserve-3d] transition-shadow duration-300"
            >
              
              {/* Front Side (Question) */}
              <div className="absolute inset-0 w-full h-full bg-card border-2 border-foreground p-8 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgb(var(--foreground))] [backface-visibility:hidden] group-hover:shadow-[6px_6px_0px_0px_rgb(var(--foreground))]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" /> Question
                  </span>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => speakText(reviewQueue[currentIndex].question)}
                      className="p-1.5 text-muted hover:text-foreground rounded-lg bg-surface/50 border border-border hover:bg-surface transition-all"
                      title="Speak Question"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        toggleStarCard(reviewQueue[currentIndex].id);
                        // Also update item in reviewQueue so star state updates in active review state
                        const updated = [...reviewQueue];
                        updated[currentIndex].starred = !updated[currentIndex].starred;
                        setReviewQueue(updated);
                      }}
                      className="p-1.5 text-muted hover:text-foreground rounded-lg bg-surface/50 border border-border hover:bg-surface transition-all"
                      title="Star Card"
                    >
                      <Star className={`w-3.5 h-3.5 ${reviewQueue[currentIndex].starred ? 'fill-foreground text-foreground' : ''}`} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center text-center">
                  <p className="text-lg font-bold text-foreground leading-relaxed max-w-md">
                    {reviewQueue[currentIndex].question}
                  </p>
                </div>
                
                <span className="text-[10px] text-muted text-center font-semibold">
                  Click card or press Space to reveal answer
                </span>
              </div>

              {/* Back Side (Answer) */}
              <div className="absolute inset-0 w-full h-full bg-card border-2 border-foreground p-8 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgb(var(--foreground))] [backface-visibility:hidden] [transform:rotateY(180deg)] group-hover:shadow-[6px_6px_0px_0px_rgb(var(--foreground))]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Answer
                  </span>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => speakText(reviewQueue[currentIndex].answer)}
                      className="p-1.5 text-muted hover:text-foreground rounded-lg bg-surface/50 border border-border hover:bg-surface transition-all"
                      title="Speak Answer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        toggleStarCard(reviewQueue[currentIndex].id);
                        const updated = [...reviewQueue];
                        updated[currentIndex].starred = !updated[currentIndex].starred;
                        setReviewQueue(updated);
                      }}
                      className="p-1.5 text-muted hover:text-foreground rounded-lg bg-surface/50 border border-border hover:bg-surface transition-all"
                      title="Star Card"
                    >
                      <Star className={`w-3.5 h-3.5 ${reviewQueue[currentIndex].starred ? 'fill-foreground text-foreground' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center text-center">
                  <p className="text-base font-semibold text-foreground/90 leading-relaxed max-w-md whitespace-pre-wrap">
                    {reviewQueue[currentIndex].answer}
                  </p>
                </div>

                <span className="text-[10px] text-muted text-center font-semibold">
                  Leitner Box {reviewQueue[currentIndex].box}
                </span>
              </div>

            </motion.div>
          </div>

          {/* Actions & Choices */}
          <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={() => handleGrade(false)}
              className="w-full sm:w-44 flex items-center justify-center gap-2 border-2 border-foreground bg-card hover:bg-foreground/5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0px_0px_rgb(var(--foreground))] text-foreground py-3 text-xs font-bold transition-all"
            >
              <X className="w-4 h-4" />
              <span>Forgot (Key 1)</span>
            </button>
            
            <button
              onClick={() => handleGrade(true)}
              className="w-full sm:w-44 flex items-center justify-center gap-2 border-2 border-foreground bg-card hover:bg-foreground/10 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[3px_3px_0px_0px_rgb(var(--foreground))] text-foreground py-3 text-xs font-bold transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Got it (Key 2)</span>
            </button>
          </div>

          <div className="mt-8 text-center text-muted/60 text-[10px] font-semibold hidden md:block">
            Tip: Press Space/Enter to flip, 1 to flag forgot, 2 to flag easy.
          </div>
        </div>
      )}

      {/* ── 3. MANAGE/EDIT DECK VIEW ─────────────────────────────────────── */}
      {view === 'manage' && activeDeck && (
        <div className="space-y-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('dashboard')}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-surface text-muted hover:text-foreground transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">{activeDeck.name}</h1>
                <p className="text-xs text-muted mt-0.5">
                  Deck details: {selectedDeckStats?.total || 0} cards total, {selectedDeckStats?.due || 0} due for review today.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Create Card Form */}
            <div className="lg:col-span-1">
              <div className="bg-card border-2 border-foreground p-5 space-y-4 shadow-[4px_4px_0px_0px_rgb(var(--foreground))] sticky top-24">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <PlusCircle className="w-4.5 h-4.5" />
                  Add New Card
                </h3>
                
                <form onSubmit={handleCreateCard} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Question / Term</label>
                    <textarea
                      required
                      value={newCardQ}
                      onChange={(e) => setNewCardQ(e.target.value)}
                      placeholder="e.g., What is ACID in DBMS?"
                      rows={2}
                      className="w-full bg-surface border border-border rounded-xl px-4.5 py-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-foreground resize-none"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Answer / Definition</label>
                    <textarea
                      required
                      value={newCardA}
                      onChange={(e) => setNewCardA(e.target.value)}
                      placeholder="e.g., Atomicity, Consistency, Isolation, Durability..."
                      rows={4}
                      className="w-full bg-surface border border-border rounded-xl px-4.5 py-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-foreground resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-foreground text-background hover:bg-foreground/90 font-bold text-xs rounded-xl shadow-md transition-colors"
                  >
                    Add Card
                  </button>
                </form>
              </div>
            </div>

            {/* Decks Cards Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-card border-2 border-foreground overflow-hidden shadow-[4px_4px_0px_0px_rgb(var(--foreground))]">
                
                <div className="px-5 py-4 border-b border-border bg-surface/30">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Cards in Deck</h3>
                </div>

                <div className="divide-y divide-border overflow-x-auto">
                  {cards.filter(c => c.deckId === selectedDeckId).length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted">
                      No cards in this deck. Use the panel on the left to add one!
                    </div>
                  ) : (
                    cards.filter(c => c.deckId === selectedDeckId).map(card => (
                      <div key={card.id} className="p-5 flex items-start justify-between gap-4 hover:bg-surface/10 transition-colors">
                        <div className="space-y-2 flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground leading-relaxed">{card.question}</p>
                          <p className="text-[11px] text-muted leading-relaxed whitespace-pre-wrap">{card.answer}</p>
                          
                          <div className="flex items-center gap-3 pt-2 text-[10px] font-bold text-muted uppercase">
                            <span className="px-1.5 py-0.5 bg-surface border border-border rounded text-[9px] font-extrabold text-foreground">
                              Box {card.box}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Review: {card.nextReviewDate}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleStarCard(card.id)}
                            className="p-2 text-muted hover:text-foreground rounded-lg transition-all"
                            title="Star Card"
                          >
                            <Star className={`w-3.5 h-3.5 ${card.starred ? 'fill-foreground text-foreground' : ''}`} />
                          </button>
                          <button
                            onClick={() => deleteCard(card.id)}
                            className="p-2 text-muted hover:text-red-500 rounded-lg hover:bg-destructive/10 transition-all"
                            title="Delete Card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. CREATE DECK MODAL ─────────────────────────────────────────── */}
      {showCreateDeckModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-card border-2 border-foreground shadow-[6px_6px_0px_0px_rgb(var(--foreground))] overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="font-bold text-foreground text-sm">Create New Deck</h2>
              <button 
                onClick={() => setShowCreateDeckModal(false)} 
                className="text-muted hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateDeck}>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Deck Name</label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    placeholder="e.g., Database Systems (DBMS)" 
                    value={newDeckName} 
                    onChange={(e) => setNewDeckName(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-foreground font-medium"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-surface border-t border-border flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowCreateDeckModal(false)}
                  className="px-4 py-2 border border-border hover:bg-surface-hover text-xs font-semibold rounded-xl text-muted"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-foreground text-background hover:bg-foreground/90 text-xs font-bold rounded-xl shadow-md"
                >
                  Create Deck
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── 5. SESSION COMPLETE VIEW ──────────────────────────────────────── */}
      {view === 'session-complete' && reviewSummary && (
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[70vh] py-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full bg-card border-2 border-foreground p-8 shadow-[6px_6px_0px_0px_rgb(var(--foreground))] relative overflow-hidden flex flex-col items-center text-center"
          >
            {/* Background dynamic light effect */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            {/* Icon Banner */}
            <div className="w-16 h-16 bg-primary/10 border border-primary/20 text-primary rounded-2xl flex items-center justify-center mb-6">
              <Trophy className="w-8 h-8 text-primary animate-bounce" />
            </div>

            <h2 className="text-xl font-black text-foreground tracking-tight">Session Complete!</h2>
            <p className="text-xs text-muted mt-2 max-w-xs leading-relaxed">
              Excellent work completing your card queue. Here is how your active recall performed:
            </p>

            {/* Circular score / stats */}
            <div className="grid grid-cols-2 gap-4 w-full my-8">
              <div className="bg-surface/50 border border-border rounded-2xl p-4 flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Accuracy</span>
                <p className="text-3xl font-black text-foreground mt-1.5 font-mono">
                  {Math.round((reviewSummary.gotIt / (reviewSummary.gotIt + reviewSummary.forgot || 1)) * 100)}%
                </p>
              </div>
              <div className="bg-surface/50 border border-border rounded-2xl p-4 flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Cards Reviewed</span>
                <p className="text-3xl font-black text-foreground mt-1.5 font-mono">
                  {reviewSummary.gotIt + reviewSummary.forgot}
                </p>
              </div>
            </div>

            <div className="w-full flex gap-3 text-xs font-semibold px-2 py-3 bg-surface/30 rounded-xl border border-border mb-6">
              <div className="flex-1 text-center">
                <span className="text-foreground font-bold">{reviewSummary.gotIt}</span> Got It
              </div>
              <div className="w-px bg-border h-4 self-center" />
              <div className="flex-1 text-center">
                <span className="text-red-500 font-bold">{reviewSummary.forgot}</span> Forgot
              </div>
            </div>

            {/* Motivational statement */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 w-full mb-8 text-center text-xs font-semibold text-foreground/95 leading-relaxed">
              {(() => {
                const pct = (reviewSummary.gotIt / (reviewSummary.gotIt + reviewSummary.forgot || 1)) * 100;
                if (pct === 100) return "🎉 Incredible! A perfect session! Your active recall is top tier.";
                if (pct >= 80) return "💪 Fantastic retention! You are locking in these concepts.";
                if (pct >= 50) return "⚡ Good job! Spaced repetition is a process. Keep reinforcing.";
                return "🧠 Spaced repetition takes time. Let's practice the ones you forgot to build memory paths.";
              })()}
            </div>

            {/* Actions */}
            <div className="w-full space-y-2.5">
              {forgottenCards.length > 0 && (
                <button
                  onClick={startForgottenReview}
                  className="w-full py-3 bg-foreground text-background hover:opacity-90 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Review {forgottenCards.length} Forgotten Cards
                </button>
              )}

              <button
                onClick={restartFullSession}
                className="w-full py-3 border border-border hover:bg-surface-hover text-foreground font-semibold text-xs rounded-xl transition-all"
              >
                Restart Session
              </button>

              <button
                onClick={backToDashboard}
                className="w-full py-3 border border-border bg-surface hover:bg-surface-hover text-foreground font-semibold text-xs rounded-xl transition-all"
              >
                Back to Dashboard
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
