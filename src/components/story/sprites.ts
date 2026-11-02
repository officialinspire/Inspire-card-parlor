import { h } from '@/utils/dom';
import { storyImage, storySprite } from '@/story/art';
import { getCharacter } from '@/story/chapters';
import { getPersonality, PERSONALITIES, STORY_OPPONENTS } from '@/games/cpu/personalities';
import { avatar } from '../Avatar';

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
 * A character's portrait in a given pose. Uses their expression sheet when
 * it exists; otherwise their opponent avatar (Jak has no sheet yet), or a
 * monogram for anyone else.
 */
export function portrait(who: string, pose?: string, className = 'scene-portrait'): HTMLElement {
  const c = getCharacter(who);
  const sheet = c?.portrait?.sheet;
  const wanted = sheet && (pose ?? c?.portrait?.pose);
  const id = wanted ? `${sheet}/${wanted}` : undefined;
  const fallbackId = sheet ? `${sheet}/${c!.portrait!.pose}` : undefined;
  const art =
    sprite(id, { className: 'portrait-art', alt: '' }) ?? sprite(fallbackId, { className: 'portrait-art', alt: '' });
  const el = h('span', {
    class: `${className}${art ? '' : ' no-art'}`,
    style: { '--who': c?.color ?? '#888' },
    'aria-hidden': 'true',
    'data-portrait': who,
    ...(art && id ? { 'data-pose': wanted } : {}),
  });
  if (art) el.append(art);
  else if (c?.opponentId && [...PERSONALITIES, ...STORY_OPPONENTS].some((p) => p.id === c.opponentId))
    el.append(avatar(getPersonality(c.opponentId), 'portrait-avatar'));
  else el.append(h('span', { class: 'portrait-monogram' }, (c?.name ?? who)[0] ?? '?'));
  return el;
}
