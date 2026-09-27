import { create } from 'zustand';
import { auth } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/db';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { logActivity } from '@/lib/activity';
import { localDateKey } from '@/lib/dateLocal';
import { applyGrade } from '@/lib/srs/scheduling';
import { generateId } from '@/lib/id';

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
const META_KEY = 'utility_srs_meta';
const SYNC_DEBOUNCE_MS = 5_000;

type SRSMeta = { updated_at: string };

let cloudHydrating = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pagehideRegistered = false;

function readLocalMeta(): SRSMeta | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SRSMeta;
  } catch {
    return null;
  }
}

function writeLocalMeta(updatedAt: string) {
  localStorage.setItem(META_KEY, JSON.stringify({ updated_at: updatedAt }));
}

function touchLocalMeta() {
  writeLocalMeta(new Date().toISOString());
}

function getTodayString() {
  return localDateKey();
}

async function writeSrsToCloud(): Promise<void> {
  const user = auth.currentUser;
  if (!user || cloudHydrating) return;

  const state = useSRSStore.getState();
  useSRSStore.setState({ syncing: true });
  try {
    const updatedAt = new Date().toISOString();
    const payload = {
      decks: state.decks,
      cards: state.cards,
      updated_at: updatedAt,
    };

    const docRef = doc(db, 'srs_data', user.uid);
    await setDoc(docRef, {
      user_id: user.uid,
      data: payload,
      updated_at: updatedAt,
    }, { merge: true });
    writeLocalMeta(updatedAt);
  } catch (e) {
    console.error('Firebase SRS sync error:', e);
  } finally {
    useSRSStore.setState({ syncing: false });
  }
}

function scheduleSyncToCloud() {
  if (syncTimer != null) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void writeSrsToCloud();
  }, SYNC_DEBOUNCE_MS);
}

/** Flush any pending debounced SRS cloud sync immediately. */
export async function flushSyncToCloud(): Promise<void> {
  if (syncTimer != null) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  await writeSrsToCloud();
}

function ensurePagehideFlush() {
  if (typeof window === 'undefined' || pagehideRegistered) return;
  pagehideRegistered = true;
  window.addEventListener('pagehide', () => {
    void flushSyncToCloud();
  });
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
    ensurePagehideFlush();
    get().pullFromCloud().catch(console.error);
  },

  createDeck: (name) => {
    const newDeck: Deck = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
    };

    const nextDecks = [...get().decks, newDeck];
    set({ decks: nextDecks });
    localStorage.setItem(DECKS_KEY, JSON.stringify(nextDecks));
    touchLocalMeta();
    get().syncToCloud().catch(console.error);
    return newDeck;
  },

  deleteDeck: (deckId) => {
    const nextDecks = get().decks.filter((d) => d.id !== deckId);
    const nextCards = get().cards.filter((c) => c.deckId !== deckId);
    set({ decks: nextDecks, cards: nextCards });
    localStorage.setItem(DECKS_KEY, JSON.stringify(nextDecks));
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    touchLocalMeta();
    get().syncToCloud().catch(console.error);
  },

  addCard: (deckId, question, answer) => {
    const newCard: Flashcard = {
      id: generateId(),
      deckId,
      question,
      answer,
      box: 1,
      nextReviewDate: getTodayString(),
    };

    const nextCards = [...get().cards, newCard];
    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    touchLocalMeta();
    get().syncToCloud().catch(console.error);
  },

  addMultipleCards: (deckId, items) => {
    const newCards: Flashcard[] = items.map((item) => ({
      id: generateId(),
      deckId,
      question: item.question,
      answer: item.answer,
      box: 1,
      nextReviewDate: getTodayString(),
    }));

    const nextCards = [...get().cards, ...newCards];
    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    touchLocalMeta();
    get().syncToCloud().catch(console.error);
  },

  deleteCard: (cardId) => {
    const nextCards = get().cards.filter((c) => c.id !== cardId);
    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    touchLocalMeta();
    get().syncToCloud().catch(console.error);
  },

  gradeCard: (cardId, gotIt) => {
    const today = getTodayString();
    const nextCards = get().cards.map((c) => {
      if (c.id === cardId) {
        const { box, nextReview } = applyGrade(c, gotIt);
        return {
          ...c,
          box,
          nextReviewDate: nextReview,
          lastReviewedDate: today,
        };
      }
      return c;
    });

    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    
    // Log review activity to heatmap
    logActivity('srs_flashcard_reviewed', 1);

    touchLocalMeta();
    get().syncToCloud().catch(console.error);
  },

  toggleStarCard: (cardId) => {
    const nextCards = get().cards.map((c) =>
      c.id === cardId ? { ...c, starred: !c.starred } : c
    );
    set({ cards: nextCards });
    localStorage.setItem(CARDS_KEY, JSON.stringify(nextCards));
    touchLocalMeta();
    get().syncToCloud().catch(console.error);
  },

  syncToCloud: async () => {
    scheduleSyncToCloud();
  },

  pullFromCloud: async () => {
    const user = auth.currentUser;
    if (!user) return;

    ensurePagehideFlush();
    cloudHydrating = true;
    set({ syncing: true });
    try {
      const docRef = doc(db, 'srs_data', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const cloudData = docSnap.data()?.data;
        if (cloudData) {
          const cloudDecks = cloudData.decks || [];
          const cloudCards = cloudData.cards || [];
          const cloudUpdated = cloudData.updated_at
            ? new Date(cloudData.updated_at).getTime()
            : 0;
          const localMeta = readLocalMeta();
          const localUpdated = localMeta?.updated_at
            ? new Date(localMeta.updated_at).getTime()
            : 0;

          if (cloudUpdated >= localUpdated) {
            set({ decks: cloudDecks, cards: cloudCards });
            localStorage.setItem(DECKS_KEY, JSON.stringify(cloudDecks));
            localStorage.setItem(CARDS_KEY, JSON.stringify(cloudCards));
            if (cloudData.updated_at) {
              writeLocalMeta(cloudData.updated_at);
            }
          } else if (localUpdated > 0) {
            // Clear guard before push so syncToCloud / writeSrsToCloud can run.
            cloudHydrating = false;
            await flushSyncToCloud();
          }
        }
      }
    } catch (e) {
      console.error('Firebase SRS pull error:', e);
    } finally {
      cloudHydrating = false;
      set({ syncing: false });
    }
  },
}));
