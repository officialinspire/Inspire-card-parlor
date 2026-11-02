import { h } from '@/utils/dom';
import type { StoryChapter } from '@/story/campaign';
import { getLocation } from '@/story/locations';
import { openDialog } from '../Dialog';
import { portrait, sprite } from './sprites';

/**
 * THE ADVENTURE CONTINUES… — the end of the playable demo, previewing the
 * next place on the map. It says plainly that the chapter is still being
 * made: nothing here suggests it can be played yet.
 */
export function adventureContinues(next: StoryChapter): Promise<'map' | 'menu'> {
  const location = getLocation(next.locationId);
  return openDialog<'map' | 'menu'>({
    title: 'The adventure continues…',
    class: 'dialog-continues',
    body: h(
      'div',
      { class: 'continues', 'data-adventure-continues': next.id },
      h(
        'div',
        { class: 'continues-art', 'aria-hidden': 'true' },
        sprite(next.artwork.locationSprite, { alt: '', className: 'continues-place' }),
        portrait(next.hostId, 'portrait-greet', 'continues-host'),
      ),
      h(
        'div',
        { class: 'continues-text' },
        h('small', { class: 'tile-kicker' }, `Next: Chapter ${next.index} · ${next.location}`),
        h('p', { class: 'continues-title' }, next.title),
        h('p', null, location?.description ?? next.description),
        h(
          'p',
          { class: 'continues-soon', 'data-coming-soon': '' },
          `Chapter ${next.index} is still being written. Thank you for playing the first two chapters of The Thirteenth Hand — your progress is saved and waiting here.`,
        ),
      ),
    ),
    dismissValue: 'map',
    actions: [
      { label: 'Main menu', value: 'menu', variant: 'ghost' },
      { label: 'Back to the map', value: 'map', variant: 'gold' },
    ],
  });
}
