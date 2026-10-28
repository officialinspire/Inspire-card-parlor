import { describe, expect, it } from 'vitest';
import {
  ALL_CARD_CODES,
  Card,
  Deck,
  Hand,
  Pile,
  Random,
  SaveStore,
  SnapshotError,
  Table,
  ascendingSameSuit,
  compareAceHigh,
  descendingAlternating,
  descendingSameSuit,
  fisherYates,
  isCompleteRun,
  isSequence,
  maxSupermove,
  memorySaveBackend,
  moveCards,
  parseCardCode,
  topRunLength,
  undoMove,
  validateSnapshot,
  type Rank,
  type Suit,
} from '@/engine';
import { SETUPS, setupFreeCell, setupGoFish, setupKlondike, setupSpider, setupWar } from '@/games/setups';

const c = (rank: Rank, suit: Suit, up = true) => new Card(rank, suit, 0, up);
const ids = (cards: readonly Card[]) => cards.map((x) => x.id);

describe('Card', () => {
  it('has codes, colours and labels', () => {
    const q = c(12, 'hearts');
    expect(q.code).toBe('QH');
    expect(q.color).toBe('red');
    expect(q.label).toBe('Queen of Hearts');
    expect(q.shortLabel).toBe('Q♥');
    expect(c(10, 'clubs').code).toBe('10C');
    expect(c(1, 'spades').color).toBe('black');
  });

  it('round-trips through codes and JSON', () => {
    expect(parseCardCode('10D')).toEqual({ rank: 10, suit: 'diamonds' });
    expect(parseCardCode('1S')).toBeNull();
    const card = new Card(13, 'diamonds', 3, true);
    const copy = Card.fromJSON(JSON.parse(JSON.stringify(card)));
    expect(copy).toMatchObject({ id: '3:KD', rank: 13, suit: 'diamonds', copy: 3, faceUp: true });
  });

  it('rejects invalid cards and flips', () => {
    expect(() => new Card(14 as Rank, 'spades')).toThrow(RangeError);
    const card = c(5, 'spades', false);
    expect(card.flip().faceUp).toBe(true);
    expect(card.flip(true).faceUp).toBe(true);
  });

  it('lists all 52 face codes', () => {
    expect(ALL_CARD_CODES).toHaveLength(52);
    expect(new Set(ALL_CARD_CODES).size).toBe(52);
  });
});

describe('Deck', () => {
  it('builds a standard 52-card deck', () => {
    const d = Deck.standard();
    expect(d.size).toBe(52);
    expect(new Set(ids(d.all)).size).toBe(52);
    expect(new Set(d.all.map((x) => x.code)).size).toBe(52);
  });

  it('builds multiple decks with unique card ids', () => {
    const d = Deck.standard({ copies: 2 });
    expect(d.size).toBe(104);
    expect(new Set(ids(d.all)).size).toBe(104);
    expect(d.all.filter((x) => x.code === 'AS')).toHaveLength(2);
  });

  it.each([
    [1, { spades: 104 }],
    [2, { spades: 52, hearts: 52 }],
    [4, { spades: 26, hearts: 26, diamonds: 26, clubs: 26 }],
  ] as const)('builds Spider decks with %i suit(s)', (suits, counts) => {
    const d = Deck.spider(suits);
    expect(d.size).toBe(104);
    expect(new Set(ids(d.all)).size).toBe(104);
    const bySuit: Record<string, number> = {};
    for (const x of d.all) bySuit[x.suit] = (bySuit[x.suit] ?? 0) + 1;
    expect(bySuit).toEqual(counts);
    // Always eight runs of thirteen ranks.
    for (const rank of [1, 7, 13]) expect(d.all.filter((x) => x.rank === rank)).toHaveLength(8);
  });

  it('shuffles reproducibly from a seed', () => {
    const a = Deck.standard().shuffle(new Random(42));
    const b = Deck.standard().shuffle(new Random(42));
    const other = Deck.standard().shuffle(new Random(43));
    expect(ids(a.all)).toEqual(ids(b.all));
    expect(ids(a.all)).not.toEqual(ids(other.all));
    expect([...ids(a.all)].sort()).toEqual([...ids(Deck.standard().all)].sort());
  });

  it('draws from the top and deals round-robin', () => {
    const d = Deck.standard();
    const top = d.top!;
    const [drawn] = d.draw(1, true);
    expect(drawn).toBe(top);
    expect(drawn!.faceUp).toBe(true);
    expect(d.size).toBe(51);

    const piles = [new Pile('a'), new Pile('b'), new Pile('c')];
    d.deal(piles, [3, 1, 2], { revealLast: true });
    expect(piles.map((p) => p.size)).toEqual([3, 1, 2]);
    expect(piles.every((p) => p.top!.faceUp && p.all.slice(0, -1).every((x) => !x.faceUp))).toBe(true);
    expect(d.size).toBe(45);
    expect(() => d.deal(piles, 100)).toThrow(RangeError);
  });

  it('returns fewer cards when drawing past the end', () => {
    const d = Deck.standard();
    expect(d.draw(60)).toHaveLength(52);
    expect(d.draw()).toEqual([]);
  });
});

