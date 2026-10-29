import { h } from '@/utils/dom';
import { assetManager } from '@/decks';
import { isLight } from '@/utils/color';
import type { AmbientKind, BoardDefinition } from './types';

export interface BoardOptions {
  ambient: boolean;
  highContrast: boolean;
}

/** Particle counts per ambient kind (kept small: these are decoration). */
const PARTICLES: Record<AmbientKind, number> = {
  none: 0,
  breeze: 6,
  dust: 14,
  steam: 5,
  river: 7,
  leaves: 9,
  sparkle: 14,
  paint: 6,
  rain: 22,
  candle: 1,
};

/** The ambient layer: absolutely positioned, beneath the cards, ignores input. */
export function ambientLayer(kind: AmbientKind): HTMLElement {
  const layer = h('div', { class: `ambient ambient-${kind}`, 'aria-hidden': 'true', 'data-ambient': kind });
  for (let i = 0; i < PARTICLES[kind]; i++) {
    const p = h('span', { class: 'ambient-p' });
    // Deterministic spread so layouts are stable between renders.
    const r = (n: number) => ((i * 9301 + n * 49297) % 233280) / 233280;
    p.style.setProperty('--x', `${Math.round(r(1) * 100)}%`);
    p.style.setProperty('--y', `${Math.round(r(2) * 100)}%`);
    p.style.setProperty('--d', `${(6 + r(3) * 8).toFixed(1)}s`);
    p.style.setProperty('--delay', `${(-r(4) * 10).toFixed(1)}s`);
    p.style.setProperty('--s', (0.6 + r(5) * 0.8).toFixed(2));
    layer.appendChild(p);
  }
  return layer;
}

/**
 * Applies a board to a table element: the CSS surface, uploaded artwork when
 * available (cover-fit, never stretched or altered), a readability scrim and
 * the optional ambient layer. Purely visual: game state is never touched.
 */
export function applyBoard(table: HTMLElement, surface: HTMLElement, board: BoardDefinition, opts: BoardOptions): void {
  table.dataset.board = board.id;
  // Tone follows the board's text colour: mid-tone surfaces (wood) are paired
  // with dark ink, so they get the light-board panels that suit dark ink.
  table.dataset.boardTone = isLight(board.ink) ? 'dark' : 'light';
  table.classList.toggle('high-contrast', opts.highContrast);
  table.style.setProperty('--felt', board.surface.felt);
  table.style.setProperty('--rim', board.surface.rim);
  table.style.setProperty('--board-ink', board.ink);
  table.style.setProperty('--board-base', board.surface.base);
  table.style.setProperty('--board-focus-p', board.art?.focus?.portrait ?? '50% 50%');
  table.style.setProperty('--board-focus-l', board.art?.focus?.landscape ?? '50% 50%');
  table.style.setProperty('--board-scrim', String(board.art?.scrim ?? 0.12));
  table.style.removeProperty('--board-art');
  // The CSS surface shows until (and unless) the artwork has loaded.
  table.dataset.boardArt = 'fallback';

  surface.querySelector(':scope > .ambient')?.remove();
  if (opts.ambient && board.ambient !== 'none') surface.prepend(ambientLayer(board.ambient));

  if (board.assets.status === 'ready') {
    void assetManager.loadImage(board.assets.basePath, board.assets.background).then((img) => {
      if (img && table.dataset.board === board.id) {
        table.style.setProperty('--board-art', cssUrl(img.url));
        table.dataset.boardArt = 'image';
      }
    });
  }
}

/**
 * url() for a custom property. Relative URLs inside custom properties resolve
 * against the stylesheet that uses them (dist/assets/…), not the page, so
 * they are made absolute first.
 */
export const cssUrl = (url: string) =>
  `url("${typeof document === 'undefined' ? url : new URL(url, document.baseURI).href}")`;

/** Miniature board for tiles, chips and dialogs. */
export function boardSwatch(board: BoardDefinition, opts: { ambient?: boolean; className?: string } = {}): HTMLElement {
  const el = h('span', {
    class: `board-swatch ${opts.className ?? ''}`.trim(),
    style: { '--felt': board.surface.felt, '--rim': board.surface.rim },
    'data-board-swatch': board.id,
    'aria-hidden': 'true',
  });
  if (opts.ambient && board.ambient !== 'none') el.appendChild(ambientLayer(board.ambient));
  if (board.assets.status === 'ready') {
    void assetManager.loadImage(board.assets.basePath, board.assets.preview).then((img) => {
      if (img) el.style.setProperty('--board-art', cssUrl(img.url));
    });
  }
  return el;
}
