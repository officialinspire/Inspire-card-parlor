import type { CardCode } from '@/engine/Card';
import { allDecks, getDeck, hasDeck, DEFAULT_DECK_ID } from './registry';
import { MATURE_ASSET_ROOT } from './assets';
import type { ArtVariant, DeckAssets, DeckDefinition, DeckId, FallbackStyle, ImageRef } from './types';

/** A deck plus the artwork chosen for it, ready for the asset manager and renderer. */
export interface DeckTheme {
  /** Cache key, e.g. "classic@standard" or "classic@gilded". */
  key: string;
  deck: DeckDefinition;
  variant: ArtVariant | null;
  mature: boolean;
  /** True when the shared placeholder template stands in for pending artwork. */
  placeholder: boolean;
  assets: DeckAssets;
  overrides: Partial<Record<CardCode, ImageRef>>;
  overrideBasePath?: string;
  fallback: FallbackStyle;
}

/**
 * Where a deck image is being shown. Ordinary previews (menus, catalog
 * thumbnails, story screens) never show adult-themed artwork; only the
 * player's explicit choices (detail view, the table itself) do.
 */
export type PreviewContext = 'ordinary' | 'explicit';

export interface ThemeContext {
  matureAllowed(): boolean;
  placeholderArt(): boolean;
  variantFor(deckId: DeckId): string | undefined;
}

/** Shared placeholder template (13×5 grid: 52 faces + back) used to preview the art pipeline. */
export const PLACEHOLDER_ASSETS: DeckAssets = {
  basePath: 'assets/cards/_placeholder/',
  status: 'ready',
  faces: {
    type: 'atlas',
    image: { path: 'faces', formats: ['svg'] },
    grid: { columns: 13, rows: 5, backCell: { column: 0, row: 4 } },
  },
  back: { atlasFrame: 'back' },
  preview: { path: 'preview', formats: ['svg'] },
};

export class DeckThemeManager {
  #cache = new Map<string, DeckTheme>();

  constructor(private ctx: ThemeContext) {}

  isMature(deck: DeckDefinition, variant?: ArtVariant | null): boolean {
    return deck.contentRating === 'mature' || variant?.contentRating === 'mature';
  }

  /** Whether a deck may be listed, selected or rendered at all. */
  isAvailable(deckId: DeckId): boolean {
    if (!hasDeck(deckId)) return false;
    return !this.isMature(getDeck(deckId)) || this.ctx.matureAllowed();
  }

  /** Decks the player may see. Mature decks are excluded unless enabled. */
  list(): DeckDefinition[] {
    return allDecks().filter((d) => this.isAvailable(d.id));
  }

  /** Alternate artwork available for a deck (mature variants only when enabled). */
  variants(deckId: DeckId): ArtVariant[] {
    const deck = getDeck(deckId);
    return deck.variants.filter((v) => v.contentRating !== 'mature' || this.ctx.matureAllowed());
  }

  /** Whether real artwork may be shown for this deck in the given context. */
  canShowArt(deckId: DeckId, context: PreviewContext): boolean {
    const deck = getDeck(deckId);
    const variant = this.#variant(deck, this.ctx.variantFor(deckId));
    if (!this.isMature(deck, variant)) return true;
    return context === 'explicit' && this.ctx.matureAllowed();
  }

  /** The deck id to actually use: unknown or unavailable decks fall back to the default. */
  safeDeckId(deckId: DeckId): DeckId {
    return this.isAvailable(deckId) ? deckId : DEFAULT_DECK_ID;
  }

  #variant(deck: DeckDefinition, variantId?: string): ArtVariant | null {
    const v = variantId ? deck.variants.find((x) => x.id === variantId) : undefined;
    if (!v) return null;
    if (v.contentRating === 'mature' && !this.ctx.matureAllowed()) return null;
    return v;
  }

  /** Resolve a deck (and its selected or given variant) to a renderable theme. */
  resolve(deckId: DeckId, variantId: string | undefined = this.ctx.variantFor(deckId)): DeckTheme {
    const deck = getDeck(this.safeDeckId(deckId));
    const variant = this.#variant(deck, variantId);
    const placeholder = this.ctx.placeholderArt();
    const key = `${deck.id}@${variant?.id ?? 'standard'}${placeholder ? '+placeholder' : ''}`;
    const cached = this.#cache.get(key);
    if (cached) return cached;

    let assets: DeckAssets = { ...deck.assets };
    let overrides: Partial<Record<CardCode, ImageRef>> = {};
    let overrideBasePath: string | undefined;
    if (variant) {
      const v = variant.assets;
      overrideBasePath = v.basePath ?? deck.assets.basePath;
      assets = {
        ...assets,
        basePath: v.faces || v.back || v.preview ? overrideBasePath : assets.basePath,
        status: v.status === 'ready' && deck.assets.status === 'ready' ? 'ready' : v.status,
        ...(v.faces ? { faces: v.faces } : {}),
        ...(v.back ? { back: v.back } : {}),
        ...(v.preview ? { preview: v.preview } : {}),
      };
      overrides = { ...v.overrides };
    }
    if (assets.status !== 'ready' && placeholder) {
      assets = PLACEHOLDER_ASSETS;
      overrides = {};
      overrideBasePath = undefined;
    }

    const theme: DeckTheme = {
      key,
      deck,
      variant,
      mature: this.isMature(deck, variant),
      placeholder: assets === PLACEHOLDER_ASSETS,
      assets,
      overrides,
      ...(overrideBasePath ? { overrideBasePath } : {}),
      fallback: deck.fallback,
    };
    this.#cache.set(key, theme);
    return theme;
  }

  /** Clear cached themes (after settings that affect resolution change). */
  invalidate(): void {
    this.#cache.clear();
  }
}

export const isMatureAssetPath = (path: string) => path.startsWith(MATURE_ASSET_ROOT);
