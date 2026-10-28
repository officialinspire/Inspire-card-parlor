import { describe, expect, it } from 'vitest';
import { Card, Table, parseCardCode, type Pile } from '@/engine';
import { KlondikeGame } from '@/games/solitaire/KlondikeGame';
import { SpiderGame } from '@/games/solitaire/SpiderGame';
import { FreeCellGame } from '@/games/solitaire/FreeCellGame';
import type { SolitaireGame } from '@/games/solitaire/SolitaireGame';

let copy = 0;
/** "QH" face up, "qh" face down (lowercase = face down). Listed bottom → top. */
const cards = (...codes: string[]) =>
  codes.map((code) => {
    const { rank, suit } = parseCardCode(code.toUpperCase())!;
    return new Card(rank, suit, 1000 + copy++, code !== code.toLowerCase() || /^\d+$/.test(code));
  });
const up = (...codes: string[]) => cards(...codes).map((c) => c.flip(true));

/** Replace the contents of every pile; unspecified piles become empty. */
function setBoard(g: SolitaireGame, piles: Record<string, Card[]>): void {
  for (const p of g.table.piles.values()) p.clear();
  for (const [id, cs] of Object.entries(piles)) g.pile(id).push(...cs);
  g.data.actions = [];
  g.table.history.length = 0;
  g.data.won = false;
}

const codes = (p: Pile) => p.all.map((c) => c.code);
const snapshot = (g: SolitaireGame) => JSON.stringify([...g.table.piles.values()].map((p) => p.toJSON()));

