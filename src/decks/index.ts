import { store, type Store } from '@/core/store';
import { AssetManager } from '@/assets/AssetManager';
import { CardRenderer } from '@/engine/CardRenderer';
import { CardAnimator } from '@/engine/CardAnimator';
import { DeckThemeManager } from './DeckThemeManager';
import { allDecks, DEFAULT_DECK_ID } from './registry';
import { FEATURES } from '@/core/config';
import { isDeckUnlocked, isVariantOwned } from '@/progression/levels';
import { getDeck } from './registry';
import { allBoards, DEFAULT_BOARD_ID } from '@/boards/registry';

export * from './registry';
export type { DeckTheme, PreviewContext } from './DeckThemeManager';

/** Adult-only content needs an edition that allows it, the player's opt-in, and a passed age check. */
export const matureAllowed = () =>
  FEATURES.matureContent && store.state.settings.matureContent && store.state.settings.ageVerified;

/** App-wide instances, bound to the store's settings and selections. */
export const deckThemes = new DeckThemeManager({
  matureAllowed,
  placeholderArt: () => store.state.settings.placeholderArt,
  variantFor: (deckId) => store.state.selection.artVariants[deckId],
  ownsVariant: (deckId, variantId) => {
    const v = getDeck(deckId).variants.find((x) => x.id === variantId);
    return !!v && isVariantOwned(deckId, v, store.state.profile);
  },
  ownsDeck: (deckId) => isDeckUnlocked(deckId, store.state.profile),
  cardBack: () => store.state.selection.cardBack,
});
export const assetManager = new AssetManager({ matureAllowed });
export const cardRenderer = new CardRenderer(assetManager);
export const cardAnimator = new CardAnimator({
  speed: () => store.state.settings.cardAnimationSpeed,
  reducedMotion: () => store.state.settings.reducedMotion,
});

/**
 * Keeps deck selections valid: if a selected deck disappears (mature content
 * switched off, or a deck removed in an update), fall back to the default.
 */
export function attachDeckThemes(s: Store = store): void {
  const sanitize = () => {
    const unavailable = allDecks()
      .filter((d) => !deckThemes.isAvailable(d.id))
      .map((d) => d.id);
    s.dispatch({ type: 'REPLACE_DECKS', unavailable, known: allDecks().map((d) => d.id), fallback: DEFAULT_DECK_ID });
  };
  sanitize();
  // Boards renamed or removed in an update fall back to the default table.
  s.dispatch({ type: 'REPLACE_BOARD', known: allBoards().map((b) => b.id), fallback: DEFAULT_BOARD_ID });
  s.select(
    () => matureAllowed(),
    (allowed) => {
      deckThemes.invalidate();
      if (!allowed) assetManager.clear((key) => key.includes('@') && !deckThemes.isAvailable(key.split('@')[0]!));
      sanitize();
    },
  );
  // Ownership and back choice change what a theme resolves to.
  s.select(
    (st) => st.profile.ownedVariants,
    () => deckThemes.invalidate(),
  );
  s.select(
    (st) => st.selection.cardBack,
    () => deckThemes.invalidate(),
  );
  s.select(
    (st) => st.profile.level,
    () => deckThemes.invalidate(),
  );
  s.select(
    (st) => st.profile.unlockedAchievements,
    () => deckThemes.invalidate(),
  );
  s.select(
    (st) => st.settings.placeholderArt,
    () => deckThemes.invalidate(),
  );
}
