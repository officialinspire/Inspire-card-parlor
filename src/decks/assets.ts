import type { DeckAssets } from './types';

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