describe('Klondike', () => {
  it('deals seven columns, 24 in stock, one face-up card per column', () => {
    const g = KlondikeGame.create({ seed: 1 });
    expect(g.tableau.map((p) => p.size)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(g.tableau.every((p) => p.faceUpCount === 1)).toBe(true);
    expect(g.stock.size).toBe(24);
    expect(g.foundations).toHaveLength(4);
  });

  it('is reproducible from a seed', () => {
    const a = KlondikeGame.create({ seed: 42 });
    const b = KlondikeGame.create({ seed: 42 });
    expect(snapshot(a)).toBe(snapshot(b));
    expect(snapshot(KlondikeGame.create({ seed: 43 }))).not.toBe(snapshot(a));
  });

  it('draw 1 turns one card; draw 3 turns three, and only the top waste card plays', () => {
    const one = KlondikeGame.create({ seed: 2, draw: 1 });
    one.stockAction();
    expect(one.waste.size).toBe(1);
    expect(one.waste.top!.faceUp).toBe(true);

    const three = KlondikeGame.create({ seed: 2, draw: 3 });
    const top3 = three.stock
      .peek(3)
      .reverse()
      .map((c) => c.id);
    three.stockAction();
    expect(three.waste.all.map((c) => c.id)).toEqual(top3);
    expect(three.canPick(three.waste, 2)).toBe(true);
    expect(three.canPick(three.waste, 1)).toBe(false);
    expect(three.canPick(three.waste, 0)).toBe(false);
  });

  it('draw 3 turns fewer cards when the stock runs low, then recycles the waste in order', () => {
    const g = KlondikeGame.create({ seed: 3, draw: 3 });
    const order = [...g.stock.all].reverse().map((c) => c.id); // draw order
    for (let i = 0; i < 8; i++) g.stockAction(); // 24 cards = 8 draws
    expect(g.stock.isEmpty).toBe(true);
    expect(g.waste.size).toBe(24);
    g.stockAction(); // recycle
    expect(g.waste.isEmpty).toBe(true);
    expect([...g.stock.all].reverse().map((c) => c.id)).toEqual(order);
    expect(g.stock.all.every((c) => !c.faceUp)).toBe(true);
    expect(g.data.passes).toBe(1);
  });

  it('builds down in alternating colours and rejects everything else', () => {
    const g = KlondikeGame.create({ seed: 1 });
    setBoard(g, {
      'tableau:0': up('9C'),
      'tableau:1': up('8H'),
      'tableau:2': up('8S'),
      'tableau:3': up('7D'),
      'tableau:4': [],
    });
    expect(g.move({ from: 'tableau:2', index: 0, to: 'tableau:0' })).toBe(false); // same colour
    expect(g.lastReject).toBe('illegal-drop');
    expect(g.move({ from: 'tableau:3', index: 0, to: 'tableau:0' })).toBe(false); // wrong rank
    expect(g.move({ from: 'tableau:1', index: 0, to: 'tableau:4' })).toBe(false); // only Kings to empty
    expect(g.move({ from: 'tableau:1', index: 0, to: 'tableau:0' })).toBe(true);
    expect(codes(g.pile('tableau:0'))).toEqual(['9C', '8H']);
  });

  it('moves valid runs together, never broken or face-down ones', () => {
    const g = KlondikeGame.create({ seed: 1 });
    setBoard(g, {
      'tableau:0': [...cards('2c'), ...up('10D', '9S', '8H')],
      'tableau:1': up('JC'),
      'tableau:2': up('5S', '4D', '4C'), // broken run at the top
      'tableau:3': up('6H'),
    });
    expect(g.canPick(g.pile('tableau:0'), 0)).toBe(false); // face down
    expect(g.canPick(g.pile('tableau:2'), 0)).toBe(false); // not a valid run
    expect(g.move({ from: 'tableau:2', index: 0, to: 'tableau:3' })).toBe(false);
    expect(g.move({ from: 'tableau:0', index: 1, to: 'tableau:1' })).toBe(true);
    expect(codes(g.pile('tableau:1'))).toEqual(['JC', '10D', '9S', '8H']);
    // The face-down card left behind was turned up.
    expect(g.pile('tableau:0').top!.faceUp).toBe(true);
  });

  it('lets a King (or King run) into an empty column', () => {
    const g = KlondikeGame.create({ seed: 1 });
    setBoard(g, { 'tableau:0': up('KH', 'QS'), 'tableau:1': [] });
    expect(g.move({ from: 'tableau:0', index: 0, to: 'tableau:1' })).toBe(true);
  });

  it('builds foundations up by suit from the Ace', () => {
    const g = KlondikeGame.create({ seed: 1 });
    setBoard(g, { 'tableau:0': up('2H'), 'tableau:1': up('AH'), 'tableau:2': up('2S'), waste: up('3H') });
    expect(g.move({ from: 'tableau:0', index: 0, to: 'foundation:0' })).toBe(false); // needs the Ace
    expect(g.move({ from: 'tableau:1', index: 0, to: 'foundation:0' })).toBe(true);
    expect(g.move({ from: 'tableau:2', index: 0, to: 'foundation:0' })).toBe(false); // wrong suit
    expect(g.move({ from: 'tableau:0', index: 0, to: 'foundation:0' })).toBe(true);
    expect(g.move({ from: 'waste', index: 0, to: 'foundation:0' })).toBe(true);
    expect(codes(g.pile('foundation:0'))).toEqual(['AH', '2H', '3H']);
    expect(g.data.score).toBe(30);
  });

  it('rejects multi-card drops on foundations and moves out of the stock', () => {
    const g = KlondikeGame.create({ seed: 1 });
    setBoard(g, { 'tableau:0': up('2H', 'AS'), 'foundation:0': up('AH'), stock: cards('5c') });
    expect(g.move({ from: 'tableau:0', index: 0, to: 'foundation:0' })).toBe(false);
    expect(g.move({ from: 'stock', index: 0, to: 'tableau:1' })).toBe(false);
    expect(g.move({ from: 'tableau:0', index: 1, to: 'tableau:0' })).toBe(false);
    expect(g.lastReject).toBe('same-pile');
    // Shuffling between foundations is never allowed.
    expect(g.move({ from: 'foundation:0', index: 0, to: 'foundation:1' })).toBe(false);
  });

  it('allows a foundation card back onto the tableau', () => {
    const g = KlondikeGame.create({ seed: 1 });
    setBoard(g, { 'foundation:0': up('AS', '2S'), 'tableau:0': up('3H') });
    expect(g.move({ from: 'foundation:0', index: 1, to: 'tableau:0' })).toBe(true);
    expect(g.data.score).toBe(-15);
  });

  it('undoes moves, reveals, draws and recycles exactly', () => {
    const g = KlondikeGame.create({ seed: 5, draw: 3 });
    const start = snapshot(g);
    g.stockAction();
    g.stockAction();
    const afterDraws = snapshot(g);
    for (let i = 0; i < 6; i++) g.stockAction(); // empty the stock
    g.stockAction(); // recycle
    g.undo(); // un-recycle
    g.undo();
    g.undo();
    g.undo();
    g.undo();
    g.undo();
    g.undo();
    expect(snapshot(g)).toBe(afterDraws);
    g.undo();
    g.undo();
    expect(snapshot(g)).toBe(start);
    expect(g.undo()).toBe(false);

    setBoard(g, { 'tableau:0': [...cards('9d'), ...up('8C')], 'tableau:1': up('9H') });
    const before = snapshot(g);
    g.move({ from: 'tableau:0', index: 1, to: 'tableau:1' });
    expect(g.pile('tableau:0').top!.faceUp).toBe(true);
    g.undo();
    expect(snapshot(g)).toBe(before);
    expect(g.pile('tableau:0').at(0)!.faceUp).toBe(false); // hidden again
  });

  it('gives hints that are legal moves, falling back to the stock', () => {
    const g = KlondikeGame.create({ seed: 1 });
    setBoard(g, {
      'tableau:0': [...cards('3d'), ...up('8C')],
      'tableau:1': up('9H'),
      'tableau:2': up('AS'),
      stock: cards('5c'),
    });
    expect(g.hint()).toEqual({ kind: 'move', from: 'tableau:2', index: 0, to: 'foundation:0' });
    g.move({ from: 'tableau:2', index: 0, to: 'foundation:0' });
    expect(g.hint()).toEqual({ kind: 'move', from: 'tableau:0', index: 1, to: 'tableau:1' });
    g.move({ from: 'tableau:0', index: 1, to: 'tableau:1' });
    expect(g.hint()).toEqual({ kind: 'stock' });
    for (let seed = 1; seed <= 20; seed++) {
      const k = KlondikeGame.create({ seed });
      const h = k.hint();
      if (h?.kind === 'move') expect(k.canMove(h)).toBe(true);
    }
  });

  it('auto-finishes and detects the win', () => {
    const g = KlondikeGame.create({ seed: 1 });
    // Every card face up in four King→Ace columns, alternating colours.
    const col = (a: string, b: string) =>
      up(...['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'].map((r, i) => r + (i % 2 ? b : a)));
    setBoard(g, {
      'tableau:0': col('S', 'H'),
      'tableau:1': col('H', 'S'),
      'tableau:2': col('C', 'D'),
      'tableau:3': col('D', 'C'),
    });
    expect(g.isWon).toBe(false);
    expect(g.canAutoFinish).toBe(true);
    let steps = 0;
    while (g.autoFinishStep()) steps++;
    expect(steps).toBe(52);
    expect(g.isWon).toBe(true);
    expect(g.data.won).toBe(true);
    expect(g.canAutoFinish).toBe(false);
    expect(g.move({ from: 'foundation:0', index: 12, to: 'tableau:0' })).toBe(false);
    expect(g.lastReject).toBe('game-over');
  });

  it('cannot auto-finish while cards are hidden or in the stock', () => {
    const g = KlondikeGame.create({ seed: 1 });
    expect(g.canAutoFinish).toBe(false);
  });

  it('saves and restores mid-game, including undo history', () => {
    const g = KlondikeGame.create({ seed: 9, draw: 1 });
    g.stockAction();
    const h = g.hint();
    if (h?.kind === 'move') g.move(h);
    g.tick(12_000);
    const r = KlondikeGame.restore(Table.restore(JSON.parse(JSON.stringify(g.table.snapshot()))));
    expect(snapshot(r)).toBe(snapshot(g));
    expect(r.data.elapsedMs).toBe(12_000);
    expect(r.data.moves).toBe(g.data.moves);
    r.undo();
    g.undo();
    expect(snapshot(r)).toBe(snapshot(g));
  });
});

describe('Spider', () => {
  it.each([1, 2, 4] as const)('deals %i-suit games from two decks', (suits) => {
    const g = SpiderGame.create({ seed: 1, suits });
    expect(g.table.cardCount).toBe(104);
    expect(g.tableau.map((p) => p.size)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    expect(g.tableau.every((p) => p.faceUpCount === 1)).toBe(true);
    expect(g.stock.size).toBe(50);
    const all = [...g.table.piles.values()].flatMap((p) => p.all);
    expect(new Set(all.map((c) => c.suit)).size).toBe(suits);
    expect(new Set(all.map((c) => c.id)).size).toBe(104);
    expect(g.data.score).toBe(500);
  });

  it('places any card on one rank higher, but moves only same-suit runs', () => {
    const g = SpiderGame.create({ seed: 1, suits: 4 });
    setBoard(g, {
      'tableau:0': up('9C', '8C', '7H'), // 8C-7H is a mixed run
      'tableau:1': up('9D', '8D', '7D'),
      'tableau:2': up('9H'),
      'tableau:3': up('8S'),
      'tableau:4': [],
    });
    expect(g.canPick(g.pile('tableau:0'), 1)).toBe(false); // mixed suits
    expect(g.move({ from: 'tableau:0', index: 1, to: 'tableau:2' })).toBe(false);
    expect(g.canPick(g.pile('tableau:1'), 1)).toBe(true);
    expect(g.move({ from: 'tableau:1', index: 1, to: 'tableau:2' })).toBe(true); // 8D-7D onto 9H: any suit
    expect(g.move({ from: 'tableau:3', index: 0, to: 'tableau:0' })).toBe(false); // 8 on 7
    expect(g.move({ from: 'tableau:0', index: 2, to: 'tableau:4' })).toBe(true); // anything to empty
    expect(g.move({ from: 'tableau:2', index: 0, to: 'foundation:0' })).toBe(false); // no manual foundation moves
  });

  it('deals ten face-up cards, but not with an empty column or empty stock', () => {
    const g = SpiderGame.create({ seed: 3, suits: 1 });
    const before = g.tableau.map((p) => p.size);
    expect(g.stockAction()).toBe(true);
    expect(g.tableau.map((p) => p.size)).toEqual(before.map((n) => n + 1));
    expect(g.tableau.every((p) => p.top!.faceUp)).toBe(true);
    expect(g.stock.size).toBe(40);

    g.pile('tableau:5').clear();
    expect(g.stockAction()).toBe(false);
    expect(g.lastDealBlock).toBe('empty-column');

    setBoard(g, { 'tableau:0': up('5S') });
    for (let i = 1; i < 10; i++) g.pile(`tableau:${i}`).push(...up('2S'));
    expect(g.stockAction()).toBe(false);
    expect(g.lastDealBlock).toBe('empty-stock');
  });

  it('removes a completed King→Ace run and turns up the card beneath', () => {
    const g = SpiderGame.create({ seed: 1, suits: 1 });
    const run = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].map((r) => r + 'S');
    setBoard(g, { 'tableau:0': [...cards('4h'), ...up(...run)], 'tableau:1': up('AS') });
    const score = g.data.score;
    expect(g.move({ from: 'tableau:1', index: 0, to: 'tableau:0' })).toBe(true);
    expect(g.completedRuns).toBe(1);
    expect(g.pile('foundation:0').size).toBe(13);
    expect(codes(g.pile('tableau:0'))).toEqual(['4H']);
    expect(g.pile('tableau:0').top!.faceUp).toBe(true);
    expect(g.data.score).toBe(score - 1 + 100);

    g.undo(); // one undo restores the run and the hidden card
    expect(g.completedRuns).toBe(0);
    expect(g.pile('tableau:0').size).toBe(13);
    expect(g.pile('tableau:0').at(0)!.faceUp).toBe(false);
    expect(g.pile('tableau:1').size).toBe(1);
    expect(g.data.score).toBe(score);
  });

  it('a deal can complete a run', () => {
    const g = SpiderGame.create({ seed: 1, suits: 1 });
    const run = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].map((r) => r + 'S');
    setBoard(g, { 'tableau:0': up(...run), stock: up(...Array(9).fill('5S'), 'AS').map((c) => c.flip(false)) });
    for (let i = 1; i < 10; i++) g.pile(`tableau:${i}`).push(...up('9S'));
    // The stock top goes to column 0 first.
    expect(g.stock.top!.code).toBe('AS');
    g.stockAction();
    expect(g.completedRuns).toBe(1);
  });

  it('is won when all eight runs are complete', () => {
    const g = SpiderGame.create({ seed: 1, suits: 1 });
    const run = (n: number) =>
      up(...['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'].map((r) => r + 'S')).slice(0, n);
    setBoard(g, Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`foundation:${i}`, run(13)])));
    g.pile('tableau:0').push(...run(12));
    g.pile('tableau:1').push(...up('AS'));
    expect(g.isWon).toBe(false);
    g.move({ from: 'tableau:1', index: 0, to: 'tableau:0' });
    expect(g.isWon).toBe(true);
    expect(g.data.won).toBe(true);
    expect(g.stockAction()).toBe(false);
  });

  it('hints legal moves or a deal', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const g = SpiderGame.create({ seed, suits: 2 });
      const h = g.hint();
      expect(h).not.toBeNull();
      if (h!.kind === 'move') expect(g.canMove(h!)).toBe(true);
    }
  });

  it('round-trips through a save', () => {
    const g = SpiderGame.create({ seed: 4, suits: 2 });
    g.stockAction();
    const r = SpiderGame.restore(Table.restore(JSON.parse(JSON.stringify(g.table.snapshot()))));
    expect(r.suits).toBe(2);
    expect(snapshot(r)).toBe(snapshot(g));
    r.undo();
    expect(r.stock.size).toBe(50);
  });
});

