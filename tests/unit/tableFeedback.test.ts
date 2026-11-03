import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Store } from '@/core/store';
import { deckThemes } from '@/decks';
import { gameToolbar } from '@/components/gameToolbar';
import { attachDialogs } from '@/components/Dialog';
import { KlondikeGame } from '@/games/solitaire/KlondikeGame';
import { FreeCellGame } from '@/games/solitaire/FreeCellGame';
import { SpiderGame } from '@/games/solitaire/SpiderGame';
import type { SolitaireGame } from '@/games/solitaire/SolitaireGame';
import { mountSolitaire } from '@/games/solitaire/SolitaireView';

/**
 * Table behaviour reproduced in a mounted view (upgrade series): each test
 * here was written against the reported behaviour first.
 */

/** A Klondike deal with every card face up on the tableau: ready for Auto-finish. */
function readyToFinish(): KlondikeGame {
  const g = KlondikeGame.create({ seed: 11 });
  const t = g.table;
  // Gather every card, then lay out four columns of one suit each, King down to Ace.
  const all = [...t.piles.values()].flatMap((p) => p.clear());
  const bySuit = new Map<string, typeof all>();
  for (const c of all) bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c]);
  // Alternate colours are not needed for Auto-finish: each card goes straight up from the column's top.
  [...bySuit.values()].forEach((cards, i) => {
    const col = t.pile(`tableau:${i}`);
    for (const c of cards.sort((a, b) => b.rank - a.rank)) {
      c.faceUp = true;
      col.push(c);
    }
  });
  return g;
}

// happy-dom does no layout: give the board a size so the view measures and draws.
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 390 });
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 700 });

function mount(game: SolitaireGame, reducedMotion = false) {
  const store = new Store();
  store.dispatch({ type: 'UPDATE_SETTINGS', patch: { reducedMotion } });
  const dialogs = document.createElement('div');
  document.body.append(dialogs);
  attachDialogs(dialogs, store);
  const surface = document.createElement('div');
  const hud = document.createElement('div');
  document.body.append(surface, hud);
  const tools = gameToolbar(store, { onSettings: () => undefined, onHome: () => undefined });
  const view = mountSolitaire({
    store,
    surface,
    hud,
    tools,
    theme: deckThemes.resolve('fredericksburg'),
    game,
    onNewGame: () => undefined,
    onRestart: () => undefined,
    onExit: () => undefined,
  });
  const btn = (action: string) => tools.el.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  return { view, store, tools, btn, surface };
}

const onFoundations = (g: KlondikeGame) => g.foundations.reduce((n, f) => n + f.size, 0);

describe('Klondike auto-finish', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('stops moving cards while the table is paused, and carries on after Resume', async () => {
    const game = readyToFinish();
    expect(game.canAutoFinish).toBe(true);
    const { btn, view } = mount(game);
    await vi.advanceTimersByTimeAsync(3000); // the opening deal
    btn('auto-finish').click();
    await vi.advanceTimersByTimeAsync(400);
    const before = onFoundations(game);
    expect(before).toBeGreaterThan(0);
    btn('pause').click();
    await vi.advanceTimersByTimeAsync(3000);
    expect(onFoundations(game)).toBe(before);
    expect(game.data.won).toBe(false);
    btn('pause').click(); // Resume
    await vi.advanceTimersByTimeAsync(10_000);
    expect(game.data.won).toBe(true);
    view.destroy();
  });

  it('marks every finished foundation with a ✓, with reduced motion too', async () => {
    const game = readyToFinish();
    const { btn, view, surface } = mount(game, true);
    btn('auto-finish').click();
    await vi.advanceTimersByTimeAsync(5000);
    expect(game.data.won).toBe(true);
    expect([...surface.querySelectorAll('.sol-done')].filter((m) => !(m as HTMLElement).hidden)).toHaveLength(4);
    view.destroy();
  });
});

describe('why a move is refused', () => {
  it('Klondike explains empty columns and foundations, naming only face-up cards', () => {
    const g = KlondikeGame.create({ seed: 3 });
    const t = g.table;
    // An empty column, and a non-King face-up card to aim at it.
    const col = t.pile('tableau:0');
    const moved = col.clear();
    t.pile('tableau:6').push(...moved);
    const from = [...g.tableau].find((p) => p.top && p.top.faceUp && p.top.rank !== 13 && p.id !== 'tableau:0')!;
    expect(g.explain({ from: from.id, index: from.size - 1, to: 'tableau:0' })).toBe(
      'Only a King can fill an empty column.',
    );
    if (from.top!.rank !== 1)
      expect(g.explain({ from: from.id, index: from.size - 1, to: 'foundation:0' })).toBe(
        'Foundations start with an Ace.',
      );
    // A face-down card is described only as face down.
    const hidden = [...g.tableau].find((p) => p.size > 1 && !p.at(0)!.faceUp)!;
    expect(g.whyNotPick(hidden.id, 0)).toBe('That card is face down.');
    // Legal moves need no explanation.
    for (const m of g.legalMoves()) expect(g.explain(m)).toBeNull();
  });

  it('FreeCell explains taken cells and how many cards may move', () => {
    const g = FreeCellGame.create({ seed: 1 });
    const a = g.tableau[0]!;
    const b = g.tableau[1]!;
    expect(g.move({ from: a.id, index: a.size - 1, to: 'cell:0' })).toBe(true);
    expect(g.explain({ from: b.id, index: b.size - 1, to: 'cell:0' })).toBe('That free cell is taken.');
    expect(g.explain({ from: b.id, index: b.size - 2, to: 'cell:1' })).toMatch(
      /free cell holds one card|can move|alternating/,
    );
  });

  it('Spider explains its building rule', () => {
    const g = SpiderGame.create({ seed: 2, suits: 1 });
    const cols = g.tableau;
    let found: string | null = null;
    for (const a of cols)
      for (const b of cols) {
        if (a === b || !a.top || !b.top) continue;
        if (b.top.rank !== a.top.rank + 1) {
          found = g.explain({ from: a.id, index: a.size - 1, to: b.id });
          break;
        }
      }
    expect(found).toMatch(/one rank higher/);
  });
});

describe('Spider dealing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('a second deal key while a row is still landing is ignored; a later one deals', async () => {
    const game = SpiderGame.create({ seed: 4, suits: 1 });
    const { view } = mount(game, true);
    const stock = () => game.pile('stock').size;
    const before = stock();
    const key = () => dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    key();
    key();
    expect(stock()).toBe(before - 10);
    await vi.advanceTimersByTimeAsync(600);
    key();
    expect(stock()).toBe(before - 20);
    // Undo still takes back one deal at a time.
    expect(game.undo()).toBe(true);
    expect(stock()).toBe(before - 10);
    view.destroy();
  });
});
