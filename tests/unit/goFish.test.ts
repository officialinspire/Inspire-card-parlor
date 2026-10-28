import { describe, expect, it } from 'vitest';
import { Card, Table, parseCardCode, type Rank } from '@/engine';
import { BOOKS_TOTAL, GoFishGame, type GoFishPlayer } from '@/games/goFish/GoFishGame';
import { chooseAsk, inferKnowledge } from '@/games/goFish/cpu';
import { playerView } from '@/games/goFish/view';
import { PERSONALITIES, getPersonality } from '@/games/cpu/personalities';
import { Random } from '@/engine/random';

const P = (n: number): GoFishPlayer[] => [
  { id: 'you', name: 'You' },
  ...PERSONALITIES.slice(0, n - 1).map((p, i) => ({ id: `cpu${i + 1}`, name: p.name, cpu: p.id })),
];

let copy = 0;
const cards = (...codes: string[]) =>
  codes.map((code) => {
    const { rank, suit } = parseCardCode(code)!;
    return new Card(rank, suit, 100 + copy++);
  });

/** A game with exact hands and pond (pond listed top first). Books from the deal are cleared. */
function rigged(hands: Record<string, string[]>, pond: string[], players = Object.keys(hands).length): GoFishGame {
  const g = GoFishGame.create({ players: P(players), seed: 1 });
  for (const p of g.players) {
    g.hand(p.id).clear();
    g.table.pile(`books:${p.id}`).clear();
    g.hand(p.id).push(...cards(...(hands[p.id] ?? [])));
  }
  g.pond.clear();
  g.pond.push(...cards(...pond).reverse());
  g.data.log = [];
  g.data.current = 0;
  return g;
}

describe('Go Fish setup', () => {
  it.each([
    [2, 7],
    [3, 7],
    [4, 5],
  ])('deals %i players %i cards each', (n, size) => {
    const g = GoFishGame.create({ players: P(n), seed: 3 });
    for (const p of g.players) expect(g.hand(p.id).size + g.books(p.id).length * 4).toBeGreaterThanOrEqual(size);
    expect(g.table.cardCount).toBe(52);
    expect(g.current.id).toBe('you');
  });

  it('shows only the human hand face up', () => {
    const g = GoFishGame.create({ players: P(4), seed: 5 });
    expect(g.hand('you').all.every((c) => c.faceUp)).toBe(true);
    for (const id of ['cpu1', 'cpu2', 'cpu3']) expect(g.hand(id).all.every((c) => !c.faceUp)).toBe(true);
  });
});

