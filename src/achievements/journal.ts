import type { GameId } from '@/core/types';

/**
 * The journal: lifetime counters and "seen" sets that achievements read.
 * It only ever grows (counters add or keep a maximum, sets add members),
 * so replaying an update can't take progress away, and merging an older
 * save with defaults is a plain union.
 */
export interface Journal {
  counters: Record<string, number>;
  seen: Record<string, string[]>;
}

export interface JournalUpdate {
  /** Added to the counter. */
  add?: Record<string, number>;
  /** Counter becomes max(current, value). */
  max?: Record<string, number>;
  /** Counter is set (used only for running state such as the current loss streak). */
  set?: Record<string, number>;
  /** Members added to a set. */
  seen?: Record<string, string[]>;
}

export const emptyJournal = (): Journal => ({ counters: {}, seen: {} });

export function applyJournal(j: Journal | undefined, u: JournalUpdate): Journal {
  const counters = { ...(j?.counters ?? {}) };
  const seen = { ...(j?.seen ?? {}) };
  for (const [k, v] of Object.entries(u.add ?? {})) counters[k] = (counters[k] ?? 0) + v;
  for (const [k, v] of Object.entries(u.max ?? {})) counters[k] = Math.max(counters[k] ?? 0, v);
  for (const [k, v] of Object.entries(u.set ?? {})) counters[k] = v;
  for (const [k, vs] of Object.entries(u.seen ?? {})) {
    const cur = seen[k] ?? [];
    const fresh = vs.filter((v) => !cur.includes(v));
    if (fresh.length) seen[k] = [...cur, ...fresh];
  }
  return { counters, seen };
}

/** Union of two journals (used when hydrating a save: nothing is lost from either side). */
export function mergeJournals(a: Journal | undefined, b: Partial<Journal> | undefined): Journal {
  const counters = { ...(a?.counters ?? {}) };
  for (const [k, v] of Object.entries(b?.counters ?? {})) if (typeof v === 'number') counters[k] = v;
  const seen: Record<string, string[]> = { ...(a?.seen ?? {}) };
  for (const [k, vs] of Object.entries(b?.seen ?? {}))
    if (Array.isArray(vs)) seen[k] = [...new Set([...(seen[k] ?? []), ...vs])];
  return { counters, seen };
}

/** Everything about one finished game that achievements care about. */
export interface GameRecord {
  gameId: GameId;
  outcome: 'win' | 'loss' | 'draw';
  durationMs: number;
  at: Date;
  deckId: string;
  boardId: string;
  story: boolean;
  /** Sound fully off when the game ended. */
  silent: boolean;
  leftHanded: boolean;
  details: {
    undos?: number;
    hints?: number;
    moves?: number;
    draw?: number;
    suits?: number;
    usedCell?: boolean;
    warsLost?: number;
    warsWon?: number;
    rounds?: number;
    opponent?: string;
    books?: number;
    asksOk?: number;
    opponents?: number;
    difficulty?: string;
  };
  /** Losses in a row before this game. */
  lossStreak: number;
  /** Games already played today (local date) before this one. */
  gamesToday: number;
  /** Local date as yyyymmdd. */
  today: number;
}

const SOLITAIRE: GameId[] = ['klondike', 'spider', 'freecell'];

/** Pure: the journal update for one finished game. */
export function journalForGame(r: GameRecord): JournalUpdate {
  const won = r.outcome === 'win';
  const d = r.details;
  const add: Record<string, number> = {
    games: 1,
    'time.played': Math.max(0, r.durationMs),
    [`deck.${r.deckId}`]: 1,
    [`board.${r.boardId}`]: 1,
  };
  const max: Record<string, number> = {};
  const set: Record<string, number> = {};
  const seen: Record<string, string[]> = { games: [r.gameId], decks: [r.deckId], boards: [r.boardId] };
  const flag = (key: string, cond: boolean | undefined) => {
    if (cond) add[key] = (add[key] ?? 0) + 1;
  };

  set['streak.loss'] = r.outcome === 'loss' ? r.lossStreak + 1 : 0;
  set['day.key'] = r.today;
  set['day.count'] = r.gamesToday + 1;
  max['day.max'] = r.gamesToday + 1;

  const hour = r.at.getHours();
  const weekend = r.at.getDay() === 0 || r.at.getDay() === 6;
  flag('secret.nightOwl', hour < 4);
  flag('secret.lunch', hour === 12);
  flag('weekend.games', weekend);

  if (won) {
    seen.wonGames = [r.gameId];
    flag('wins.story', r.story);
    flag('secret.earlyBird', hour >= 5 && hour < 7);
    flag('secret.comeback', r.lossStreak >= 5);
    flag('secret.silent', r.silent);
    flag('secret.lefty', r.leftHanded);
    flag(
      'secret.hometown',
      r.deckId === 'fredericksburg_downtown' && ['rappahannock_riverside', 'downtown_cafe'].includes(r.boardId),
    );
    if (SOLITAIRE.includes(r.gameId)) {
      flag(`wins.${r.gameId}.noUndo`, d.undos === 0);
      flag(`wins.${r.gameId}.noHint`, d.hints === 0);
    }
    if (r.gameId === 'klondike') {
      flag('wins.klondike.draw3', d.draw === 3);
      flag('secret.patience', r.durationMs >= 30 * 60_000);
    }
    if (r.gameId === 'spider') {
      flag('wins.spider.2', d.suits === 2);
      flag('wins.spider.4', d.suits === 4);
    }
    if (r.gameId === 'freecell') {
      flag('wins.freecell.noCell', d.usedCell === false);
      flag('wins.freecell.under100', d.moves !== undefined && d.moves > 0 && d.moves < 100);
      flag('secret.blink', r.durationMs > 0 && r.durationMs < 120_000);
    }
    if (r.gameId === 'war') {
      flag('wins.war.flawless', (d.warsLost ?? 0) === 0);
      flag('wins.war.quick', d.rounds !== undefined && d.rounds > 0 && d.rounds <= 150);
      if (d.opponent) {
        flag(`wins.war.vs.${d.opponent}`, true);
        seen.beaten = [d.opponent];
      }
    }
    if (r.gameId === 'go-fish') {
      flag('wins.go-fish.crowd', (d.opponents ?? 1) >= 3);
      flag('wins.go-fish.hard', d.difficulty === 'hard');
    }
  }
  if (r.gameId === 'war') {
    if (d.warsWon) add['wars.won'] = d.warsWon;
    if (d.rounds) max['war.rounds'] = d.rounds;
  }
  if (r.gameId === 'go-fish') {
    if (d.books) {
      add.books = d.books;
      max['go-fish.books'] = d.books;
    }
    if (d.asksOk) add['asks.ok'] = d.asksOk;
  }
  return { add, max, set, seen };
}

/** Local date as a number (20261029), so it fits in a counter. */
export const localDay = (at: Date) => at.getFullYear() * 10000 + (at.getMonth() + 1) * 100 + at.getDate();

/** Games played earlier on the same local day. */
export function gamesToday(j: Journal | undefined, at: Date): number {
  return j?.counters['day.key'] === localDay(at) ? (j.counters['day.count'] ?? 0) : 0;
}
