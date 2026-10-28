import { RANKS, type Rank } from '@/engine';
import type { CpuPersonality } from '../cpu/personalities';
import type { Difficulty } from './GoFishGame';
import type { PlayerView } from './view';

/*
 * Go Fish CPU. It sees only a PlayerView (its own cards plus public history)
 * and reasons the way a person at the table could:
 *   · someone who asked for a rank holds at least one of it;
 *   · someone who received cards of a rank holds them;
 *   · someone who was asked and said "go fish" did not hold it (until they draw);
 *   · giving cards away or laying a book clears what we knew.
 * Difficulty and personality limit how much history it remembers and how often
 * it plays on a whim.
 */

const MEMORY_EVENTS: Record<Difficulty, number> = { easy: 6, normal: 24, hard: Infinity };
const WHIMSY_SCALE: Record<Difficulty, number> = { easy: 1.6, normal: 1, hard: 0.25 };

export interface Knowledge {
  holds: Map<string, Set<Rank>>;
  lacks: Map<string, Set<Rank>>;
}

const bucket = (m: Map<string, Set<Rank>>, id: string) => {
  let s = m.get(id);
  if (!s) m.set(id, (s = new Set()));
  return s;
};

/** What the public history says about other players' hands (within a memory window). */
export function inferKnowledge(view: PlayerView, memoryEvents: number): Knowledge {
  const holds = new Map<string, Set<Rank>>();
  const lacks = new Map<string, Set<Rank>>();
  const events = Number.isFinite(memoryEvents) ? view.log.slice(-memoryEvents) : view.log;
  let lastAsk: { to: string; rank: Rank } | null = null;
  for (const e of events) {
    switch (e.t) {
      case 'ask':
        bucket(holds, e.p).add(e.rank);
        bucket(lacks, e.p).delete(e.rank);
        lastAsk = { to: e.to, rank: e.rank };
        break;
      case 'give':
        bucket(holds, e.from).delete(e.rank);
        bucket(lacks, e.from).add(e.rank);
        bucket(holds, e.to).add(e.rank);
        break;
      case 'fish':
        if (lastAsk) bucket(lacks, lastAsk.to).add(lastAsk.rank);
        // The fisher drew an unknown card: anything we "knew" they lacked may be stale.
        bucket(lacks, e.p).clear();
        break;
      case 'refill':
      case 'draw-instead':
        bucket(lacks, e.p).clear();
        break;
      case 'lucky':
        bucket(holds, e.p).add(e.rank);
        break;
      case 'book':
        for (const s of holds.values()) s.delete(e.rank);
        for (const s of lacks.values()) s.add(e.rank);
        break;
    }
  }
  return { holds, lacks };
}

export interface CpuChoice {
  target: string;
  rank: Rank;
}

/** Picks who to ask and for what, using only `view`. `rand` makes it reproducible. */
export function chooseAsk(
  view: PlayerView,
  personality: CpuPersonality,
  difficulty: Difficulty,
  rand: () => number,
): CpuChoice {
  const mine = new Map<Rank, number>();
  for (const c of view.hand) mine.set(c.rank, (mine.get(c.rank) ?? 0) + 1);
  const ranks = RANKS.filter((r) => mine.has(r));
  const targets = view.players.filter((p) => p.id !== view.self && p.handCount > 0);
  if (!ranks.length || !targets.length) throw new Error('No legal request');

  const { traits } = personality;
  const whimsy = Math.min(1, traits.whimsy * WHIMSY_SCALE[difficulty]);
  if (rand() < whimsy) {
    return {
      rank: ranks[Math.floor(rand() * ranks.length)]!,
      target: targets[Math.floor(rand() * targets.length)]!.id,
    };
  }

  const window = Math.round(MEMORY_EVENTS[difficulty] * traits.memory) || 1;
  const know = inferKnowledge(view, difficulty === 'hard' && traits.memory >= 1 ? Infinity : window);
  const leaderBooks = Math.max(...targets.map((t) => t.books));

  let best: CpuChoice & { score: number } = { rank: ranks[0]!, target: targets[0]!.id, score: -Infinity };
  for (const rank of ranks) {
    for (const t of targets) {
      let score = 0;
      if (know.holds.get(t.id)?.has(rank)) score += 10;
      if (know.lacks.get(t.id)?.has(rank)) score -= 8;
      score += traits.greed * (mine.get(rank)! - 1) * 2;
      if (t.books === leaderBooks) score += traits.pressure * 1.5;
      score += t.handCount * 0.15; // bigger hands are likelier to hold it
      score += rand() * 0.5; // break ties
      if (score > best.score) best = { rank, target: t.id, score };
    }
  }
  return { rank: best.rank, target: best.target };
}
