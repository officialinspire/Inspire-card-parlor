import type { CardCode, Rank, Suit } from '@/engine/Card';

export type DeckId = string;
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * `general` decks appear everywhere. `mature` decks are adult-themed: hidden
 * until the player opts in, stored under assets/cards/mature/, and never
 * shown in ordinary previews (menus, catalog thumbnails, story screens).
 */
export type ContentRating = 'general' | 'mature';

/** `pending` = commissioned artwork not uploaded yet; the game renders fallbacks. */
export type AssetStatus = 'pending' | 'ready';

/** WebP and PNG for artwork; SVG is used only by the built-in placeholder template. */
export type ImageFormat = 'webp' | 'png' | 'svg';

/** An image path relative to the deck's basePath, without extension; formats are tried in order. */
export interface ImageRef {
  path: string;
  formats?: ImageFormat[];
}

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Uniform grid sprite sheet. Cell size is derived from the image's natural
 * size, so artists can export at any resolution.
 */
export interface AtlasGrid {
  columns: number;
  rows: number;
  /** Row order (default ♠ ♥ ♦ ♣). */
  suitOrder?: Suit[];
  /** Column order (default A, 2 … K). */
  rankOrder?: Rank[];
  /** Optional cell holding the card back. */
  backCell?: { column: number; row: number };
  /** Outer margin and spacing between cells, in source pixels. */
  margin?: number;
  spacing?: number;
}

/** Card faces: one sprite sheet (grid or explicit frames), or one image per card. */
export type FaceAssets =
  | {
      type: 'atlas';
      image: ImageRef;
      grid?: AtlasGrid;
      /** Explicit frames keyed by card code ("AS", "10H", …) and optionally "back". */
      frames?: Partial<Record<CardCode | 'back', AtlasFrame>>;
      /** Or load frames from a TexturePacker-style JSON (hash format) next to the image. */
      metaPath?: string;
      /** Source size; required with explicit frames, otherwise read from the image. */
      size?: { width: number; height: number };
    }
  | {
      type: 'individual';
      /** Path pattern with {code}, e.g. "faces/{code}" → faces/QH.webp */
      pattern: string;
      formats?: ImageFormat[];
    };

/** The back is its own image, or a frame inside the face atlas. */
export type BackAsset = ImageRef | { atlasFrame: 'back' };

export interface DeckAssets {
  /** Folder under /public, e.g. "assets/cards/classic/". Mature decks must live under "assets/cards/mature/". */
  basePath: string;
  status: AssetStatus;
  faces: FaceAssets;
  back: BackAsset;
  /** Catalog/preview image (e.g. a fan of cards). */
  preview: ImageRef;
}

export type UnlockRequirement =
  | { type: 'default' }
  | { type: 'level'; value: number }
  | { type: 'achievement'; value: string }
  | { type: 'story'; value: string };

export interface ArtistCredit {
  /** null until the commission credit is supplied with the artwork. */
  name: string | null;
  url?: string;
  note?: string;
}

/** Procedural rendering used whenever artwork is missing or still loading. */
export interface FallbackStyle {
  back: { base: string; accent: string; pattern: 'diamond' | 'stripe' | 'dots' | 'sunburst' | 'plain'; mark: string };
  face: { paper: string; red: string; black: string };
}

/**
 * Collectible alternate artwork. It may replace the back, the faces, or just
 * some cards, but never changes ranks, suits or how many cards there are.
 */
export interface ArtVariant {
  id: string;
  name: string;
  description: string;
  artist: ArtistCredit;
  rarity: Rarity;
  unlock: UnlockRequirement;
  contentRating?: ContentRating;
  assets: {
    basePath?: string;
    status: AssetStatus;
    faces?: FaceAssets;
    back?: BackAsset;
    preview?: ImageRef;
    /** Per-card replacement images (relative to the variant basePath). */
    overrides?: Partial<Record<CardCode, ImageRef>>;
  };
}

export interface DeckDefinition {
  id: DeckId;
  name: string;
  description: string;
  artist: ArtistCredit;
  rarity: Rarity;
  contentRating: ContentRating;
  unlock: UnlockRequirement;
  assets: DeckAssets;
  fallback: FallbackStyle;
  variants: ArtVariant[];
}
