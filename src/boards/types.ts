import type { ArtistCredit, AssetStatus, ImageRef, Rarity, UnlockRequirement } from '@/decks/types';

/** Optional ambient animation drawn above the board and beneath the cards. */
export type AmbientKind =
  'none' | 'breeze' | 'dust' | 'steam' | 'river' | 'leaves' | 'sparkle' | 'paint' | 'rain' | 'candle';

export interface BoardAssets {
  /** Folder under /public, e.g. "assets/backgrounds/picnic_table/". */
  basePath: string;
  status: AssetStatus;
  /** Full-bleed table image; shown with `cover` (never stretched). */
  background: ImageRef;
  /** Catalog thumbnail. */
  preview: ImageRef;
  /** Optional sprite sheet for the ambient layer (e.g. leaves), one row of frames. */
  ambientSprites?: { image: ImageRef; frames: number };
}

export interface BoardDefinition {
  id: string;
  name: string;
  description: string;
  artist: ArtistCredit;
  rarity: Rarity;
  unlock: UnlockRequirement;
  assets: BoardAssets;
  /** Procedural surface used until (and underneath) uploaded artwork. */
  surface: {
    /** Dominant colour, used for contrast checks and the browser theme colour. */
    base: string;
    /** CSS background layers for the playing surface. */
    felt: string;
    /** Table edge colour. */
    rim: string;
  };
  /** Text drawn directly on the board (counters, labels) uses this colour. */
  ink: string;
  ambient: AmbientKind;
}
