import type { Store } from '@/core/store';
import type { AppState } from '@/core/states';

export interface ScreenContext {
  store: Store;
}

export interface Screen {
  el: HTMLElement;
  /** Called after the element is attached and visible. */
  mount?(): void;
  /** Called before removal — release listeners/subscriptions here. */
  unmount?(): void;
}

export type ScreenFactory = (ctx: ScreenContext) => Screen;
export type ScreenRegistry = Partial<Record<AppState, ScreenFactory>>;

/** Collects teardown callbacks so screens can clean up in one call. */
export class Disposer {
  #fns: (() => void)[] = [];
  add(fn: () => void): void {
    this.#fns.push(fn);
  }
  listen<K extends keyof WindowEventMap>(target: Window, type: K, fn: (e: WindowEventMap[K]) => void): void;
  listen(target: EventTarget, type: string, fn: EventListener): void;
  listen(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.add(() => target.removeEventListener(type, fn));
  }
  dispose(): void {
    this.#fns.splice(0).forEach((fn) => fn());
  }
}
