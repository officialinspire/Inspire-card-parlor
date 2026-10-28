import { Deck, Hand, Pile, Random, Table } from '@/engine';
import type { GameId } from '@/core/types';

/*
 * Opening deals for every mode. These only set up the table (piles, dealing,
 * facing); the rules engines that play on them come with each game.
 */

export interface SetupOptions {
  seed?: number;
}

export function setupKlondike(opts: SetupOptions & { drawCount?: 1 | 3 } = {}): Table {
  const t = new Table('klondike', new Random(opts.seed));
  const deck = Deck.standard().shuffle(t.random);
  const tableau = Array.from({ length: 7 }, (_, i) => t.add(new Pile(`tableau:${i}`, 'tableau', 'fan-down')));
  // Classic deal: row by row, left to right, one card short each row.
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) tableau[col]!.push(...deck.draw(1, col === row));
  }
  for (let i = 0; i < 4; i++) t.add(new Pile(`foundation:${i}`, 'foundation'));
  t.add(new Pile('stock', 'stock', 'stack', deck.draw(deck.size).reverse()));
  t.add(new Pile('waste', 'waste', 'fan-right'));
  t.data = { drawCount: opts.drawCount ?? 1, passes: 0 };
  return t;
}

export function setupSpider(opts: SetupOptions & { suits?: 1 | 2 | 4 } = {}): Table {
  const t = new Table('spider', new Random(opts.seed));
  const deck = Deck.spider(opts.suits ?? 4).shuffle(t.random);
  const tableau = Array.from({ length: 10 }, (_, i) => t.add(new Pile(`tableau:${i}`, 'tableau', 'fan-down')));
  // 54 cards: the first four columns get six, the rest five; only the top card shows.
  deck.deal(tableau, [6, 6, 6, 6, 5, 5, 5, 5, 5, 5], { revealLast: true });
  t.add(new Pile('stock', 'stock', 'stack', deck.draw(deck.size).reverse()));
  for (let i = 0; i < 8; i++) t.add(new Pile(`foundation:${i}`, 'foundation'));
  t.data = { suits: opts.suits ?? 4 };
  return t;
}

export function setupFreeCell(opts: SetupOptions = {}): Table {
  const t = new Table('freecell', new Random(opts.seed));
  const deck = Deck.standard().shuffle(t.random);
  const tableau = Array.from({ length: 8 }, (_, i) => t.add(new Pile(`tableau:${i}`, 'tableau', 'fan-down')));
  deck.deal(tableau, [7, 7, 7, 7, 6, 6, 6, 6], { faceUp: true });
  for (let i = 0; i < 4; i++) t.add(new Pile(`cell:${i}`, 'cell'));
  for (let i = 0; i < 4; i++) t.add(new Pile(`foundation:${i}`, 'foundation'));
  return t;
}

export function setupWar(opts: SetupOptions & { players?: string[] } = {}): Table {
  const players = opts.players ?? ['player', 'cpu'];
  const t = new Table('war', new Random(opts.seed));
  const deck = Deck.standard().shuffle(t.random);
  const hands = players.map((p) => t.add(new Hand(p)));
  // Deal the whole deck face down; uneven counts go to the first players.
  const base = Math.floor(deck.size / hands.length);
  deck.deal(
    hands,
    hands.map((_, i) => base + (i < deck.size % hands.length ? 1 : 0)),
  );
  for (const h of hands) {
    h.layout = 'stack';
    t.add(new Pile(`battle:${h.owner}`, 'pile', 'spread'));
    t.add(new Pile(`won:${h.owner}`, 'pile'));
  }
  return t;
}

export function setupGoFish(opts: SetupOptions & { players?: string[] } = {}): Table {
  const players = opts.players ?? ['player', 'cpu'];
  if (players.length < 2 || players.length > 6) throw new RangeError('Go Fish needs 2–6 players');
  const t = new Table('go-fish', new Random(opts.seed));
  const deck = Deck.standard().shuffle(t.random);
  const hands = players.map((p) => t.add(new Hand(p)));
  deck.deal(hands, players.length <= 3 ? 7 : 5);
  // Only the human player's hand is face up.
  hands[0]!.setFaceUp(true);
  for (const p of players) t.add(new Pile(`books:${p}`, 'book', 'spread'));
  t.add(new Pile('pond', 'pond', 'spread', deck.draw(deck.size)));
  return t;
}

export const SETUPS: Record<GameId, (opts?: SetupOptions) => Table> = {
  klondike: setupKlondike,
  spider: setupSpider,
  freecell: setupFreeCell,
  war: setupWar,
  'go-fish': setupGoFish,
};
