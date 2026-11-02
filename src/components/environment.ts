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

const STARS = 22;

/** The paintings' size; both share it (the frame below is computed from it until an image reports its own). */
const ART_W = 1672;
const ART_H = 941;

/**
 * Where the painting actually sits inside its box (object-fit: cover,
 * object-position 50% 58%), so the effects can be laid on the painted
 * features — the moon, the lit windows, the river — at any screen shape.
 */
export function paintingFrame(boxW: number, boxH: number, imgW = ART_W, imgH = ART_H) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { left: (boxW - w) * 0.5, top: (boxH - h) * 0.58, width: w, height: h };
}

/**
 * Ambient life laid over the paintings, placed in the painting's own
 * coordinates (percentages of the frame) to match what is painted:
 *  · day: light moving on the river (lower third), a faint warm sunlit glow in
 *    the sky, a few leaves drifting from the trees that frame both sides;
 *  · night: the lit windows along the skyline breathing, a soft halo on the
 *    painted moon (top right), a cool glint under it on the water, stars in
 *    the open sky, and a few warm motes drifting on the wind over the water.
 * Nothing new is drawn into the scene; every effect is light on what's there.
 */
function ambient(): { el: HTMLElement; frame: HTMLElement } {
  // Deterministic placement so the sky doesn't reshuffle between visits; stars keep clear of the moon.
  const stars = Array.from({ length: STARS }, (_, i) => {
    const x = (i * 37.7) % 86;
    const y = ((i * 53.3) % 30) + 3;
    return h('span', {
      class: 'env-star',
      style: { '--x': `${x}%`, '--y': `${y}%`, '--d': `${2.4 + (i % 5) * 0.7}s`, '--delay': `${(i % 7) * 0.45}s` },
    });
  });
  // Leaves leave the trees on the left and right edges, on long, staggered cycles.
  const leaves = Array.from({ length: 5 }, (_, i) =>
    h('span', {
      class: 'fx-leaf',
      style: {
        '--x': i % 2 ? `${86 + i * 2}%` : `${4 + i * 3}%`,
        '--y': `${30 + i * 7}%`,
        '--dir': i % 2 ? '-1' : '1',
        '--d': `${16 + i * 3.5}s`,
        '--delay': `${i * 4.2}s`,
      },
    }),
  );
  const motes = Array.from({ length: 6 }, (_, i) =>
    h('span', {
      class: 'fx-mote',
      style: {
        '--x': `${8 + i * 15}%`,
        '--y': `${70 + (i % 3) * 6}%`,
        '--d': `${18 + i * 2.5}s`,
        '--delay': `${i * 2.7}s`,
      },
    }),
  );
  const frame = h(
    'div',
    { class: 'env-frame' },
    h(
      'div',
      { class: 'fx-day' },
      h('div', { class: 'fx-sun' }),
      h('div', { class: 'env-shimmer fx-water' }),
      h('div', { class: 'fx-leaves' }, ...leaves),
    ),
    h(
      'div',
      { class: 'fx-night' },
      h('div', { class: 'env-stars' }, ...stars),
      h('div', { class: 'fx-moon' }),
      h('div', { class: 'env-glow' }),
      h('div', { class: 'env-shimmer fx-water' }),
      h('div', { class: 'fx-moonpath' }),
      h('div', { class: 'fx-motes' }, ...motes),
    ),
  );
  return { el: h('div', { class: 'env-ambient', 'aria-hidden': 'true' }, frame), frame };
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

  const life = ambient();
  const el = h(
    'div',
    { class: `env env-${opts.variant}`, 'aria-hidden': 'true' },
    h('div', { class: 'env-parallax' }, ...scenes.map((s) => s.scene), life.el),
    h('div', { class: 'env-scrim' }),
  );

  // Keep the effects frame on the painting as the screen changes shape.
  const place = () => {
    // Layout size, not the on-screen rect: a screen's entrance transform must not skew the frame.
    const box = { width: life.el.offsetWidth, height: life.el.offsetHeight };
    if (!box.width || !box.height) return;
    const art = scenes.find((x) => x.scene.classList.contains('active'))?.art;
    const f = paintingFrame(box.width, box.height, art?.naturalWidth || ART_W, art?.naturalHeight || ART_H);
    Object.assign(life.frame.style, {
      left: `${f.left}px`,
      top: `${f.top}px`,
      width: `${f.width}px`,
      height: `${f.height}px`,
    });
  };
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(place);
    ro.observe(life.el);
    d.add(() => ro.disconnect());
  }
  for (const sc of scenes) sc.art.addEventListener('load', place);

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
    const { reducedMotion, lowEffects } = store.state.settings;
    el.dataset.motion = richMotionAllowed(reducedMotion || lowEffects) ? 'rich' : 'calm';
  };
  show();
  motion();
  d.add(store.select((s) => s.settings.theme, show));
  d.add(store.select((s) => `${s.settings.reducedMotion}|${s.settings.lowEffects}`, motion));
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
