import { h } from '@/utils/dom';
import { assetManager, cardRenderer, deckThemes } from '@/decks';
import { hasDeck } from '@/decks/registry';
import type { CpuPersonality } from '@/games/cpu/personalities';
import { storySprite, storyUrl } from '@/story/art';
import { CHARACTERS } from '@/story/cast';

/**
 * Character avatar. Uses the character's uploaded portrait when available,
 * otherwise their deck's uploaded card back, otherwise a monogram.
 * Nothing is requested while artwork is still pending.
 */
export function avatar(p: CpuPersonality, className = ''): HTMLElement {
  const el = h(
    'span',
    { class: `avatar ${className}`.trim(), style: { '--avatar-color': p.color }, 'data-avatar': p.id, title: p.name },
    h('span', { class: 'avatar-initials', 'aria-hidden': 'true' }, p.initials),
  );

  // Story characters at the table: their own portrait from the story artwork, when loaded.
  const sheet = CHARACTERS.find((c) => c.opponentId === p.id)?.portrait?.sheet;
  const storyFace = sheet ? storySprite(`${sheet}/portrait-neutral`) : undefined;
  if (storyFace) {
    el.dataset.art = 'story';
    el.replaceChildren(h('img', { src: storyUrl(storyFace.thumb), alt: '', draggable: 'false', decoding: 'async' }));
    return el;
  }

  if (p.portrait.status === 'ready') {
    void assetManager
      .loadImage('assets/characters/', { path: p.id, formats: p.portrait.formats ?? ['webp', 'png'] })
      .then((img) => {
        if (!img) return;
        el.dataset.art = 'portrait';
        el.replaceChildren(h('img', { src: img.url, alt: '', draggable: 'false' }));
      });
  } else if (p.deckId && hasDeck(p.deckId)) {
    const theme = deckThemes.resolve(p.deckId);
    if (theme.deck.id === p.deckId && theme.assets.status === 'ready' && !theme.placeholder) {
      el.dataset.art = 'deck';
      el.replaceChildren(cardRenderer.renderBack(theme, { className: 'avatar-card' }));
    }
  }
  return el;
}

/**
 * How a character looks at the card table. Story characters have expression
 * sheets: each mood is one of their existing portrait poses (the same poses
 * Story Mode uses). Opponents without a sheet keep their portrait and show
 * the mood only as a small, restrained motion (`data-mood` in CSS).
 */
export type TableMood = 'neutral' | 'talk' | 'think' | 'surprise' | 'win' | 'lose';
export const TABLE_MOOD_POSE: Record<TableMood, string> = {
  neutral: 'portrait-neutral',
  talk: 'portrait-talk',
  think: 'portrait-think',
  surprise: 'portrait-surprise',
  win: 'portrait-greet',
  lose: 'portrait-doubt',
};

const moodTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Small thumbnails of every table pose, fetched ahead so a change of face never waits on a download. */
export function preloadMoods(p: CpuPersonality): void {
  const sheet = CHARACTERS.find((c) => c.opponentId === p.id)?.portrait?.sheet;
  if (!sheet || typeof Image === 'undefined') return;
  for (const pose of Object.values(TABLE_MOOD_POSE)) {
    const s = storySprite(`${sheet}/${pose}`);
    if (!s) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = storyUrl(s.thumb);
  }
}

/**
 * Shows `mood` on an avatar made by `avatar()`. With `ms`, the face returns to
 * neutral afterwards (unless another mood has been set meanwhile).
 */
export function setAvatarMood(el: HTMLElement, mood: TableMood, ms?: number): void {
  const prev = moodTimers.get(el);
  if (prev) clearTimeout(prev);
  moodTimers.delete(el);
  el.dataset.mood = mood;
  if (el.dataset.art === 'story') {
    const sheet = CHARACTERS.find((c) => c.opponentId === el.dataset.avatar)?.portrait?.sheet;
    const s = sheet
      ? (storySprite(`${sheet}/${TABLE_MOOD_POSE[mood]}`) ?? storySprite(`${sheet}/portrait-neutral`))
      : undefined;
    const img = el.querySelector('img');
    if (s && img) {
      const url = storyUrl(s.thumb);
      if (img.getAttribute('src') !== url) img.setAttribute('src', url);
    }
  }
  if (ms !== undefined && mood !== 'neutral')
    moodTimers.set(
      el,
      setTimeout(() => {
        moodTimers.delete(el);
        if (el.isConnected) setAvatarMood(el, 'neutral');
      }, ms),
    );
}
