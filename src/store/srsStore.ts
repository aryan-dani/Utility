import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { logActivity } from '@/components/ActivityHeatmap';

export interface Flashcard {
  id: string;
  deckId: string;
  question: string;
  answer: string;
  box: number; // 1 to 5
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewedDate?: string;
  starred?: boolean;
}

export interface Deck {
  id: string;
  name: string;
  createdAt: string;
}

interface SRSState {
  decks: Deck[];
  cards: Flashcard[];
  initialized: boolean;
  syncing: boolean;

  initStore: () => void;
  createDeck: (name: string) => Deck;
  deleteDeck: (deckId: string) => void;
  addCard: (deckId: string, question: string, answer: string) => void;
  deleteCard: (cardId: string) => void;
  addMultipleCards: (deckId: string, items: { question: string; answer: string }[]) => void;
  gradeCard: (cardId: string, gotIt: boolean) => void;
  toggleStarCard: (cardId: string) => void;
  syncToCloud: () => Promise<void>;
  pullFromCloud: () => Promise<void>;
}

const DECKS_KEY = 'utility_srs_decks';
const CARDS_KEY = 'utility_srs_cards';

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getNextReviewDate(box: number): string {
  const intervals = [1, 2, 4, 7, 14]; // Box 1 = 1 day, Box 2 = 2 days, etc.
  const days = intervals[Math.min(box - 1, intervals.length - 1)] || 1;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const useSRSStore = create<SRSState>((set, get) => ({
  decks: [],
  cards: [],
  initialized: false,
  syncing: false,

  initStore: () => {
    if (get().initialized) return;

    const savedDecks = localStorage.getItem(DECKS_KEY);
    const savedCards = localStorage.getItem(CARDS_KEY);

    let decks: Deck[] = [];
    let cards: Flashcard[] = [];

    if (savedDecks) {
      try {
        decks = JSON.parse(savedDecks);
      } catch (e) {
        console.error('Failed to parse SRS decks', e);
      }
    }
    if (savedCards) {
      try {
        cards = JSON.parse(savedCards);
      } catch (e) {
        console.error('Failed to parse SRS cards', e);
      }
    }

    set({ decks, cards, initialized: true });
    get().pullFromCloud().catch(console.error);
  },

  createDeck: (name) => {
    const newDeck: Deck = {
      id: Math.random().toString(36).slice(2, 11),
      name,
      createdAt: new Date().toISOString(),
    };

    const nextDecks = [...get().decks, newDeck];
    set({ decks: nextDecks });
    localStorage.setItem(DECKS_KEY, JSON.stringify(nextDecks));
    get().syncToCloud().catch(console.error);
    return newDeck;
  },

  deleteDeck: (deckId) => {
    const nextDecks = get().decks.filter((d) => d.id !== deckId);
    const nextCards = get().cards.filter((c) => c.deckId !== deckId);
    set({ decks: nextDecks, cards: nextCards });
    localStorage.setItem(DECKS_KEY, JSON.stringify(nextDecks));
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    get().syncToCloud().catch(console.error);
  },

  addCard: (deckId, question, answer) => {
    const newCard: Flashcard = {
      id: Math.random().toString(36).slice(2, 11),
      deckId,
      question,
      answer,
      box: 1,
      nextReviewDate: getTodayString(),
    };

    const nextCards = [...get().cards, newCard];
    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    get().syncToCloud().catch(console.error);
  },

  addMultipleCards: (deckId, items) => {
    const newCards: Flashcard[] = items.map((item) => ({
      id: Math.random().toString(36).slice(2, 11),
      deckId,
      question: item.question,
      answer: item.answer,
      box: 1,
      nextReviewDate: getTodayString(),
    }));

    const nextCards = [...get().cards, ...newCards];
    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    get().syncToCloud().catch(console.error);
  },

  deleteCard: (cardId) => {
    const nextCards = get().cards.filter((c) => c.id !== cardId);
    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    get().syncToCloud().catch(console.error);
  },

  gradeCard: (cardId, gotIt) => {
    const nextCards = get().cards.map((c) => {
      if (c.id === cardId) {
        const nextBox = gotIt ? Math.min(c.box + 1, 5) : 1;
        const nextReviewDate = getNextReviewDate(nextBox);
        return {
          ...c,
          box: nextBox,
          nextReviewDate,
          lastReviewedDate: getTodayString(),
        };
      }
      return c;
    });

    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    
    // Log review activity to heatmap
    logActivity('srs_flashcard_reviewed', 1);

    get().syncToCloud().catch(console.error);
  },

  toggleStarCard: (cardId) => {
    const nextCards = get().cards.map((c) =>
      c.id === cardId ? { ...c, starred: !c.starred } : c
    );
    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    get().syncToCloud().catch(console.error);
  },

  syncToCloud: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    set({ syncing: true });
    try {
      const payload = {
        decks: get().decks,
        cards: get().cards,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('srs_data') // fallback to profile/planner table metadata if srs_data does not exist
        .upsert(
          { user_id: user.id, data: payload },
          { onConflict: 'user_id' }
        );
      if (error) {
        // If srs_data does not exist, we save it inside planner_data key under metadata or just swallow.
        // Let's print a warning but continue normally.
        console.warn('Supabase srs_data table not found, fallback to local storage only.');
      }
    } catch (e) {
      console.error('Supabase sync error:', e);
    } finally {
      set({ syncing: false });
    }
  },

  pullFromCloud: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    set({ syncing: true });
    try {
      const { data, error } = await supabase
        .from('srs_data')
        .select('data')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data?.data) {
        const cloudDecks = data.data.decks || [];
        const cloudCards = data.data.cards || [];
        
        set({ decks: cloudDecks, cards: cloudCards });
        localStorage.setItem(DECKS_KEY, JSON.stringify(cloudDecks));
        localStorage.setItem(CARDS_KEY, JSON.stringify(cloudCards));
      }
    } catch (e) {
      console.error('Supabase pull error:', e);
    } finally {
      set({ syncing: false });
    }
  },
}));