describe('Go Fish rules', () => {
  it('a successful request transfers every card of the rank and the asker goes again', () => {
    const g = rigged({ you: ['7S', '2D'], cpu1: ['7H', '7C', '9D'] }, ['KS']);
    const r = g.ask('you', 'cpu1', 7);
    expect(r.events.find((e) => e.t === 'give')).toEqual({ t: 'give', from: 'cpu1', to: 'you', rank: 7, count: 2 });
    expect(g.hand('you').countRank(7)).toBe(3);
    expect(g.hand('cpu1').hasRank(7)).toBe(false);
    expect(r.again).toBe(true);
    expect(g.current.id).toBe('you');
  });

  it('go fish: drawing another rank ends the turn', () => {
    const g = rigged({ you: ['7S'], cpu1: ['9D'] }, ['KS', '2C']);
    const r = g.ask('you', 'cpu1', 7);
    expect(r.events.map((e) => e.t)).toEqual(['ask', 'fish', 'turn']);
    expect(r.privateDraw?.card.code).toBe('KS');
    expect(r.again).toBe(false);
    expect(g.current.id).toBe('cpu1');
    expect(g.hand('you').size).toBe(2);
  });

  it('go fish: drawing the requested rank is shown and the asker goes again', () => {
    const g = rigged({ you: ['7S'], cpu1: ['9D'] }, ['7H', '2C']);
    const r = g.ask('you', 'cpu1', 7);
    expect(r.events.find((e) => e.t === 'lucky')).toEqual({ t: 'lucky', p: 'you', rank: 7 });
    expect(r.again).toBe(true);
    expect(g.current.id).toBe('you');
  });

  it('lays down a book as soon as four are held', () => {
    const g = rigged({ you: ['QS', 'QH', 'QD', '3C'], cpu1: ['QC', '5D'] }, ['KS']);
    const r = g.ask('you', 'cpu1', 12);
    expect(r.events.some((e) => e.t === 'book' && e.p === 'you' && e.rank === 12)).toBe(true);
    expect(g.books('you')).toEqual([12]);
    expect(g.hand('you').hasRank(12)).toBe(false);
    expect(g.table.pile('books:you').size).toBe(4);
  });

  it('a drawn card can complete a book', () => {
    const g = rigged({ you: ['QS', 'QH', 'QD', '3C'], cpu1: ['5D'] }, ['QC']);
    g.ask('you', 'cpu1', 3);
    expect(g.books('you')).toEqual([12]);
  });

  it('empty hand: draws one card and carries on', () => {
    // You ask for your last rank, get the card, book it, and your hand is empty.
    const g = rigged({ you: ['QS', 'QH', 'QD'], cpu1: ['QC', '5D'] }, ['8S', '9S']);
    const r = g.ask('you', 'cpu1', 12);
    expect(r.events.map((e) => e.t)).toEqual(['ask', 'give', 'book', 'refill']);
    expect(r.privateDraw?.card.code).toBe('8S');
    expect(g.current.id).toBe('you');
    expect(g.hand('you').size).toBe(1);
    expect(r.again).toBe(true);
  });

  it('empty hand with an empty stock: the player is out and is skipped', () => {
    const g = rigged({ you: ['QS', 'QH', 'QD'], cpu1: ['QC', '5D'], cpu2: ['5S'] }, [], 3);
    const r = g.ask('you', 'cpu1', 12);
    expect(r.events.map((e) => e.t)).toEqual(['ask', 'give', 'book', 'refill', 'out', 'turn']);
    expect(g.current.id).toBe('cpu1');
  });

  it('exhausted stock: going fishing draws nothing and the turn passes', () => {
    const g = rigged({ you: ['7S'], cpu1: ['9D'] }, []);
    const r = g.ask('you', 'cpu1', 7);
    expect(r.events).toContainEqual({ t: 'fish', p: 'you', drew: false });
    expect(r.privateDraw).toBeUndefined();
    expect(g.current.id).toBe('cpu1');
  });

  it('when no opponent holds cards, the player draws instead of asking', () => {
    // cpu1 gives away its last card; then it is cpu1's turn with... no: it's you again.
    const g = rigged({ you: ['7S', '2C'], cpu1: ['7H'] }, ['KD', '5S']);
    const r = g.ask('you', 'cpu1', 7);
    // You go again, but nobody has cards to ask: draw instead, turn passes, cpu1 refills.
    expect(r.events.map((e) => e.t)).toEqual(['ask', 'give', 'draw-instead', 'turn', 'refill']);
    expect(g.current.id).toBe('cpu1');
  });

  it('rejects illegal requests', () => {
    const g = rigged({ you: ['7S'], cpu1: ['9D'] }, []);
    expect(() => g.ask('you', 'cpu1', 9)).toThrow(/rank you hold/);
    expect(() => g.ask('cpu1', 'you', 9)).toThrow(/turn/);
    expect(() => g.ask('you', 'you', 7)).toThrow(/cannot be asked/);
  });

  it('turns go around the table in order', () => {
    const g = rigged({ you: ['2S'], cpu1: ['3S'], cpu2: ['4S'], cpu3: ['5S'] }, ['6S', '7S', '8S', '9S'], 4);
    g.ask('you', 'cpu1', 2);
    expect(g.current.id).toBe('cpu1');
    g.ask('cpu1', 'cpu2', 3);
    expect(g.current.id).toBe('cpu2');
    g.ask('cpu2', 'cpu3', 4);
    expect(g.current.id).toBe('cpu3');
    g.ask('cpu3', 'you', 5);
    expect(g.current.id).toBe('you');
  });

  it('ends after 13 books with the most books winning', () => {
    const g = rigged({ you: ['KS', 'KH', 'KD'], cpu1: ['KC'] }, []);
    g.data.log = Array.from({ length: 12 }, (_, i) => ({
      t: 'book' as const,
      p: i < 7 ? 'you' : 'cpu1',
      rank: (i + 1) as Rank,
    }));
    const r = g.ask('you', 'cpu1', 13);
    expect(g.booksDown).toBe(BOOKS_TOTAL);
    expect(g.isOver).toBe(true);
    expect(r.events.at(-1)).toEqual({ t: 'end', winners: ['you'] });
    expect(g.standings()[0]).toMatchObject({ player: { id: 'you' }, books: 8 });
  });

  it('ties share the win', () => {
    const g = rigged({ you: ['KS', 'KH', 'KD'], cpu1: ['KC'], cpu2: ['QS'] }, [], 3);
    // 4 + 5 + 3 books down; your Kings make it 5–5–3.
    const owner = (i: number) => (i < 4 ? 'you' : i < 9 ? 'cpu1' : 'cpu2');
    g.data.log = Array.from({ length: 12 }, (_, i) => ({ t: 'book' as const, p: owner(i), rank: (i + 1) as Rank }));
    g.ask('you', 'cpu1', 13);
    expect(g.data.winners.sort()).toEqual(['cpu1', 'you']);
  });

  it.each([2, 3, 4])('a whole %i-player game plays out with only CPUs choosing, conserving cards', (n) => {
    for (const seed of [1, 2, 3]) {
      const g = GoFishGame.create({ players: P(n), seed, difficulty: 'hard' });
      const rng = new Random(seed);
      for (let i = 0; i < 2000 && !g.isOver; i++) {
        const cur = g.current;
        const choice = chooseAsk(playerView(g, cur.id), getPersonality(cur.cpu ?? 'strategic'), 'normal', () =>
          rng.next(),
        );
        g.ask(cur.id, choice.target, choice.rank);
        expect(g.table.cardCount).toBe(52);
      }
      expect(g.isOver).toBe(true);
      expect(g.booksDown).toBe(13);
      expect(g.standings().reduce((a, s) => a + s.books, 0)).toBe(13);
    }
  });

  it('restores a saved game', () => {
    const g = GoFishGame.create({ players: P(3), seed: 9 });
    const rank = g.askableRanks('you')[0]!;
    g.ask('you', 'cpu1', rank);
    const r = GoFishGame.restore(Table.restore(JSON.parse(JSON.stringify(g.table.snapshot()))));
    expect(r.current.id).toBe(g.current.id);
    expect(r.data.log).toEqual(g.data.log);
    expect(r.hand('you').all.map((c) => c.id)).toEqual(g.hand('you').all.map((c) => c.id));
  });
});

