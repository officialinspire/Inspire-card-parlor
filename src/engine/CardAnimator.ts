export type AnimationSpeed = 'slow' | 'normal' | 'fast';

export interface AnimatorOptions {
  speed?: () => AnimationSpeed;
  reducedMotion?: () => boolean;
}

const SPEED: Record<AnimationSpeed, number> = { slow: 1.5, normal: 1, fast: 0.6 };
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const canAnimate = (el: Element) => typeof (el as HTMLElement).animate === 'function';

/**
 * Card motion built on the Web Animations API. Moves use FLIP (measure,
 * change the DOM, then animate from the old position), so game code only
 * mutates the layout and the animator makes it glide. Honors the player's
 * animation speed and reduced-motion settings.
 */
export class CardAnimator {
  constructor(private opts: AnimatorOptions = {}) {}

  get enabled(): boolean {
    return !this.opts.reducedMotion?.();
  }

  duration(ms: number): number {
    return ms * SPEED[this.opts.speed?.() ?? 'normal'];
  }

  #run(el: Element, keyframes: Keyframe[], ms: number, delay = 0): Promise<void> {
    if (!this.enabled || !canAnimate(el)) return Promise.resolve();
    const anim = (el as HTMLElement).animate(keyframes, {
      duration: this.duration(ms),
      delay: this.duration(delay),
      easing: EASE,
      fill: 'backwards',
    });
    return anim.finished.then(
      () => undefined,
      () => undefined,
    );
  }

  /**
   * FLIP move: records where `elements` are, runs `mutate` (re-parent, reorder…),
   * then animates each element from its old spot to its new one.
   */
  async move(elements: Element[], mutate: () => void, opts: { ms?: number; stagger?: number } = {}): Promise<void> {
    const first = new Map(elements.map((el) => [el, el.getBoundingClientRect()]));
    mutate();
    if (!this.enabled) return;
    await Promise.all(
      elements.map((el, i) => {
        const a = first.get(el)!;
        const b = el.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (!dx && !dy) return Promise.resolve();
        return this.#run(
          el,
          [
            { transform: `translate(${dx}px, ${dy}px)`, zIndex: '50' },
            { transform: 'none', zIndex: '50' },
          ],
          opts.ms ?? 260,
          (opts.stagger ?? 0) * i,
        );
      }),
    );
  }

  /** Flip a card over: squash to the edge, swap faces with `apply`, open back up. Returns the shown element. */
  async flip<T extends Element>(el: T, apply: () => T | void, ms = 280): Promise<T> {
    if (!this.enabled || !canAnimate(el)) return (apply() as T | undefined) ?? el;
    await this.#run(el, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], ms / 2).then(
      () => undefined,
    );
    const next = (apply() as T | undefined) ?? el;
    await this.#run(next, [{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }], ms / 2);
    return next;
  }

  /** Deal elements in from a point (e.g. the stock), one after another. */
  deal(
    elements: Element[],
    from: { x: number; y: number },
    opts: { ms?: number; stagger?: number } = {},
  ): Promise<void> {
    if (!this.enabled) return Promise.resolve();
    return Promise.all(
      elements.map((el, i) => {
        const r = el.getBoundingClientRect();
        return this.#run(
          el,
          [
            { transform: `translate(${from.x - r.left}px, ${from.y - r.top}px) rotate(-8deg)`, opacity: 0.4 },
            { transform: 'none', opacity: 1 },
          ],
          opts.ms ?? 320,
          (opts.stagger ?? 45) * i,
        );
      }),
    ).then(() => undefined);
  }

  /** Little shake for an illegal move. */
  reject(el: Element): Promise<void> {
    return this.#run(
      el,
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' },
      ],
      260,
    );
  }

  /** Lift a card (hover/pick-up feedback). */
  lift(el: Element): Promise<void> {
    return this.#run(el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }], 120);
  }
}
