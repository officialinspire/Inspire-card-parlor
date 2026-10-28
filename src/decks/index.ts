import { store, type Store } from '@/core/store';
import { AssetManager } from '@/assets/AssetManager';
import { CardRenderer } from '@/engine/CardRenderer';
import { CardAnimator } from '@/engine/CardAnimator';
import { DeckThemeManager } from './DeckThemeManager';
import { allDecks, DEFAULT_DECK_ID } from './registry';

export * from './registry';
export type { DeckTheme, PreviewContext } from './DeckThemeManager';

const matureAllowed = () => store.state.settings.matureContent;

/** App-wide instances, bound to the store's settings and selections. */
export const deckThemes = new DeckThemeManager({
  matureAllowed,
  placeholderArt: () => store.state.settings.placeholderArt,
  variantFor: (deckId) => store.state.selection.artVariants[deckId],
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
  s.select(
    (st) => st.settings.matureContent,
    (allowed) => {
      deckThemes.invalidate();
      if (!allowed) assetManager.clear((key) => key.includes('@') && !deckThemes.isAvailable(key.split('@')[0]!));
      sanitize();
    },
  );
  s.select(
    (st) => st.settings.placeholderArt,
    () => deckThemes.invalidate(),
  );
}
