const CARDS_KEY = "utility_srs_cards";

type StoredCard = { nextReviewDate?: string };

export function countDueCards(today = new Date().toISOString().slice(0, 10)): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(CARDS_KEY);
    if (!raw) return 0;
    const cards = JSON.parse(raw) as StoredCard[];
    if (!Array.isArray(cards)) return 0;
    return cards.filter((card) => (card.nextReviewDate || "") <= today).length;
  } catch {
    return 0;
  }
}
