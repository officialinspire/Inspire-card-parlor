import { h } from '@/utils/dom';
import { NARRATOR, type StorySuit, type SuitPuzzle } from '@/story/campaign';
import { FOUND_ORDER, SUIT_GLYPH, SUIT_NAME, checkSuitOrder, puzzleHint } from '@/story/puzzle';
import { audio } from '@/audio';
import { haptic } from '@/utils/haptics';
import { openDialog } from '../Dialog';
import { playScene } from './scene';

/**
 * The suit-order puzzle, played with the scene dialogs Story Mode already
 * uses: the player taps the four marks in an order, then sets them. A wrong
 * order earns a hint from the cast and another try; the hints end by giving
 * the answer, and "Not now" always leaves, so the puzzle can never trap the
 * player. Resolves true once the door opens.
 */
export async function solveSuitPuzzle(puzzle: SuitPuzzle, title: string): Promise<boolean> {
  let wrong = 0;
  for (;;) {
    const order = await pickOrder(puzzle, title);
    if (!order) return false;
    if (checkSuitOrder(puzzle, order)) {
      audio.play('unlock');
      haptic('success');
      await playScene({
        title,
        lines: puzzle.solved,
        actions: [{ label: 'Continue', value: 'ok', variant: 'gold' }],
        dismissValue: 'ok',
        className: 'scene-puzzle-solved',
      });
      return true;
    }
    audio.play('error');
    haptic('error');
    const hint = puzzleHint(puzzle, wrong++);
    const again = await playScene<'retry' | 'cancel'>({
      title: 'The door doesn’t open',
      lines: [
        {
          who: NARRATOR,
          narration: true,
          text: `You set the marks — ${order.map((s) => SUIT_GLYPH[s]).join(' ')} — but the door does not move.`,
        },
        hint,
      ],
      actions: [
        { label: 'Not now', value: 'cancel', variant: 'ghost' },
        { label: 'Try again', value: 'retry', variant: 'gold' },
      ],
      dismissValue: 'retry',
      className: 'scene-puzzle-hint',
    });
    if (again === 'cancel') return false;
  }
}

/** The picker: four marks to tap in order, with Undo; resolves the order, or null for "Not now". */
async function pickOrder(puzzle: SuitPuzzle, title: string): Promise<StorySuit[] | null> {
  const order: StorySuit[] = [];
  const slots = puzzle.answer.map((_, i) =>
    h('span', { class: 'suit-slot', 'data-suit-slot': String(i), 'aria-hidden': 'true' }),
  );
  const status = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const marks = FOUND_ORDER.map((suit) =>
    h(
      'button',
      {
        type: 'button',
        class: `suit-mark suit-${suit}`,
        'data-suit': suit,
        'aria-label': `${SUIT_NAME[suit]} mark`,
        onclick: () => {
          if (order.length >= puzzle.answer.length || order.includes(suit)) return;
          audio.play('tap');
          order.push(suit);
          sync();
        },
      },
      h('span', { class: 'suit-glyph', 'aria-hidden': 'true' }, SUIT_GLYPH[suit]),
      h('span', { class: 'suit-name' }, SUIT_NAME[suit]),
    ),
  );
  const undo = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost btn-sm suit-undo',
      'data-action': 'suit-undo',
      onclick: () => {
        order.pop();
        sync();
      },
    },
    'Undo',
  );
  const body = h(
    'div',
    { class: 'suit-puzzle', 'data-suit-puzzle': '' },
    h('p', { class: 'suit-prompt' }, puzzle.prompt),
    h('div', { class: 'suit-slots', role: 'img', 'aria-label': 'The four sockets in the door' }, ...slots),
    h('div', { class: 'suit-marks', role: 'group', 'aria-label': 'Your four marks' }, ...marks),
    h('div', { class: 'suit-tools' }, undo),
    status,
  );
  function sync(): void {
    slots.forEach((slot, i) => {
      const suit = order[i];
      slot.textContent = suit ? SUIT_GLYPH[suit] : '';
      slot.className = `suit-slot${suit ? ` filled suit-${suit}` : ''}`;
    });
    for (const m of marks) (m as HTMLButtonElement).disabled = order.includes(m.dataset.suit as StorySuit);
    (undo as HTMLButtonElement).disabled = !order.length;
    const set = body.closest('.dialog')?.querySelector<HTMLButtonElement>('[data-dialog-action="set"]');
    if (set) set.disabled = order.length < puzzle.answer.length;
    status.textContent = order.length
      ? `Set so far: ${order.map((s) => SUIT_NAME[s]).join(', ')}.`
      : 'No marks set yet.';
  }
  const done = openDialog<'set' | 'cancel'>({
    title,
    class: 'dialog-suit-puzzle',
    body,
    dismissValue: 'cancel',
    actions: [
      { label: 'Not now', value: 'cancel', variant: 'ghost' },
      { label: 'Set the marks', value: 'set', variant: 'gold', icon: 'check' },
    ],
    focusIndex: 0,
  });
  // The dialog is in the document now: the primary action waits for all four marks.
  sync();
  return (await done) === 'set' && order.length === puzzle.answer.length ? [...order] : null;
}

// Solved puzzles, for this session: a lost game retried (or reopened) doesn't ask again.
const solved = new Set<string>();
export const isPuzzleSolved = (levelId: string) => solved.has(levelId);
export const markPuzzleSolved = (levelId: string) => void solved.add(levelId);
