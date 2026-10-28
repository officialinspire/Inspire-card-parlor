import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { allBoards } from '@/boards/registry';
import { boardSwatch } from '@/boards/BoardRenderer';
import { cardRenderer, deckThemes } from '@/decks';
import { isBoardUnlocked, isDeckUnlocked } from '@/progression/levels';
import { audio } from '@/audio';
import { toggle } from './controls';
import { live } from './live';

/** Horizontal radio strip of visual choices. */
function picker<T extends { id: string }>(
  label: string,
  attr: string,
  items: T[],
  current: () => string,
  render: (item: T) => Node,
  name: (item: T) => string,
  choose: (item: T) => void,
): HTMLElement {
  const strip = h('div', { class: 'pick-strip', role: 'radiogroup', 'aria-label': label });
  const draw = () =>
    strip.replaceChildren(
      ...items.map((it) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            class: `pick${it.id === current() ? ' active' : ''}`,
            'aria-checked': String(it.id === current()),
            [`data-pick-${attr}`]: it.id,
            title: name(it),
            onclick: () => {
              audio.play('tap');
              choose(it);
              draw();
            },
          },
          render(it),
          h('span', { class: 'pick-name' }, name(it)),
        ),
      ),
    );
  draw();
  return h('div', { class: 'control control-pick' }, h('span', { class: 'control-label' }, label), strip);
}

/**
 * Deck, card back and gameboard pickers (owned items only) plus table display
 * options. Selections are independent of each other and purely cosmetic.
 */
export function tableCustomizer(store: Store): HTMLElement {
  const p = () => store.state.profile;
  const decks = deckThemes.list().filter((d) => isDeckUnlocked(d.id, p()));
  const backs = [{ id: '', deckId: '', label: 'Match deck' }, ...deckThemes.availableBacks()];
  const boards = allBoards().filter((b) => isBoardUnlocked(b.id, p()));

  return h(
    'div',
    { class: 'customizer', 'data-customizer': '' },
    picker(
      'Deck',
      'deck',
      decks,
      () => store.state.selection.deckId,
      (d) => cardRenderer.renderFace(deckThemes.resolve(d.id), 'AS', { className: 'pick-card' }),
      (d) => d.name,
      (d) => store.dispatch({ type: 'SELECT_DECK', deckId: d.id }),
    ),
    picker(
      'Card back',
      'back',
      backs,
      () => store.state.selection.cardBack ?? '',
      (b) =>
        b.id
          ? cardRenderer.renderBack(deckThemes.resolve(b.deckId, (b as { variantId?: string }).variantId), {
              className: 'pick-card',
              cover: !deckThemes.canShowArt(b.deckId, 'ordinary'),
            })
          : cardRenderer.renderBack(deckThemes.resolve(store.state.selection.deckId), {
              className: 'pick-card pick-match',
            }),
      (b) => b.label,
      (b) => store.dispatch({ type: 'SELECT_CARD_BACK', back: b.id || null }),
    ),
    picker(
      'Gameboard',
      'board',
      boards,
      () => store.state.selection.boardId,
      (b) => boardSwatch(b, { className: 'pick-board' }),
      (b) => b.name,
      (b) => store.dispatch({ type: 'SELECT_BOARD', boardId: b.id }),
    ),
    live(
      toggle(
        'Ambient animation',
        store.state.settings.ambientAnimations,
        (v) => store.dispatch({ type: 'UPDATE_SETTINGS', patch: { ambientAnimations: v } }),
        'Gentle movement on the table (off with reduced motion)',
      ),
      (st) => st.settings.ambientAnimations,
      (el, on) => {
        const input = el.querySelector('input');
        if (input) input.checked = on;
        el.dataset.setting = 'ambientAnimations';
      },
    ),
    live(
      toggle(
        'High-contrast table',
        store.state.settings.highContrastTable,
        (v) => store.dispatch({ type: 'UPDATE_SETTINGS', patch: { highContrastTable: v } }),
        'Shades the board so cards stand out',
      ),
      (st) => st.settings.highContrastTable,
      (el, on) => {
        const input = el.querySelector('input');
        if (input) input.checked = on;
        el.dataset.setting = 'highContrastTable';
      },
    ),
  );
}
