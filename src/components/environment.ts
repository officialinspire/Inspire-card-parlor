import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { resolveTheme } from '@/themes/theme';
import { Disposer } from './Screen';

/**
 * The painted riverfront behind the title screen and main menu: the sunlit
 * Rappahannock by day, Fredericksburg's lit waterfront by night.
 *
 * The paintings are shown whole where the screen allows (cover-fit, centred
 * on the skyline) and never altered. A blurred copy fills any space the
 * painting doesn't. Light ambient touches (stars, water shimmer, window glow)
 * and a gentle pointer parallax are added only when the device can afford
 * them and the player hasn't asked for reduced motion.
 */

export type EnvironmentKind = 'day' | 'night';

export const environmentImage = (kind: EnvironmentKind) =>
  `${import.meta.env.BASE_URL}assets/backgrounds/menu/${kind}.webp`;

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Rich motion: parallax and ambient animation. Off for reduced motion, data saver or low-end devices. */
export function richMotionAllowed(reducedMotion: boolean, nav: Navigator & NavigatorHints = navigator): boolean {
  if (reducedMotion) return false;
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 4) < 4) return false;
  if ((nav.deviceMemory ?? 4) < 4) return false;
  return true;
}

const STARS = 26;

function ambient(): HTMLElement {
  // Deterministic placement so the sky doesn't reshuffle between visits.
  const stars = Array.from({ length: STARS }, (_, i) => {
    const x = (i * 37.7) % 100;
    const y = ((i * 53.3) % 34) + 2;
    return h('span', {
      class: 'env-star',
      style: { '--x': `${x}%`, '--y': `${y}%`, '--d': `${2.4 + (i % 5) * 0.7}s`, '--delay': `${(i % 7) * 0.45}s` },
    });
  });
  return h(
    'div',
    { class: 'env-ambient', 'aria-hidden': 'true' },
    h('div', { class: 'env-stars' }, ...stars),
    h('div', { class: 'env-glow' }),
    h('div', { class: 'env-shimmer' }),
  );
}

export interface EnvironmentOptions {
  /** `splash`: soft, blurred and dimmed behind the title; `menu`: the painting itself. */
  variant: 'menu' | 'splash';
}

export function environment(store: Store, opts: EnvironmentOptions): { el: HTMLElement; destroy: () => void } {
  const d = new Disposer();
  const scenes = (['day', 'night'] as const).map((kind) => {
    const art = h('img', { class: 'env-art', alt: '', decoding: 'async', draggable: 'false' }) as HTMLImageElement;
    const fill = h('img', { class: 'env-fill', alt: '', decoding: 'async', draggable: 'false' }) as HTMLImageElement;
    art.addEventListener('load', () => scene.classList.add('loaded'));
    const scene = h('div', { class: `env-scene env-${kind}`, 'data-env-scene': kind }, fill, art);
    return { kind, scene, art, fill };
  });

  const el = h(
    'div',
    { class: `env env-${opts.variant}`, 'aria-hidden': 'true' },
    h('div', { class: 'env-parallax' }, ...scenes.map((s) => s.scene), ambient()),
    h('div', { class: 'env-scrim' }),
  );

  // Load a painting only once it is shown: the other one waits for the toggle.
  const show = () => {
    const kind = resolveTheme(store.state.settings.theme);
    el.dataset.env = kind;
    for (const s of scenes) {
      if (s.kind === kind && !s.art.src) s.art.src = s.fill.src = environmentImage(s.kind);
      s.scene.classList.toggle('active', s.kind === kind);
    }
  };
  const motion = () => {
    el.dataset.motion = richMotionAllowed(store.state.settings.reducedMotion) ? 'rich' : 'calm';
  };
  show();
  motion();
  d.add(store.select((s) => s.settings.theme, show));
  d.add(store.select((s) => s.settings.reducedMotion, motion));
  // "Auto" follows the clock; check again now and then.
  const timer = setInterval(show, 60_000);
  d.add(() => clearInterval(timer));

  // Pointer parallax (mouse and pen only; touch screens stay still).
  if (typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) {
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (el.dataset.motion !== 'rich' || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        el.style.setProperty('--px', ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty('--py', ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
      });
    };
    addEventListener('pointermove', onMove, { passive: true });
    d.add(() => {
      removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    });
  }

  return { el, destroy: () => d.dispose() };
}
