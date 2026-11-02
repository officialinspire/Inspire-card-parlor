import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { STAMPS } from '@/story/campaign';
import { LEGACY_CHAPTERS } from '@/story/legacy';
import { storyOf } from '@/story/progress';
import { storyImage, storySprite } from '@/story/art';

/**
 * The passport's stamps: one per chapter of The Thirteenth Hand, shown with
 * its uploaded stamp artwork once earned (an empty numbered slot until then).
 * Stamps are read from the save, which records each one once, so a stamp can
 * never be shown or awarded twice. Stamps from the first campaign stay on a
 * line of their own.
 */
export function passportStamps(store: Store, opts: { legacy?: boolean } = {}): HTMLElement {
  const p = store.state.profile;
  const stamps = storyOf(p).stamps;
  const legacy = opts.legacy ? (p.legacyStory?.stamps ?? []) : [];
  return h(
    'div',
    { class: 'passport-stamps-wrap' },
    h(
      'div',
      { class: 'passport', role: 'list', 'aria-label': `Passport: ${stamps.length} of ${STAMPS.length} stamps` },
      h('span', { class: 'passport-label' }, 'Passport'),
      ...STAMPS.map((s, i) => {
        const has = stamps.includes(s.id);
        const art = has && storySprite(s.sprite) ? storyImage(s.sprite, { thumb: true, alt: '' }) : null;
        return h(
          'span',
          {
            class: `stamp${has ? ' earned' : ''}${art ? ' has-art' : ''}`,
            role: 'listitem',
            'data-stamp': s.id,
            'aria-label': has ? `Chapter ${i + 1}, ${s.label}: stamped` : `Chapter ${i + 1}: not yet stamped`,
            title: has ? `${s.label} — stamped` : `Chapter ${i + 1} — not yet`,
          },
          art ?? (has ? String(i + 1) : h('small', { 'aria-hidden': 'true' }, String(i + 1))),
        );
      }),
    ),
    legacy.length
      ? h(
          'p',
          { class: 'passport-legacy', 'data-legacy-stamps': String(legacy.length) },
          h('small', null, 'Card Parlor Chronicles stamps'),
          ...legacy.map((id) =>
            h(
              'span',
              { class: 'legacy-stamp', 'data-legacy-stamp': id },
              LEGACY_CHAPTERS.find((c) => c.stamp === id)?.title ?? id,
            ),
          ),
        )
      : null,
  );
}
