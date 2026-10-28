import type { DeckDefinition, DeckId } from './types';
import { ClassicDeck } from './definitions/classic';
import { InspireDeck } from './definitions/inspire';
import { JakGoldDeck } from './definitions/jak_gold';
import { DantesWorldDeck } from './definitions/dantes_world';
import { YummyholeStandardDeck } from './definitions/yummyhole_standard';
import { YummyholeAfterDarkDeck } from './definitions/yummyhole_after_dark';
import { FredericksburgDeck } from './definitions/fredericksburg';
import { EasternWoodlandsDeck } from './definitions/eastern_woodlands';
import { SpycraftDeck } from './definitions/spycraft';
import { FreemasonryDeck } from './definitions/freemasonry';

export type { DeckDefinition, DeckId } from './types';

/**
 * Modular deck registry: each deck is its own module in ./definitions.
 * To add a deck, create a definition and list it here (or call registerDeck).
 */
const registry = new Map<DeckId, DeckDefinition>();

export function registerDeck(deck: DeckDefinition): void {
  if (registry.has(deck.id)) throw new Error(`Deck "${deck.id}" is already registered`);
  registry.set(deck.id, deck);
}

[
  ClassicDeck,
  InspireDeck,
  JakGoldDeck,
  DantesWorldDeck,
  YummyholeStandardDeck,
  YummyholeAfterDarkDeck,
  FredericksburgDeck,
  EasternWoodlandsDeck,
  SpycraftDeck,
  FreemasonryDeck,
].forEach(registerDeck);

export const DEFAULT_DECK_ID: DeckId = 'classic';

/** Every registered deck, including mature ones. UI code should list decks via DeckThemeManager instead. */
export const allDecks = (): DeckDefinition[] => [...registry.values()];

export const hasDeck = (id: DeckId) => registry.has(id);

/** Looks up a deck; unknown ids fall back to the classic deck. */
export const getDeck = (id: DeckId): DeckDefinition => registry.get(id) ?? registry.get(DEFAULT_DECK_ID)!;

/** @deprecated Use allDecks() or DeckThemeManager.list(); kept for screens that iterate the catalog. */
export const DECKS: readonly DeckDefinition[] = allDecks();