describe('Fisher–Yates', () => {
  it('produces a permutation', () => {
    const arr = Array.from({ length: 20 }, (_, i) => i);
    fisherYates(arr, new Random(7));
    expect([...arr].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('is unbiased over many shuffles', () => {
    // Every value should land in every position roughly equally often.
    const n = 4;
    const trials = 24_000;
    const counts = Array.from({ length: n }, () => Array(n).fill(0));
    const rng = new Random(123);
    for (let t = 0; t < trials; t++) {
      const arr = [0, 1, 2, 3];
      fisherYates(arr, rng);
      arr.forEach((v, pos) => counts[v]![pos]++);
    }
    const expected = trials / n;
    for (const row of counts) for (const k of row) expect(Math.abs(k - expected) / expected).toBeLessThan(0.05);
  });

  it('restores RNG state mid-stream', () => {
    const r = new Random(99);
    r.next();
    r.next();
    const resumed = Random.restore(r.seed, r.state);
    expect(resumed.next()).toBe(r.next());
  });
});

describe('Pile', () => {
  it('pushes, peeks, takes and removes', () => {
    const p = new Pile('p', 'tableau', 'fan-down', [c(1, 'spades'), c(2, 'spades'), c(3, 'spades')]);
    expect(p.top!.rank).toBe(3);
    expect(p.peek(2).map((x) => x.rank)).toEqual([2, 3]);
    expect(p.take(2).map((x) => x.rank)).toEqual([2, 3]);
    expect(p.size).toBe(1);
    expect(() => p.take(5)).toThrow(RangeError);
    p.push(c(9, 'hearts'), c(10, 'hearts'));
    expect(p.remove(['0:9H']).map((x) => x.code)).toEqual(['9H']);
    expect(() => p.remove(['0:KD'])).toThrow();
    expect(p.depthOf('0:AS')).toBe(2);
  });

  it('reveals the top card and turns over', () => {
    const p = new Pile('p', 'waste', 'stack', [c(1, 'spades', true), c(2, 'spades', false)]);
    expect(p.revealTop()?.code).toBe('2S');
    expect(p.revealTop()).toBeUndefined();
    expect(p.faceUpCount).toBe(2);
    p.turnOver();
    expect(p.all.map((x) => x.code)).toEqual(['2S', 'AS']);
    expect(p.all.every((x) => !x.faceUp)).toBe(true);
  });
});

describe('moving and stacking', () => {
  it('moves stacks, reveals the source and undoes', () => {
    const from = new Pile('from', 'tableau', 'fan-down', [c(4, 'clubs', false), c(9, 'spades'), c(8, 'hearts')]);
    const to = new Pile('to', 'tableau', 'fan-down', [c(10, 'diamonds')]);
    const rule = (cards: readonly Card[], _f: Pile, t: Pile) =>
      isSequence(cards, descendingAlternating) && (!t.top || descendingAlternating(t.top, cards[0]!));

    expect(moveCards(from, to, 1, { rule })).toBeNull(); // 8♥ cannot go on 10♦
    const move = moveCards(from, to, 2, { rule, revealSource: true })!;
    expect(move).toMatchObject({ from: 'from', to: 'to', cardIds: ['0:9S', '0:8H'], revealed: '0:4C' });
    expect(to.all.map((x) => x.code)).toEqual(['10D', '9S', '8H']);
    expect(from.top!.faceUp).toBe(true);

    undoMove(move, { from, to });
    expect(from.all.map((x) => x.code)).toEqual(['4C', '9S', '8H']);
    expect(from.at(0)!.faceUp).toBe(false);
    expect(to.size).toBe(1);
  });

  it('can force facing and undo it', () => {
    const stock = new Pile('stock', 'stock', 'stack', [c(3, 'hearts', false)]);
    const waste = new Pile('waste', 'waste');
    const move = moveCards(stock, waste, 1, { faceUp: true })!;
    expect(waste.top!.faceUp).toBe(true);
    undoMove(move, { stock, waste });
    expect(stock.top!.faceUp).toBe(false);
  });

  it('describes builds', () => {
    expect(ascendingSameSuit(c(1, 'hearts'), c(2, 'hearts'))).toBe(true);
    expect(ascendingSameSuit(c(1, 'hearts'), c(2, 'spades'))).toBe(false);
    expect(descendingSameSuit(c(9, 'clubs'), c(8, 'clubs'))).toBe(true);
    const run = Array.from({ length: 13 }, (_, i) => c((13 - i) as Rank, 'spades'));
    expect(isCompleteRun(run)).toBe(true);
    expect(isCompleteRun(run.slice(1))).toBe(false);
    expect(
      topRunLength([c(5, 'hearts', false), c(9, 'spades'), c(8, 'hearts'), c(7, 'clubs')], descendingAlternating),
    ).toBe(3);
    expect(compareAceHigh(c(1, 'spades'), c(13, 'hearts'))).toBeGreaterThan(0);
    expect(maxSupermove(2, 1)).toBe(6);
  });
});

describe('Hand', () => {
  it('asks for ranks, finds books and sorts', () => {
    const h = new Hand('me', [
      c(7, 'spades'),
      c(7, 'hearts'),
      c(2, 'clubs'),
      c(7, 'clubs'),
      c(7, 'diamonds'),
      c(9, 'spades'),
    ]);
    expect(h.hasRank(7)).toBe(true);
    expect(h.countRank(7)).toBe(4);
    const books = h.extractBooks();
    expect(books).toHaveLength(1);
    expect(books[0]!.every((x) => x.rank === 7)).toBe(true);
    expect(h.size).toBe(2);
    expect(h.takeRank(9).map((x) => x.code)).toEqual(['9S']);
    expect(h.takeRank(5)).toEqual([]);
    h.push(c(1, 'hearts'));
    expect(h.sort().all.map((x) => x.code)).toEqual(['AH', '2C']);
    expect(Hand.fromJSON(h.toJSON())).toMatchObject({ owner: 'me', size: 2 });
  });
});

describe('game setups', () => {
  const total = (t: Table) => t.cardCount;

  it('deals Klondike: 28 tableau cards with one face up per column', () => {
    const t = setupKlondike({ seed: 1 });
    expect(t.group('tableau:').map((p) => p.size)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const p of t.group('tableau:')) expect(p.faceUpCount).toBe(1);
    expect(t.pile('stock').size).toBe(24);
    expect(total(t)).toBe(52);
  });

  it('deals Spider with two decks: 54 on the table, 50 in stock', () => {
    const t = setupSpider({ seed: 1, suits: 2 });
    expect(t.group('tableau:').map((p) => p.size)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    expect(t.pile('stock').size).toBe(50);
    expect(total(t)).toBe(104);
    expect(t.group('foundation:')).toHaveLength(8);
  });

  it('deals FreeCell all face up with empty cells', () => {
    const t = setupFreeCell({ seed: 1 });
    expect(t.group('tableau:').map((p) => p.size)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(t.group('tableau:').every((p) => p.all.every((x) => x.faceUp))).toBe(true);
    expect(t.group('cell:').every((p) => p.isEmpty)).toBe(true);
  });

  it('splits the deck for War', () => {
    const t = setupWar({ seed: 1 });
    expect(t.pile('hand:player').size).toBe(26);
    expect(t.pile('hand:cpu').size).toBe(26);
    const three = setupWar({ seed: 1, players: ['a', 'b', 'c'] });
    expect(['a', 'b', 'c'].map((p) => three.pile(`hand:${p}`).size)).toEqual([18, 17, 17]);
  });

  it('deals Go Fish hands and a pond', () => {
    const two = setupGoFish({ seed: 1 });
    expect(two.pile('hand:player').size).toBe(7);
    expect(two.pile('hand:player').all.every((x) => x.faceUp)).toBe(true);
    expect(two.pile('hand:cpu').all.every((x) => !x.faceUp)).toBe(true);
    expect(two.pile('pond').size).toBe(38);
    const four = setupGoFish({ seed: 1, players: ['a', 'b', 'c', 'd'] });
    expect(four.pile('hand:a').size).toBe(5);
    expect(() => setupGoFish({ players: ['solo'] })).toThrow();
  });

  it('every mode deals a full deck with unique cards', () => {
    for (const [id, setup] of Object.entries(SETUPS)) {
      const t = setup({ seed: 5 });
      const all = [...t.piles.values()].flatMap((p) => ids(p.all));
      expect(new Set(all).size, id).toBe(all.length);
      expect(all.length, id).toBe(id === 'spider' ? 104 : 52);
    }
  });
});

describe('serialization and saves', () => {
  it('snapshots and restores a table exactly, including RNG and history', () => {
    const t = setupKlondike({ seed: 77 });
    t.move('stock', 'waste', 1, { faceUp: true });
    t.data.score = 15;
    const snap = JSON.parse(JSON.stringify(t.snapshot()));
    const restored = Table.restore(snap);

    for (const [id, p] of t.piles) {
      expect(restored.pile(id).all.map((x) => [x.id, x.faceUp])).toEqual(p.all.map((x) => [x.id, x.faceUp]));
    }
    expect(restored.data.score).toBe(15);
    expect(restored.random.next()).toBe(t.random.next());
    restored.undo();
    expect(restored.pile('waste').size).toBe(0);
    expect(restored.pile('stock').size).toBe(24);
  });

  it('restores hands as Hand objects', () => {
    const t = setupGoFish({ seed: 3 });
    const restored = Table.restore(JSON.parse(JSON.stringify(t.snapshot())));
    expect(restored.pile('hand:player')).toBeInstanceOf(Hand);
    expect(restored.pile<Hand>('hand:cpu').owner).toBe('cpu');
  });

  it('rejects corrupted snapshots', () => {
    const snap = setupFreeCell({ seed: 2 }).snapshot();
    const dup = structuredClone(snap);
    dup.piles[0]!.cards.push(structuredClone(dup.piles[1]!.cards[0]!));
    dup.cardCount++;
    expect(() => validateSnapshot(dup)).toThrow(/appears twice/);

    const lost = structuredClone(snap);
    lost.piles[0]!.cards.pop();
    expect(() => validateSnapshot(lost)).toThrow(/Expected 52/);

    expect(() => validateSnapshot({ ...snap, version: 99 })).toThrow(SnapshotError);
  });

  it('saves to and loads from slots', async () => {
    const saves = new SaveStore(memorySaveBackend());
    const t = setupSpider({ seed: 9, suits: 1 });
    await saves.save(t);
    await saves.save(setupWar({ seed: 1 }), 'slot2');
    expect(await saves.has('spider')).toBe(true);
    expect(await saves.list()).toEqual(['spider/current', 'war/slot2']);

    const loaded = (await saves.load('spider'))!;
    expect(loaded.cardCount).toBe(104);
    expect(loaded.data).toEqual({ suits: 1 });
    expect(await saves.load('klondike')).toBeNull();

    await saves.delete('spider');
    expect(await saves.has('spider')).toBe(false);
  });

  it('discards invalid saves instead of crashing', async () => {
    const backend = memorySaveBackend();
    await backend.set('klondike/current', { version: 1, gameId: 'klondike', piles: 'nope' });
    const warn = console.warn;
    console.warn = () => undefined;
    expect(await new SaveStore(backend).load('klondike')).toBeNull();
    console.warn = warn;
  });
});
