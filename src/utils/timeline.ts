/**
 * A tiny pausable schedule: steps run at fixed times from the start, the
 * clock stops while paused (a hidden tab), and `clear()` cancels everything
 * (screen teardown). Used by the opening sequence.
 */
export class Timeline {
  #steps: { at: number; run: () => void; done: boolean }[] = [];
  #elapsed = 0;
  #since = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #paused = true;

  /** Runs `run` at `at` ms after start (immediately if that time has passed). */
  at(at: number, run: () => void): this {
    this.#steps.push({ at, run, done: false });
    if (!this.#paused) this.#arm();
    return this;
  }

  start(): void {
    if (!this.#paused) return;
    this.#paused = false;
    this.#since = performance.now();
    this.#arm();
  }

  pause(): void {
    if (this.#paused) return;
    this.#elapsed += performance.now() - this.#since;
    this.#paused = true;
    this.#disarm();
  }

  get paused(): boolean {
    return this.#paused;
  }

  /** Cancels every pending step. */
  clear(): void {
    this.#disarm();
    this.#steps = [];
  }

  #now(): number {
    return this.#elapsed + (this.#paused ? 0 : performance.now() - this.#since);
  }

  #disarm(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #arm(): void {
    this.#disarm();
    const next = this.#steps.filter((s) => !s.done).sort((a, b) => a.at - b.at)[0];
    if (!next) return;
    this.#timer = setTimeout(
      () => {
        this.#timer = null;
        const now = this.#now();
        for (const s of this.#steps.filter((x) => !x.done && x.at <= now).sort((a, b) => a.at - b.at)) {
          s.done = true;
          s.run();
        }
        if (!this.#paused) this.#arm();
      },
      Math.max(0, next.at - this.#now()),
    );
  }
}
