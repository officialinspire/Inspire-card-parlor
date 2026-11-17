import { store } from '@/core/store';
import { h } from '@/utils/dom';
import { getDeck } from '@/decks/registry';
import { getBoard } from '@/boards/registry';
import { getGame } from '@/games/registry';
import { getPersonality } from '@/games/cpu/personalities';
import { CHARACTERS } from '@/story/chapters';
import type { StoryLevel } from '@/story/campaign';
import { cardRenderer, deckThemes } from '@/decks';
import { openDialog } from '../Dialog';
import { deco, portrait } from './sprites';

/** Opponents seated at a challenge (War has one, Go Fish one to three). */
export function opponentsOf(level: StoryLevel): string[] {
  const o = level.setup.options ?? {};
  return o.opponents ?? (o.opponent ? [o.opponent] : []);
}

/** The story character who plays as a given opponent, if any. */
const characterFor = (opponentId: string) => CHARACTERS.find((c) => c.opponentId === opponentId);

function deckPreview(deckId: string): HTMLElement {
  const theme = deckThemes.resolve(deckId);
  return h(
    'span',
    { class: 'versus-deck', 'aria-hidden': 'true' },
    cardRenderer.renderBack(theme, { className: 'versus-back' }),
  );
}

/**
 * The versus card shown before a challenge: you, the opponent(s), the game,
 * the objective and the deck. It slides in quickly (not at all with reduced
 * motion) and its Play button is ready at once — nothing to wait for.
 * Solitaire challenges show the same card without an opponent.
 */
export function versus(level: StoryLevel): Promise<'play' | 'back'> {
  const opponents = opponentsOf(level);
  const game = getGame(level.game);
  const deck = getDeck(deckThemes.safeDeckId(store.state.selection.deckId));
  const board = getBoard(level.setup.boardId);
  const names = opponents.map((id) => characterFor(id)?.name ?? getPersonality(id).name);
  const side = (id: string) => {
    const c = characterFor(id);
    return h(
      'div',
      { class: 'versus-side versus-them', 'data-opponent': id },
      portrait(c?.id ?? id, 'portrait-greet', 'versus-portrait'),
      h('strong', { class: 'versus-name' }, c?.name ?? getPersonality(id).name),
    );
  };
  const body = h(
    'div',
    { class: `versus${opponents.length ? '' : ' solo'}`, 'data-versus': level.id },
    h(
      'div',
      { class: 'versus-row' },
      h(
        'div',
        { class: 'versus-side versus-you' },
        h('span', { class: 'versus-you-mark', 'aria-hidden': 'true' }, deco('parlor-ui/crest-emblem', 'you-crest')),
        h('strong', { class: 'versus-name' }, 'You'),
      ),
      opponents.length ? h('span', { class: 'versus-vs', 'aria-hidden': 'true' }, 'VS') : null,
      opponents.length
        ? h('div', { class: `versus-them-group n${opponents.length}` }, ...opponents.map(side))
        : h(
            'div',
            { class: 'versus-side versus-solo' },
            deckPreview(deck.id),
            h('strong', { class: 'versus-name' }, 'Solo challenge'),
          ),
    ),
    h(
      'div',
      { class: 'versus-info' },
      h('span', { class: 'versus-game', 'data-game': level.game }, game?.name ?? level.game),
      h('p', { class: 'story-objective', 'data-objective': '' }, level.objectiveText),
      h(
        'span',
        { class: 'versus-table' },
        opponents.length ? deckPreview(deck.id) : null,
        h('small', null, `${deck.name} · ${board.name}`),
      ),
    ),
  );
  return openDialog<'play' | 'back'>({
    title: opponents.length ? `You vs ${names.join(', ')}` : level.title,
    class: 'dialog-versus',
    body,
    dismissValue: 'back',
    actions: [
      { label: 'Back', value: 'back', variant: 'ghost' },
      { label: 'Play', value: 'play', variant: 'gold', icon: 'play' },
    ],
  });
}
