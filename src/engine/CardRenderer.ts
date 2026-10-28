import { h } from '@/utils/dom';
import { SUIT_SYMBOL, RANK_CODE, parseCardCode, type Card, type CardCode } from './Card';
import type { AssetManager, DeckArt } from '@/assets/AssetManager';
import { frameStyle } from '@/assets/atlas';
import type { DeckTheme } from '@/decks/DeckThemeManager';

/** How one side of a card will be drawn. */
export type CardVisual =
  | { kind: 'fallback' }
  | { kind: 'image'; url: string }
  | { kind: 'atlas'; url: string; backgroundSize: string; backgroundPosition: string };

/** Pure: pick the visual for a face from loaded art (override → atlas/individual → fallback). */
export function describeFace(code: CardCode, art: DeckArt | undefined): CardVisual {
  if (!art) return { kind: 'fallback' };
  const override = art.overrides[code];
  if (override) return { kind: 'image', url: override.url };
  if (art.faces?.kind === 'atlas') {
    const frame = art.faces.frames[code];
    if (frame) return { kind: 'atlas', url: art.faces.sheet.url, ...frameStyle(frame, art.faces.sheet) };
  }
  if (art.faces?.kind === 'individual') {
    const img = art.faces.images[code];
    if (img) return { kind: 'image', url: img.url };
  }
  return { kind: 'fallback' };
}

/** Pure: pick the visual for a card back. */
export function describeBack(art: DeckArt | undefined): CardVisual {
  if (!art?.back) return { kind: 'fallback' };
  const { image, frame } = art.back;
  return frame ? { kind: 'atlas', url: image.url, ...frameStyle(frame, image) } : { kind: 'image', url: image.url };
}

export interface RenderOptions {
  className?: string;
  /** Neutral cover instead of artwork (adult-themed decks in ordinary previews). */
  cover?: boolean;
}

/**
 * Turns cards into DOM elements. Uses uploaded artwork when the deck's assets
 * are ready and loaded; otherwise draws a procedural card in the deck's
 * fallback colors. Elements upgrade in place when artwork finishes loading.
 */
export class CardRenderer {
  constructor(private assets: AssetManager) {
    assets.onDeckLoaded((key) => this.#refresh(key));
  }

  #art(theme: DeckTheme): DeckArt | undefined {
    const art = this.assets.getDeckArt(theme.key);
    if (!art && theme.assets.status === 'ready') void this.assets.loadDeck(theme);
    return art;
  }

  /** Render a game card (face up or down). */
  renderCard(card: Card, theme: DeckTheme, opts: RenderOptions = {}): HTMLElement {
    const el = card.faceUp ? this.renderFace(theme, card.code, opts) : this.renderBack(theme, opts);
    // Face-down cards carry no identity, so hidden cards cannot be read from the page.
    if (card.faceUp) el.dataset.cardId = card.id;
    else el.setAttribute('aria-label', 'Face-down card');
    return el;
  }

  /** Re-render an element after its card flipped or the theme changed. */
  update(el: HTMLElement, card: Card, theme: DeckTheme): HTMLElement {
    const next = this.renderCard(card, theme, { className: el.dataset.extraClass ?? '' });
    el.replaceWith(next);
    return next;
  }

  renderFace(theme: DeckTheme, code: CardCode, opts: RenderOptions = {}): HTMLElement {
    const parsed = parseCardCode(code)!;
    const label = `${RANK_CODE[parsed.rank]} of ${parsed.suit}`;
    const el = this.#base(theme, 'face', opts);
    el.dataset.code = code;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
    this.#paint(el, opts.cover ? { kind: 'fallback' } : describeFace(code, this.#art(theme)), () =>
      this.#fallbackFace(el, theme, code),
    );
    return el;
  }

  renderBack(theme: DeckTheme, opts: RenderOptions = {}): HTMLElement {
    const el = this.#base(theme, 'back', opts);
    el.setAttribute('aria-hidden', 'true');
    if (opts.cover) {
      el.classList.add('card-cover');
      el.replaceChildren(h('span', { class: 'card-cover-mark' }, '18+'));
      return el;
    }
    this.#paint(el, describeBack(this.#art(theme)), () => this.#fallbackBack(el, theme));
    return el;
  }

  #base(theme: DeckTheme, side: 'face' | 'back', opts: RenderOptions): HTMLElement {
    const el = h('div', { class: `card card-${side} ${opts.className ?? ''}`.trim() });
    el.dataset.theme = theme.key;
    el.dataset.side = side;
    if (opts.className) el.dataset.extraClass = opts.className;
    if (opts.cover) el.dataset.cover = 'true';
    return el;
  }

  #paint(el: HTMLElement, visual: CardVisual, fallback: () => void): void {
    el.dataset.art = visual.kind;
    el.classList.toggle('card-art', visual.kind !== 'fallback');
    if (visual.kind === 'fallback') {
      el.style.backgroundImage = '';
      el.style.backgroundSize = '';
      el.style.backgroundPosition = '';
      fallback();
      return;
    }
    el.replaceChildren();
    el.style.backgroundImage = `url("${visual.url}")`;
    el.style.backgroundSize = visual.kind === 'atlas' ? visual.backgroundSize : 'cover';
    el.style.backgroundPosition = visual.kind === 'atlas' ? visual.backgroundPosition : 'center';
  }

  #fallbackFace(el: HTMLElement, theme: DeckTheme, code: CardCode): void {
    const { rank, suit } = parseCardCode(code)!;
    const red = suit === 'hearts' || suit === 'diamonds';
    el.classList.add('card-fallback');
    el.style.setProperty('--card-paper', theme.fallback.face.paper);
    el.style.setProperty('--card-ink', red ? theme.fallback.face.red : theme.fallback.face.black);
    const r = RANK_CODE[rank];
    const s = SUIT_SYMBOL[suit];
    el.replaceChildren(
      h('span', { class: 'card-corner tl' }, r, h('br'), s),
      h('span', { class: 'card-pip' }, s),
      h('span', { class: 'card-corner br' }, r, h('br'), s),
    );
  }

  #fallbackBack(el: HTMLElement, theme: DeckTheme): void {
    const { base, accent, pattern, mark } = theme.fallback.back;
    el.classList.add('card-fallback', `pattern-${pattern}`);
    el.style.setProperty('--card-base', base);
    el.style.setProperty('--card-accent', accent);
    el.replaceChildren(h('div', { class: 'card-back-inner' }, h('span', { class: 'card-back-mark' }, mark)));
  }

  /** Upgrade elements already on the page once their deck's artwork has loaded. */
  #refresh(key: string): void {
    if (typeof document === 'undefined') return;
    const art = this.assets.getDeckArt(key);
    for (const el of document.querySelectorAll<HTMLElement>(`.card[data-theme="${CSS.escape(key)}"]`)) {
      if (el.dataset.cover) continue;
      const visual = el.dataset.side === 'back' ? describeBack(art) : describeFace(el.dataset.code as CardCode, art);
      if (visual.kind === 'fallback') continue;
      el.classList.remove('card-fallback', ...[...el.classList].filter((c) => c.startsWith('pattern-')));
      this.#paint(el, visual, () => undefined);
    }
  }
}
