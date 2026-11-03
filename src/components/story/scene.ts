import { h } from '@/utils/dom';
import { NARRATOR, type DialogueLine } from '@/story/campaign';
import { paceDialogue } from '@/story/dialogue';
import { getCharacter } from '@/story/chapters';
import { getEvidence } from '@/story/evidence';
import { audio } from '@/audio';
import { openDialog, type DialogAction } from '../Dialog';
import { icon } from '../icons';
import { MOOD_POSE, portrait, sprite } from './sprites';
import { vfxBurst } from './vfx';
import { haptic } from '@/utils/haptics';

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
 *
 * Layout: the text appears in full at once (no typing effect, so there is
 * nothing to wait for or skip through). A long beat is paced into panels
 * between sentences (src/story/dialogue.ts). The stage is sized to the
 * scene's tallest panel when it opens, so the controls and actions never
 * move while the player taps through.
 */
export interface SceneOptions<T> {
  title: string;
  lines: readonly DialogueLine[];
  /** Shown under the text (e.g. a challenge brief); stays visible for the whole scene. */
  extra?: Node | null;
  actions: DialogAction<T>[];
  dismissValue: T;
  className?: string;
  /** Called once the scene is on screen (for effects aimed at its parts). */
  onOpen?: (panel: HTMLElement) => void;
}

export function playScene<T extends string>(opts: SceneOptions<T>): Promise<T> {
  const lines = paceDialogue(opts.lines);
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
    { type: 'button', class: 'scene-nav scene-next', 'aria-label': 'Next line', 'data-scene-nav': 'next' },
    h('span', { class: 'scene-next-label', 'aria-hidden': 'true' }, 'Next'),
    icon('chevronRight'),
  );

  const beatFor = (line: DialogueLine, dir: 1 | -1 | 0): HTMLElement => {
    const narration = line.who === NARRATOR || line.narration;
    const who = getCharacter(line.who);
    const found = line.discovers ? getEvidence(line.discovers) : undefined;
    const beat = h(
      'div',
      {
        class: `scene-beat ${narration ? 'is-narration' : 'is-speech'}${dir ? ' enter' : ''}${line.status === 'draft' ? ' is-draft' : ''}`,
        'data-speaker': narration ? NARRATOR : line.who,
      },
      // Speaking is the default expression; scenes pick others line by line.
      narration ? null : portrait(line.who, line.pose ?? MOOD_POSE.speak),
      h(
        'div',
        { class: 'scene-main' },
        // The nameplate sits above the line (never over it), and beside the portrait on phones.
        narration
          ? null
          : h(
              'span',
              { class: 'scene-nameplate' },
              h('strong', { 'data-speaker-name': '' }, who?.name ?? line.who),
              who?.role ? h('small', null, who.role) : null,
            ),
        h(
          'div',
          { class: 'scene-box' },
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
      ),
    );
    return beat;
  };

  const render = (n: number, dir: 1 | -1 | 0) => {
    i = Math.max(0, Math.min(n, lines.length - 1));
    const line = lines[i];
    stage.dataset.line = String(i);
    stage.dataset.lines = String(lines.length);
    counter.textContent = lines.length > 1 ? `${i + 1} / ${lines.length}` : '';
    back.disabled = i === 0;
    next.disabled = i >= lines.length - 1;
    stage.classList.toggle('at-end', i >= lines.length - 1);
    if (!line) return void stage.replaceChildren();
    const found = line.discovers ? getEvidence(line.discovers) : undefined;
    const beat = beatFor(line, dir);
    stage.replaceChildren(beat);
    // A discovery: a short sparkle (the card itself gets a faint spectral wisp) and a light buzz.
    if (found && dir >= 0) {
      const at = beat.querySelector('[data-found]');
      requestAnimationFrame(() => vfxBurst(found.id === 'thirteenth-hand-card' ? 'spectral' : 'discovery', at, 1.4));
      haptic('success');
    }
  };

  const step = (d: 1 | -1) => {
    const target = i + d;
    if (target < 0 || target >= lines.length) return;
    audio.play(d > 0 ? 'flip' : 'back');
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
  requestAnimationFrame(() => {
    fitStage();
    stage.focus({ preventScroll: true });
    // Let the dialog settle into place before aiming effects at it.
    if (opts.onOpen) setTimeout(() => opts.onOpen?.(body), 260);
  });
  return opened;

  /**
   * Holds the stage at the height of the scene's tallest panel (capped, after
   * which the stage scrolls), so nothing below it jumps from line to line.
   */
  function fitStage(): void {
    if (lines.length < 2 || !stage.isConnected || !stage.clientWidth) return;
    const shown = stage.firstElementChild;
    let tallest = 0;
    for (const line of lines) {
      stage.replaceChildren(beatFor(line, 0));
      tallest = Math.max(tallest, stage.scrollHeight);
    }
    stage.replaceChildren(...(shown ? [shown] : []));
    stage.style.minHeight = `${Math.ceil(tallest)}px`;
  }
}