describe('CPU players', () => {
  it('see only their own cards', () => {
    const g = GoFishGame.create({ players: P(4), seed: 2 });
    const view = playerView(g, 'cpu2');
    expect(view.hand).toHaveLength(g.hand('cpu2').size);
    const json = JSON.stringify(view);
    // No card identities at all, and other hands appear only as counts.
    expect(json).not.toMatch(/"id":"\d+:/);
    expect(view.players.find((p) => p.id === 'you')).toEqual({
      id: 'you',
      name: 'You',
      handCount: g.hand('you').size,
      books: 0,
    });
  });

  it('decide the same way whatever the hidden cards are', () => {
    const g = GoFishGame.create({ players: P(3), seed: 8 });
    const before = chooseAsk(playerView(g, 'cpu1'), getPersonality('strategic'), 'hard', () => 0.3);
    // Shuffle what the other players hold (same counts) — the CPU cannot tell.
    const swap = g.hand('you').take(g.hand('you').size);
    const swap2 = g.hand('cpu2').take(g.hand('cpu2').size);
    g.hand('you').push(...swap2.slice(0, swap.length), ...g.pond.take(Math.max(0, swap.length - swap2.length)));
    g.hand('cpu2').push(...swap.slice(0, swap2.length));
    const after = chooseAsk(playerView(g, 'cpu1'), getPersonality('strategic'), 'hard', () => 0.3);
    expect(after).toEqual(before);
  });

  it('only make legal requests', () => {
    const g = GoFishGame.create({ players: P(4), seed: 6 });
    for (const p of PERSONALITIES) {
      for (const d of ['easy', 'normal', 'hard'] as const) {
        const c = chooseAsk(playerView(g, 'cpu1'), p, d, Math.random);
        expect(g.hand('cpu1').hasRank(c.rank)).toBe(true);
        expect(c.target).not.toBe('cpu1');
      }
    }
  });

  it('remember who asked for what and who said go fish', () => {
    const view = {
      self: 'cpu1',
      hand: [
        { rank: 7 as Rank, suit: 'spades' as const },
        { rank: 3 as Rank, suit: 'spades' as const },
      ],
      players: [
        { id: 'you', name: 'You', handCount: 5, books: 0 },
        { id: 'cpu1', name: 'A', handCount: 2, books: 0 },
        { id: 'cpu2', name: 'B', handCount: 5, books: 0 },
      ],
      pond: 20,
      current: 'cpu1',
      log: [
        { t: 'ask' as const, p: 'you', to: 'cpu2', rank: 7 as Rank },
        { t: 'fish' as const, p: 'you', drew: true },
      ],
    };
    const k = inferKnowledge(view, Infinity);
    expect(k.holds.get('you')?.has(7)).toBe(true);
    expect(k.lacks.get('cpu2')?.has(7)).toBe(true);
    // A strategic, hard CPU asks the player it knows holds sevens.
    expect(chooseAsk(view, getPersonality('strategic'), 'hard', () => 0.5)).toEqual({ rank: 7, target: 'you' });
    // With a one-event memory it has forgotten the early request.
    expect(inferKnowledge(view, 1).holds.get('you')).toBeUndefined();
  });

  it('have three personalities with distinct play styles', () => {
    expect(PERSONALITIES.map((p) => p.id)).toEqual(['jak_gold', 'friendly_local', 'strategic']);
    expect(getPersonality('strategic').traits.memory).toBeGreaterThan(getPersonality('friendly_local').traits.memory);
    expect(getPersonality('jak_gold').lines.ask(7, 'You')).toContain('Sevens');
    expect(getPersonality('jak_gold').deckId).toBe('jak_gold');
  });
});
