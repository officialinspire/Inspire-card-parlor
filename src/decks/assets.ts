import type { ArtistCredit, DeckAssets } from './types';

/**
 * Default asset layout every deck starts with until its artwork arrives:
 *
 *   <basePath>faces.webp|png    13 columns (A…K) × 4 rows (♠ ♥ ♦ ♣) sprite sheet
 *   <basePath>back.webp|png     card back
 *   <basePath>preview.webp|png  catalog preview
 *
 * A deck can switch to individual images (faces/{code}.webp) or explicit
 * atlas frames in its own definition without touching any other code.
 */
export function standardAssets(basePath: string): DeckAssets {
  return {
    basePath,
    status: 'pending',
    faces: { type: 'atlas', image: { path: 'faces', formats: ['webp', 'png'] }, grid: { columns: 13, rows: 4 } },
    back: { path: 'back', formats: ['webp', 'png'] },
    preview: { path: 'preview', formats: ['webp', 'png'] },
  };
}

export const MATURE_ASSET_ROOT = 'assets/cards/mature/';

/** Credit for the commissioned artwork uploaded by the studio; replace with the illustrator once confirmed. */
export const studioCredit = (): ArtistCredit => ({
  name: 'OFFICIAL INSPIRE',
  url: 'https://www.inspireclothing.art',
  note: 'Commissioned artwork. Individual illustrator credit to be confirmed.',
});

/**
 * Layout written by scripts/art/extract_cards.py from an uploaded sprite
 * sheet: a normalized 13 × 4 faces.webp (A…K; ♠ ♥ ♦ ♣), back.webp and
 * preview.webp. The cards' source frames and identity checks are recorded in
 * atlas.json next to them.
 */
export function extractedAssets(basePath: string): DeckAssets {
  return {
    basePath,
    status: 'ready',
    faces: { type: 'atlas', image: { path: 'faces', formats: ['webp'] }, grid: { columns: 13, rows: 4 } },
    back: { path: 'back', formats: ['webp'] },
    preview: { path: 'preview', formats: ['webp'] },
  };
}