describe('FreeCell', () => {
  it('deals all 52 cards face up into eight columns', () => {
    const g = FreeCellGame.create({ seed: 1 });
    expect(g.tableau.map((p) => p.size)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(g.tableau.every((p) => p.all.every((c) => c.faceUp))).toBe(true);
    expect(g.cells.every((c) => c.isEmpty)).toBe(true);
  });

  it('computes multi-card capacity from free cells and empty columns', () => {
    const g = FreeCellGame.create({ seed: 1 });
    setBoard(g, { 'tableau:0': up('9C'), 'tableau:1': up('8H'), 'tableau:2': up('5S') });
    const target = g.pile('tableau:0');
    const empty = g.pile('tableau:7');
    // 4 free cells, 5 empty columns (3..7).
    expect(g.capacity(target)).toBe(5 * 2 ** 5);
    // Moving into an empty column: that column does not count.
    expect(g.capacity(empty)).toBe(5 * 2 ** 4);
    g.pile('cell:0').push(...up('2D'));
    g.pile('cell:1').push(...up('3D'));
    g.pile('cell:2').push(...up('4D'));
    for (let i = 3; i < 8; i++) g.pile(`tableau:${i}`).push(...up('KD'));
    expect(g.capacity(target)).toBe(2); // (1 + 1) × 2^0
  });

  it('rejects runs longer than the capacity', () => {
    const g = FreeCellGame.create({ seed: 1 });
    const fill = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`tableau:${i + 3}`, up('KD')]));
    setBoard(g, {
      ...fill,
      'tableau:0': up('10S', '9H', '8C', '7D'), // 3-card run 9H-8C-7D
      'tableau:1': up('10D'),
      'tableau:2': up('2C'),
      'cell:0': up('2H'),
      'cell:1': up('3H'),
    });
    // 2 free cells, 0 empty columns → capacity 3.
    expect(g.move({ from: 'tableau:0', index: 1, to: 'tableau:1' })).toBe(false); // 9H on 10D: same colour
    g.pile('tableau:1').clear();
    g.pile('tableau:1').push(...up('10C'));
    expect(g.move({ from: 'tableau:0', index: 0, to: 'tableau:1' })).toBe(false); // not a valid run start
    g.pile('cell:2').push(...up('4H')); // capacity now 2
    expect(g.move({ from: 'tableau:0', index: 1, to: 'tableau:1' })).toBe(false);
    expect(g.lastReject).toBe('not-pickable');
    g.pile('cell:2').clear(); // capacity 3 again
    expect(g.move({ from: 'tableau:0', index: 1, to: 'tableau:1' })).toBe(true);
    expect(codes(g.pile('tableau:1'))).toEqual(['10C', '9H', '8C', '7D']);
  });

  it('free cells hold exactly one card; any card can go to an empty column', () => {
    const g = FreeCellGame.create({ seed: 1 });
    setBoard(g, { 'tableau:0': up('5S', '4H'), 'tableau:1': up('QD') });
    expect(g.move({ from: 'tableau:0', index: 0, to: 'cell:0' })).toBe(false); // two cards
    expect(g.move({ from: 'tableau:0', index: 1, to: 'cell:0' })).toBe(true);
    expect(g.move({ from: 'tableau:0', index: 0, to: 'cell:0' })).toBe(false); // occupied
    expect(g.data.usedCell).toBe(true);
    expect(g.move({ from: 'tableau:1', index: 0, to: 'tableau:5' })).toBe(true);
    expect(g.move({ from: 'cell:0', index: 0, to: 'tableau:0' })).toBe(true); // 4H on 5S
  });

  it('cell cards go back to the tableau when legal', () => {
    const g = FreeCellGame.create({ seed: 1 });
    setBoard(g, { 'tableau:0': up('5S'), 'cell:0': up('4H'), 'cell:1': up('4C') });
    expect(g.move({ from: 'cell:1', index: 0, to: 'tableau:0' })).toBe(false); // black on black
    expect(g.move({ from: 'cell:0', index: 0, to: 'tableau:0' })).toBe(true);
  });

  it('foundations build by suit and never give cards back', () => {
    const g = FreeCellGame.create({ seed: 1 });
    setBoard(g, { 'tableau:0': up('2C', 'AC'), 'tableau:1': up('3D') });
    expect(g.move({ from: 'tableau:0', index: 0, to: 'foundation:0' })).toBe(false);
    expect(g.move({ from: 'tableau:0', index: 1, to: 'foundation:0' })).toBe(true);
    expect(g.move({ from: 'tableau:0', index: 0, to: 'foundation:0' })).toBe(true);
    expect(g.canPick(g.pile('foundation:0'), 1)).toBe(false);
    expect(g.move({ from: 'tableau:1', index: 0, to: 'foundation:0' })).toBe(false);
  });

  it('undoes and hints', () => {
    const g = FreeCellGame.create({ seed: 11 });
    const start = snapshot(g);
    const moves: number[] = [];
    for (let i = 0; i < 5; i++) {
      const h = g.hint();
      if (!h || h.kind !== 'move') break;
      expect(g.canMove(h)).toBe(true);
      g.move(h);
      moves.push(i);
    }
    expect(moves.length).toBeGreaterThan(0);
    while (g.undo());
    expect(snapshot(g)).toBe(start);
  });

  it('detects the win', () => {
    const g = FreeCellGame.create({ seed: 1 });
    const suit = (s: string) =>
      up(...['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map((r) => r + s));
    setBoard(g, {
      'foundation:0': suit('S'),
      'foundation:1': suit('H'),
      'foundation:2': suit('D'),
      'foundation:3': suit('C').slice(0, 12),
      'cell:3': up('KC'),
    });
    expect(g.isWon).toBe(false);
    expect(g.move({ from: 'cell:3', index: 0, to: 'foundation:3' })).toBe(true);
    expect(g.isWon).toBe(true);
    expect(g.canUndo).toBe(false);
  });
});

describe('every engine rejects impossible moves without changing anything', () => {
  const games: [string, () => SolitaireGame][] = [
    ['klondike', () => KlondikeGame.create({ seed: 21 })],
    ['spider', () => SpiderGame.create({ seed: 21, suits: 4 })],
    ['freecell', () => FreeCellGame.create({ seed: 21 })],
  ];
  it.each(games)('%s', (_name, make) => {
    const g = make();
    const legal = new Set(g.legalMoves().map((m) => `${m.from}|${m.index}|${m.to}`));
    const before = snapshot(g);
    let rejected = 0;
    for (const from of g.table.piles.values()) {
      for (let index = 0; index < from.size; index++) {
        for (const to of g.table.piles.values()) {
          const m = { from: from.id, index, to: to.id };
          if (legal.has(`${m.from}|${m.index}|${m.to}`)) continue;
          expect(g.move(m)).toBe(false);
          rejected++;
        }
      }
    }
    expect(rejected).toBeGreaterThan(100);
    expect(snapshot(g)).toBe(before);
    expect(g.data.moves).toBe(0);
    expect(g.move({ from: 'nope', index: 0, to: 'tableau:0' })).toBe(false);
  });
});
