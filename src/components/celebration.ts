import { h } from '@/utils/dom';

const SUITS = ['♠', '♥', '♦', '♣'];

/**
 * A light shower of gold and red suits falling over a table. Pure CSS
 * transforms on a few dozen spans; removes itself when done.
 */
export function victoryShower(count = 34): HTMLElement {
  const el = h(
    'div',
    { class: 'victory-shower', 'aria-hidden': 'true' },
    ...Array.from({ length: count }, (_, i) =>
      h(
        'span',
        {
          class: i % 3 === 1 ? 'is-red' : '',
          style: {
            '--x': `${(i * 37) % 100}%`,
            '--delay': `${(i % 12) * 90}ms`,
            '--dur': `${1700 + (i % 5) * 260}ms`,
            '--drift': `${((i % 7) - 3) * 18}px`,
            '--spin': `${(i % 2 ? 1 : -1) * (160 + (i % 4) * 60)}deg`,
            '--size': `${14 + (i % 4) * 5}px`,
          },
        },
        SUITS[i % 4]!,
      ),
    ),
  );
  setTimeout(() => el.remove(), 3600);
  return el;
}
