import { h } from '@/utils/dom';
import { assetManager, cardRenderer, deckThemes } from '@/decks';
import { hasDeck } from '@/decks/registry';
import type { CpuPersonality } from '@/games/cpu/personalities';
import { characterPose, loadStoryArt, storyImage, storyUrl } from '@/story/art';
import { CHARACTERS } from '@/story/cast';

/**
 * Character avatar. Story cast members use their own expression sheets.
 * Their initials stand in while the story manifest loads.
 */
export function avatar(p: CpuPersonality, className = ''): HTMLElement {
  const el = h(
    'span',
    { class: `avatar ${className}`.trim(), style: { '--avatar-color': p.color }, 'data-avatar': p.id, title: p.name },
    h('span', { class: 'avatar-initials', 'aria-hidden': 'true' }, p.initials),
  );

  const sheet = storySheetFor(p.id);
  if (sheet) {
    if (!paintStoryFace(el, sheet)) {
      void loadStoryArt().then(() => {
        if (el.isConnected) paintStoryFace(el, sheet);
      });
    }
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

const storySheetFor = (opponentId: string | undefined) =>
  CHARACTERS.find((c) => c.opponentId === opponentId)?.portrait?.sheet;

function paintStoryFace(el: HTMLElement, sheet: string): boolean {
  const pose = TABLE_MOOD_POSE[(el.dataset.mood as TableMood | undefined) ?? 'neutral'];
  const art = characterPose(sheet, pose) ?? characterPose(sheet, TABLE_MOOD_POSE.neutral);
  if (!art) return false;
  if (el.firstElementChild?.getAttribute('data-story-sprite') !== art.id) {
    el.dataset.art = 'story';
    el.replaceChildren(storyImage(art.id, { thumb: true, alt: '' }));
  }
  return true;
}

const moodTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Small thumbnails of every table pose, fetched ahead so a change of face never waits on a download. */
export function preloadMoods(p: CpuPersonality): void {
  const sheet = storySheetFor(p.id);
  if (!sheet || typeof Image === 'undefined') return;
  for (const pose of Object.values(TABLE_MOOD_POSE)) {
    const s = characterPose(sheet, pose);
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
  const sheet = storySheetFor(el.dataset.avatar);
  if (sheet) paintStoryFace(el, sheet);
  if (ms !== undefined && mood !== 'neutral')
    moodTimers.set(
      el,
      setTimeout(() => {
        moodTimers.delete(el);
        if (el.isConnected) setAvatarMood(el, 'neutral');
      }, ms),
    );
}
