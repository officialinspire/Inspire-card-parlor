import { h } from '@/utils/dom';
import type { Profile } from '@/core/types';
import { worldMap, type MapStop } from '@/story/world';
import { deco, sprite, UI } from './sprites';

/**
 * The story world map: the nine places of The Thirteenth Hand along a trail.
 *
 * No illustrated base map of Fredericksburg has been supplied, so this is the
 * fallback the brief allows: the uploaded location tiles laid out in story
 * order on a parchment trail. The order is the order of the story, not a
 * claim about where the places are.
 *
 * Each stop is a button with its place name, chapter and state in its
 * accessible name and its description attached. Undiscovered places keep
 * their name and art hidden.
 */
const STATE_LABEL: Record<MapStop['state'], string> = {
  undiscovered: 'Undiscovered',
  locked: 'Locked',
  available: 'Open',
  completed: 'Completed',
  preview: 'Coming soon',
};
const STATE_ICON: Record<MapStop['state'], string> = {
  undiscovered: UI.mystery,
  locked: UI.padlock,
  available: UI.pin,
  completed: UI.seal,
  preview: UI.compass,
};

export function worldMapView(profile: Profile, onSelect: (stop: MapStop) => void): HTMLElement {
  const stops = worldMap(profile);
  const current = stops.findIndex((s) => s.state === 'available');
  return h(
    'div',
    { class: 'world-map', 'data-world-map': '' },
    deco(UI.compass, 'map-compass'),
    h(
      'ol',
      { class: 'map-trail', 'aria-label': 'Story locations' },
      ...stops.map((stop, i) => {
        const { chapter, state } = stop;
        const descId = `map-desc-${chapter.id}`;
        const hidden = state === 'undiscovered';
        const progress = state === 'available' ? `, ${stop.done} of ${stop.total} challenges done` : '';
        return h(
          'li',
          { class: `map-stop ${state}${i === current ? ' current' : ''}`, style: { '--i': String(i) } },
          h(
            'button',
            {
              type: 'button',
              class: 'map-tile',
              'data-chapter': chapter.id,
              'data-state': state,
              'aria-label': `Chapter ${chapter.index}: ${stop.name}${hidden ? '' : ` — ${chapter.title}`}. ${STATE_LABEL[state]}${progress}.`,
              'aria-describedby': descId,
              ...(i === current ? { 'aria-current': 'step' } : {}),
              onclick: () => onSelect(stop),
            },
            h(
              'span',
              { class: 'map-tile-art' },
              hidden
                ? deco(UI.mystery, 'map-mystery')
                : (sprite(chapter.artwork.locationSprite, { thumb: true, alt: '', className: 'map-place' }) ??
                    h('span', { class: 'map-place-fallback', style: { '--tint': chapter.artwork.tint } })),
              h('span', { class: 'map-badge', 'aria-hidden': 'true' }, deco(STATE_ICON[state], 'map-badge-art')),
            ),
            h('span', { class: 'map-num', 'aria-hidden': 'true' }, String(chapter.index)),
            h('span', { class: 'map-name' }, stop.name),
            state === 'available'
              ? h(
                  'span',
                  { class: 'map-pips', 'aria-hidden': 'true' },
                  ...Array.from({ length: stop.total }, (_, k) => h('i', { class: k < stop.done ? 'on' : '' })),
                )
              : h('span', { class: 'map-state', 'aria-hidden': 'true' }, STATE_LABEL[state]),
          ),
          h('span', { id: descId, class: 'sr-only' }, stop.description),
        );
      }),
    ),
  );
}
