import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { STAMPS } from '@/story/campaign';
import { storyOf } from '@/story/progress';

/** The row of seven passport stamps (one per Chronicles chapter). */
export function passportStamps(store: Store): HTMLElement {
  const stamps = storyOf(store.state.profile).stamps;
  return h(
    'div',
    { class: 'passport', role: 'list', 'aria-label': `Passport: ${stamps.length} of ${STAMPS.length} stamps` },
    h('span', { class: 'passport-label' }, 'Passport'),
    ...STAMPS.map((s, i) => {
      const has = stamps.includes(s.id);
      return h(
        'span',
        {
          class: `stamp${has ? ' earned' : ''}`,
          role: 'listitem',
          'data-stamp': s.id,
          title: has ? `${s.label} — stamped` : `${s.label} — not yet`,
        },
        has ? String(i + 1) : '',
      );
    }),
  );
}
