import { h } from '@/utils/dom';
import { characterPose, loadStoryArt, storyImage, storySprite } from '@/story/art';
import { getCharacter } from '@/story/chapters';

/**
 * Story artwork for the Story Mode screens. Everything here is decorative:
 * when a sprite is missing, not loaded yet or fails, the screen shows a plain
 * stand-in (an icon-free shape, a monogram) and keeps working — artwork never
 * blocks play.
 */

/** UI pieces the Story Mode screens use (checked against the manifest by the tests). */
export const UI = {
  nameplate: 'parlor-ui/nameplate',
  parchment: 'parlor-ui/parchment-panel',
  openBook: 'parlor-ui/open-book',
  closedBook: 'parlor-ui/closed-book',
  portraitFrame: 'parlor-ui/oval-portrait-frame',
  crest: 'parlor-ui/crest-emblem',
  arrowNext: 'parlor-ui/arrow-next',
  arrowPrev: 'parlor-ui/arrow-prev',
  arrowSkip: 'parlor-ui/arrow-skip',
  padlock: 'map-icons/padlock',
  pin: 'map-icons/map-pin-spade',
  seal: 'map-icons/wax-seal-check',
  mystery: 'map-icons/mystery-emblem',
  compass: 'map-icons/compass-star',
  medallion: 'map-icons/blank-medallion',
  questAlert: 'map-icons/quest-scroll-alert',
  cardPair: 'map-icons/card-pair',
  victory: 'thirteenth-hand-vfx/confetti-suits',
  defeat: 'thirteenth-hand-vfx/spectral-wisp',
} as const;

/** A story sprite if the manifest has it, otherwise `fallback` (or nothing). */
export function sprite(
  id: string | undefined,
  opts: { thumb?: boolean; alt?: string; className?: string } = {},
  fallback: () => HTMLElement | null = () => null,
): HTMLElement | null {
  if (!id || !storySprite(id)) return fallback();
  return storyImage(id, { alt: opts.alt ?? '', ...opts });
}

/** Decorative sprite: hidden from assistive technology. */
export function deco(id: string, className: string, thumb = true): HTMLElement | null {
  const el = sprite(id, { thumb, className, alt: '' });
  el?.setAttribute('aria-hidden', 'true');
  return el;
}

/**
 * Common pose names let the story use the same moods across the cast.
 * Each character sheet maps those names to its own artwork.
 */
export type Mood = 'neutral' | 'speak' | 'think' | 'surprise' | 'victory' | 'defeat' | 'frustration';
export const MOOD_POSE: Record<Mood, string> = {
  neutral: 'portrait-neutral',
  speak: 'portrait-talk',
  think: 'portrait-think',
  surprise: 'portrait-surprise',
  victory: 'portrait-greet',
  defeat: 'portrait-doubt',
  frustration: 'full-arms-crossed',
};

/** Uses the character's own pose, with a monogram while the manifest loads. */
export function portrait(who: string, pose?: string, className = 'scene-portrait'): HTMLElement {
  const c = getCharacter(who);
  const el = h(
    'span',
    {
      class: `${className} no-art`,
      style: { '--who': c?.color ?? '#888' },
      'aria-hidden': 'true',
      'data-portrait': who,
    },
    h('span', { class: 'portrait-monogram' }, (c?.name ?? who)[0] ?? '?'),
  );
  const sheet = c?.portrait?.sheet;
  if (!sheet) return el;
  const neutral = c.portrait!.pose;
  const paint = () => {
    const art = characterPose(sheet, pose ?? neutral) ?? characterPose(sheet, neutral);
    if (!art) return false;
    el.classList.remove('no-art');
    el.dataset.pose = art.name;
    el.replaceChildren(storyImage(art.id, { className: 'portrait-art', alt: '' }));
    return true;
  };
  if (!paint()) {
    void loadStoryArt().then(() => {
      if (el.isConnected) paint();
    });
  }
  return el;
}
