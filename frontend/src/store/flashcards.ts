import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Flashcard, FlashcardDeck } from "@/types";

interface CreateDeckPayload {
  name: string;
  subject: string;
  description?: string;
  cards?: Flashcard[];
}

interface FlashcardState {
  decks: FlashcardDeck[];
  activeDeckId?: string;
  createDeck: (payload: CreateDeckPayload) => FlashcardDeck;
  upsertDeck: (deck: FlashcardDeck) => void;
  addCards: (deckId: string, cards: Flashcard[]) => void;
  updateCard: (deckId: string, cardId: string, card: Partial<Flashcard>) => void;
  deleteCard: (deckId: string, cardId: string) => void;
  setActiveDeck: (deckId: string | undefined) => void;
  clear: () => void;
}

const createDeck = ({
  name,
  subject,
  description,
  cards = [],
}: CreateDeckPayload): FlashcardDeck => ({
  id: crypto.randomUUID(),
  name,
  subject,
  description,
  cards,
  updatedAt: Date.now(),
});

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    (set) => ({
      decks: [],
      activeDeckId: undefined,
      createDeck: (payload) => {
        const deck = createDeck(payload);
        set((state) => ({
          decks: [deck, ...state.decks],
          activeDeckId: deck.id,
        }));
        return deck;
      },
      upsertDeck: (deck) =>
        set((state) => ({
          decks: [deck, ...state.decks.filter((item) => item.id !== deck.id)],
        })),
      addCards: (deckId, cards) =>
        set((state) => ({
          decks: state.decks.map((deck) =>
            deck.id === deckId
              ? {
                  ...deck,
                  cards: [
                    ...cards.map((card) => ({
                      ...card,
                      deckId: deckId,
                      createdAt: card.createdAt ?? Date.now(),
                    })),
                    ...deck.cards,
                  ],
                  updatedAt: Date.now(),
                }
              : deck
          ),
        })),
      updateCard: (deckId, cardId, card) =>
        set((state) => ({
          decks: state.decks.map((deck) => {
            if (deck.id !== deckId) return deck;
            return {
              ...deck,
              cards: deck.cards.map((existing) =>
                existing.id === cardId
                  ? {
                      ...existing,
                      ...card,
                      imageGuidance: card.imageGuidance
                        ? {
                            ...existing.imageGuidance,
                            ...card.imageGuidance,
                          }
                        : existing.imageGuidance,
                    }
                  : existing
              ),
              updatedAt: Date.now(),
            };
          }),
        })),
      deleteCard: (deckId, cardId) =>
        set((state) => ({
          decks: state.decks.map((deck) =>
            deck.id === deckId
              ? {
                  ...deck,
                  cards: deck.cards.filter((card) => card.id !== cardId),
                  updatedAt: Date.now(),
                }
              : deck
          ),
        })),
      setActiveDeck: (deckId) => set({ activeDeckId: deckId }),
      clear: () => set({ decks: [], activeDeckId: undefined }),
    }),
    {
      name: "focusly-flashcards",
      version: 1,
      partialize: (state) => ({
        decks: state.decks,
        activeDeckId: state.activeDeckId,
      }),
    }
  )
);
