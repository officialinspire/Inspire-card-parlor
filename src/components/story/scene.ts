import { h } from '@/utils/dom';
import { NARRATOR, type DialogueLine } from '@/story/campaign';
import { getCharacter } from '@/story/chapters';
import { getEvidence } from '@/story/evidence';
import { audio } from '@/audio';
import { openDialog, type DialogAction } from '../Dialog';
import { icon } from '../icons';
import { portrait, sprite } from './sprites';

/**
 * The dialogue engine: plays a scene one beat at a time.
 *
 *  - Characters speak beside their portrait (the pose changes with the
 *    line), under a nameplate. Narration — what the silent player sees and
 *    does — sits on parchment with no portrait and no speaker.
 *  - Tap the scene, or press →, Space or Enter on it, to advance; ← or Back
 *    to go back. Skip (or Escape, when allowed) ends the scene at once.
 *  - A beat that reveals evidence shows it, labelled "Added to your journal".
 *  - Motion is a short fade, and none at all with reduced motion.
 *
 * The final actions are always on screen, so a scene never traps the player.
 */
export interface SceneOptions<T> {
  title: string;
  lines: readonly DialogueLine[];
  /** Shown under the text (e.g. a challenge brief); stays visible for the whole scene. */
  extra?: Node | null;
  actions: DialogAction<T>[];
  dismissValue: T;
  className?: string;
}

export function playScene<T extends string>(opts: SceneOptions<T>): Promise<T> {
  const lines = opts.lines.length ? opts.lines : [];
  let i = 0;
  const stage = h('div', {
    class: 'scene-stage',
    tabindex: '0',
    role: 'group',
    'aria-roledescription': 'story scene',
    'aria-label': `${opts.title}. Tap or press the right arrow to continue.`,
    'data-scene': '',
  });
  const counter = h('span', { class: 'scene-count', 'aria-hidden': 'true' });
  const back = h(
    'button',
    { type: 'button', class: 'scene-nav', 'aria-label': 'Previous line', 'data-scene-nav': 'back' },
    icon('chevronLeft'),
  );
  const next = h(
    'button',
    { type: 'button', class: 'scene-nav', 'aria-label': 'Next line', 'data-scene-nav': 'next' },
    icon('chevronRight'),
  );

  const render = (n: number, dir: 1 | -1 | 0) => {
    i = Math.max(0, Math.min(n, lines.length - 1));
    const line = lines[i];
    stage.dataset.line = String(i);
    stage.dataset.lines = String(lines.length);
    counter.textContent = lines.length > 1 ? `${i + 1} / ${lines.length}` : '';
    back.disabled = i === 0;
    next.disabled = i >= lines.length - 1;
    if (!line) return void stage.replaceChildren();
    const narration = line.who === NARRATOR || line.narration;
    const who = getCharacter(line.who);
    const found = line.discovers ? getEvidence(line.discovers) : undefined;
    const beat = h(
      'div',
      {
        class: `scene-beat ${narration ? 'is-narration' : 'is-speech'}${dir ? ' enter' : ''}${line.status === 'draft' ? ' is-draft' : ''}`,
        'data-speaker': narration ? NARRATOR : line.who,
      },
      narration ? null : portrait(line.who, line.pose),
      h(
        'div',
        { class: 'scene-box' },
        narration
          ? null
          : h(
              'span',
              { class: 'scene-nameplate' },
              h('strong', { 'data-speaker-name': '' }, who?.name ?? line.who),
              who?.role ? h('small', null, who.role) : null,
            ),
        h('p', { class: 'scene-text', 'aria-live': 'polite' }, line.text),
        line.status === 'draft' ? h('span', { class: 'scene-draft' }, 'Draft') : null,
        found
          ? h(
              'span',
              { class: 'scene-found', 'data-found': found.id },
              sprite(found.sprite, { thumb: true, className: 'found-art', alt: '' }),
              h('span', null, h('small', null, 'Added to your journal'), h('strong', null, found.name)),
            )
          : null,
      ),
    );
    stage.replaceChildren(beat);
  };

  const step = (d: 1 | -1) => {
    const target = i + d;
    if (target < 0 || target >= lines.length) return;
    if (d > 0) audio.play('flip');
    render(target, d);
  };
  back.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  stage.addEventListener('click', () => step(1));
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    }
  });
  render(0, 0);

  const body = h(
    'div',
    { class: 'scene', 'data-dialogue-lines': String(lines.length) },
    stage,
    lines.length > 1 ? h('div', { class: 'scene-controls' }, back, counter, next) : null,
    opts.extra ?? null,
  );
  const opened = openDialog<T>({
    title: opts.title,
    class: `dialog-story dialog-scene ${opts.className ?? ''}`.trim(),
    body,
    dismissValue: opts.dismissValue,
    actions: opts.actions,
  });
  // Start on the scene itself so arrow keys and Space advance it.
  requestAnimationFrame(() => stage.focus({ preventScroll: true }));
  return opened;
}
