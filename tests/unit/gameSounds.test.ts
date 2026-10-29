import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __setSoundBackend, flush, gameSound, onGameSound, type GameSoundEvent } from '@/audio/gameSounds';

let played: string[];
let now = 0;
let restore: () => void;

beforeEach(() => {
  played = [];
  now = 1000;
  restore = __setSoundBackend(
    (sfx) => played.push(sfx),
    () => now,
  );
});
afterEach(() => restore());

describe('game sound hooks', () => {
  it('maps every event to a sound', () => {
    for (const e of [
      'card_flip',
      'card_deal',
      'card_move',
      'card_shuffle',
      'valid_move',
      'invalid_move',
      'victory',
    ] as const) {
      now += 5000;
      gameSound(e);
      flush();
    }
    expect(played).toEqual(['flip', 'deal', 'slide', 'shuffle', 'place', 'error', 'victory']);
  });

  it('plays one sound for one move even when several hooks fire', () => {
    gameSound('card_move');
    gameSound('valid_move');
    gameSound('valid_move');
    flush();
    expect(played).toEqual(['place']);
  });

  it('keeps distinct sounds of the same action (a move that turns a card)', () => {
    gameSound('valid_move');
    gameSound('card_flip');
    flush();
    expect(played).toEqual(['place', 'flip']);
  });

  it('lets an invalid move or a victory speak for the whole action', () => {
    gameSound('card_move');
    gameSound('invalid_move');
    flush();
    expect(played).toEqual(['error']);
    now += 1000;
    played = [];
    gameSound('valid_move');
    gameSound('card_flip');
    gameSound('victory');
    flush();
    expect(played).toEqual(['victory']);
  });

  it('spaces fast repeats so a deal patters instead of stacking', () => {
    for (let i = 0; i < 10; i++) {
      gameSound('card_deal');
      flush();
      now += 20; // faster than the deal's minimum gap
    }
    expect(played.length).toBe(5);
  });

  it('batches events raised in the same task automatically', async () => {
    gameSound('card_move');
    gameSound('valid_move');
    expect(played).toEqual([]);
    await Promise.resolve();
    expect(played).toEqual(['place']);
  });

  it('reports every event to listeners, played or not', () => {
    const seen: GameSoundEvent[] = [];
    const off = onGameSound((e) => seen.push(e));
    gameSound('card_move');
    gameSound('valid_move');
    flush();
    off();
    expect(seen.map((e) => [e.event, e.played])).toEqual([
      ['card_move', false],
      ['valid_move', true],
    ]);
  });
});
