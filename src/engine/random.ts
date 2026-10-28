/**
 * Seedable PRNG (mulberry32). Deals are reproducible from a seed, and the
 * generator state can be saved and restored mid-game.
 */
export class Random {
  #state: number;
  readonly seed: number;

  constructor(seed: number = Random.newSeed()) {
    this.seed = seed >>> 0;
    this.#state = this.seed;
  }

  static newSeed(): number {
    if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
    return Math.floor(Math.random() * 2 ** 32);
  }

  /** Float in [0, 1). */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, max). */
  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  get state(): number {
    return this.#state;
  }

  static restore(seed: number, state: number): Random {
    const r = new Random(seed);
    r.#state = state >>> 0;
    return r;
  }
}

/** In-place Fisher–Yates shuffle. Every permutation is equally likely given a uniform source. */
export function fisherYates<T>(items: T[], random: Pick<Random, 'int'> = new Random()): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = random.int(i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}
