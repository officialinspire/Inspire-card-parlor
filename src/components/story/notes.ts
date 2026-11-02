import { h } from '@/utils/dom';
import type { InfoCard } from '@/story/campaign';
import { sprite } from './sprites';

const KIND_LABEL: Record<InfoCard['kind'], string> = {
  wildlife: 'Wildlife',
  history: 'Local history',
  note: 'About this story',
};

/**
 * Optional field notes: short cards of real wildlife and local history (each
 * with a source to check), or notes about what the story invents. Plain text
 * over optional pictures.
 */
export function infoCards(cards: readonly InfoCard[]): HTMLElement {
  return h(
    'div',
    { class: 'info-cards' },
    ...cards.map((c) =>
      h(
        'article',
        { class: `info-card ${c.kind}`, 'data-info-card': c.id },
        c.sprite
          ? h('span', { class: 'info-art', 'aria-hidden': 'true' }, sprite(c.sprite, { thumb: true, alt: '' }))
          : null,
        h(
          'div',
          { class: 'info-text' },
          h('small', { class: 'tile-kicker' }, KIND_LABEL[c.kind]),
          h('strong', null, c.title),
          h('p', null, c.text),
          c.source ? h('p', { class: 'info-source' }, `Source: ${c.source}`) : null,
        ),
      ),
    ),
  );
}
