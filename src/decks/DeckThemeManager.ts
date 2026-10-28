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
  /** Set when the player chose a card back from another deck or artwork. */
  backTheme?: DeckTheme;
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
  /** Whether the player owns a piece of alternate artwork. Unowned art is never applied. */
  ownsVariant?(deckId: DeckId, variantId: string): boolean;
  /** Whether the player may use a deck (for card backs taken from other decks). */
  ownsDeck?(deckId: DeckId): boolean;
  /** Selected card back: deck id or "deckId@variantId"; null = the deck's own. */
  cardBack?(): string | null;
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
    // Cosmetic only: without ownership the deck simply uses its standard art.
    if (this.ctx.ownsVariant && !this.ctx.ownsVariant(deck.id, v.id)) return null;
    return v;
  }

  /** The chosen card back as [deckId, variantId?] if it is usable, else null. */
  backChoice(): [DeckId, string | undefined] | null {
    const raw = this.ctx.cardBack?.();
    if (!raw) return null;
    const [deckId, variantId] = raw.split('@') as [string, string | undefined];
    if (!this.isAvailable(deckId) || (this.ctx.ownsDeck && !this.ctx.ownsDeck(deckId))) return null;
    if (variantId && !this.#variant(getDeck(deckId), variantId)) return null;
    return [deckId, variantId];
  }

  /** Card backs the player can choose from: every usable deck, plus owned artwork with its own back. */
  availableBacks(): { id: string; deckId: DeckId; variantId?: string; label: string }[] {
    const out: { id: string; deckId: DeckId; variantId?: string; label: string }[] = [];
    for (const d of this.list()) {
      if (this.ctx.ownsDeck && !this.ctx.ownsDeck(d.id)) continue;
      out.push({ id: d.id, deckId: d.id, label: d.name });
      for (const v of this.variants(d.id)) {
        if (!v.assets.back) continue;
        if (this.ctx.ownsVariant && !this.ctx.ownsVariant(d.id, v.id)) continue;
        out.push({ id: `${d.id}@${v.id}`, deckId: d.id, variantId: v.id, label: `${d.name} · ${v.name}` });
      }
    }
    return out;
  }

  /** Resolve a deck (and its selected or given variant) to a renderable theme. */
  resolve(deckId: DeckId, variantId: string | undefined = this.ctx.variantFor(deckId)): DeckTheme {
    const base = this.#resolveBase(deckId, variantId);
    const back = this.backChoice();
    if (!back) return base;
    const backTheme = this.#resolveBase(back[0], back[1]);
    if (backTheme.key === base.key) return base;
    const key = `${base.key}|back:${backTheme.key}`;
    let combined = this.#cache.get(key);
    if (!combined) this.#cache.set(key, (combined = { ...base, key, backTheme }));
    return combined;
  }

  #resolveBase(deckId: DeckId, variantId: string | undefined): DeckTheme {
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
