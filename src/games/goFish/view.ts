import type { Rank, Suit } from '@/engine';
import type { GoFishEvent, GoFishGame } from './GoFishGame';

/**
 * What one player can know: their own hand, everyone's card counts and books,
 * the stock size, and the public history. Other players' cards are never
 * included, so anything built on a PlayerView (CPU logic, UI) cannot leak them.
 */
export interface PlayerView {
  self: string;
  hand: { rank: Rank; suit: Suit }[];
  players: { id: string; name: string; handCount: number; books: number }[];
  pond: number;
  current: string;
  log: readonly GoFishEvent[];
}

export function playerView(game: GoFishGame, playerId: string): PlayerView {
  return {
    self: playerId,
    hand: game.hand(playerId).all.map((c) => ({ rank: c.rank, suit: c.suit })),
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      handCount: game.hand(p.id).size,
      books: game.books(p.id).length,
    })),
    pond: game.pond.size,
    current: game.current.id,
    log: structuredClone(game.data.log),
  };
}
