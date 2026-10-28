import { h } from '@/utils/dom';
import type { DeckDefinition } from '@/decks/registry';

export type Suit = '♠' | '♥' | '♦' | '♣';

/** CSS-rendered card back for a deck (placeholder until illustrated art ships). */
export function cardBack(deck: DeckDefinition, extraClass = ''): HTMLElement {
  return h(
    'div',
    {
      class: `card card-back pattern-${deck.back.pattern} ${extraClass}`.trim(),
      style: { '--card-base': deck.back.base, '--card-accent': deck.back.accent },
      'aria-hidden': 'true',
    },
    h('div', { class: 'card-back-inner' }, h('span', { class: 'card-back-mark' }, 'I')),
  );
}

export function cardFace(deck: DeckDefinition, rank: string, suit: Suit, extraClass = ''): HTMLElement {
  const red = suit === '♥' || suit === '♦';
  return h(
    'div',
    {
      class: `card card-face ${extraClass}`.trim(),
      style: {
        '--card-paper': deck.face.paper,
        '--card-ink': red ? deck.face.red : deck.face.black,
      },
      'aria-label': `${rank} of ${suit}`,
    },
    h('span', { class: 'card-corner tl' }, rank, h('br'), suit),
    h('span', { class: 'card-pip' }, suit),
    h('span', { class: 'card-corner br' }, rank, h('br'), suit),
  );
}
