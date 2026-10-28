import { describe, expect, it } from 'vitest';
import { Card, Table, parseCardCode } from '@/engine';
import { WarGame, type WarSide } from '@/games/war/WarGame';

let copy = 0;
/** Cards from codes, listed top of pile first. */
const cards = (...codes: string[]) =>
  codes.map((code) => {
    const { rank, suit } = parseCardCode(code)!;
    return new Card(rank, suit, copy++);
  });

/** A War game whose piles hold exactly these cards (top first). */
function rigged(player: string[], cpu: string[]): WarGame {
  const g = WarGame.create({ seed: 1 });
  const set = (side: WarSide, codes: string[]) => {
    const h = g.hand(side);
    h.clear();
    h.push(...cards(...codes).reverse());
  };
  set('player', player);
  set('cpu', cpu);
  return g;
}

describe('War rules', () => {
  it('deals 26 cards each from a standard deck', () => {
    const g = WarGame.create({ seed: 4 });
    expect(g.count('player')).toBe(26);
    expect(g.count('cpu')).toBe(26);
    expect(g.table.cardCount).toBe(52);
    expect(g.data.opponentId).toBe('jak_gold');
  });

  it('higher rank wins, Ace high, suits ignored', () => {
    const g = rigged(['AS', '2C'], ['KH', '3D']);
    const r = g.playRound();
    expect(r.winner).toBe('player');
    expect(r.battles).toHaveLength(1);
    expect(g.count('player')).toBe(3);
    expect(g.count('cpu')).toBe(1);
    expect(g.hand('player').top!.code).toBe('2C'); // winnings go underneath
  });

  it('a tie starts a war with three face-down cards and one face up', () => {
    const g = rigged(['7S', '2C', '3C', '4C', 'KS', '9D'], ['7H', '2D', '3D', '4D', 'QS', '9S']);
    const r = g.playRound();
    expect(r.battles).toHaveLength(2);
    expect(r.battles[1]!.faceDown.player.map((c) => c.code)).toEqual(['2C', '3C', '4C']);
    expect(r.battles[1]!.player.code).toBe('KS');
    expect(r.winner).toBe('player');
    expect(r.pot).toHaveLength(10);
    expect(g.count('player')).toBe(11);
    expect(g.count('cpu')).toBe(1);
    expect(g.data.wars).toBe(1);
  });

  it('repeats wars on further ties', () => {
    const g = rigged(
      ['5S', '2C', '2C', '2C', '8S', '3C', '3C', '3C', 'AS'],
      ['5H', '4D', '4D', '4D', '8H', '6D', '6D', '6D', 'KS'],
    );
    const r = g.playRound();
    expect(r.battles).toHaveLength(3);
    expect(r.winner).toBe('player');
    expect(g.data.wars).toBe(2);
  });

  it('a player short of cards turns their last card face up', () => {
    // Player has only 2 cards left after the tie: one goes face down, the last is turned up.
    const g = rigged(['9S', '4C', 'KC'], ['9H', '2D', '3D', '5D', 'QD', '6H']);
    const r = g.playRound();
    expect(r.battles[1]!.faceDown.player.map((c) => c.code)).toEqual(['4C']);
    expect(r.battles[1]!.player.code).toBe('KC');
    expect(r.winner).toBe('player');
  });

  it('a player with no card to turn for a war loses and the winner owns every card', () => {
    const g = rigged(['9S'], ['9H', '2D', '3D']);
    const r = g.playRound();
    expect(r.outOfCards).toBe('player');
    expect(r.winner).toBe('cpu');
    expect(g.status).toBe('lost');
    expect(g.count('cpu')).toBe(4);
    expect(g.count('player')).toBe(0);
    expect(() => g.playRound()).toThrow(/over/);
  });

  it('victory when one side holds all cards', () => {
    const g = rigged(['KS', 'QS'], ['2H']);
    expect(g.playRound().status).toBe('won');
    expect(g.count('player')).toBe(3);
  });

  it('both running out in the same war is a draw', () => {
    const g = rigged(['9S'], ['9H']);
    const r = g.playRound();
    expect(r.winner).toBeNull();
    expect(r.status).toBe('draw');
    expect(g.count('player') + g.count('cpu')).toBe(2);
  });

  it('counts wars the player lost', () => {
    const g = rigged(['7S', '2C', '3C', '4C', '2S', '5C'], ['7H', '2D', '3D', '4D', 'AS', '5D']);
    g.playRound();
    expect(g.data.warsLost).toBe(1);
  });

  it('always finishes, conserving all 52 cards', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const g = WarGame.create({ seed });
      let rounds = 0;
      while (!g.isOver && rounds < 20_000) {
        g.playRound();
        rounds++;
        expect(g.count('player') + g.count('cpu')).toBe(52);
      }
      expect(g.isOver, `seed ${seed}`).toBe(true);
      if (g.status !== 'draw') expect(Math.max(g.count('player'), g.count('cpu'))).toBe(52);
      expect(g.data.round).toBe(rounds);
    }
  });

  it('saves and resumes identically', () => {
    const a = WarGame.create({ seed: 11 });
    for (let i = 0; i < 25; i++) a.playRound();
    const b = WarGame.restore(Table.restore(JSON.parse(JSON.stringify(a.table.snapshot()))));
    for (let i = 0; i < 25 && !a.isOver; i++) {
      const ra = a.playRound();
      const rb = b.playRound();
      expect(rb.winner).toBe(ra.winner);
      expect(rb.battles.map((x) => x.player.id)).toEqual(ra.battles.map((x) => x.player.id));
    }
    expect(b.data.round).toBe(a.data.round);
  });
});
