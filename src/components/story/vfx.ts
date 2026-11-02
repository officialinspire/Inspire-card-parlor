import { h } from '@/utils/dom';
import { store } from '@/core/store';
import { storyImage, storySprite } from '@/story/art';
import { prefersReducedMotion } from '@/utils/device';

/**
 * Story effects from the Thirteenth Hand VFX atlas: a short burst over the
 * element that earned it (a clue found, a stamp, a new place on the map).
 *
 * They are decoration only: never on a card table, never needed to follow
 * what happened (the text always says it), skipped entirely with reduced
 * motion or Low effects, capped at a few at a time, and each image is the
 * small (~350 px) cut sprite, not the atlas.
 */
export type VfxKind = 'discovery' | 'reveal' | 'unlock' | 'stamp' | 'deck' | 'victory' | 'spectral';

export const VFX: Record<VfxKind, string> = {
  discovery: 'thirteenth-hand-vfx/card-ring-sparkle',
  reveal: 'thirteenth-hand-vfx/ace-flash',
  unlock: 'thirteenth-hand-vfx/suit-wheel',
  stamp: 'thirteenth-hand-vfx/green-wax-ring',
  deck: 'thirteenth-hand-vfx/card-fan-swirl',
  victory: 'thirteenth-hand-vfx/confetti-suits',
  spectral: 'thirteenth-hand-vfx/spectral-wisp',
};

const MAX_LIVE = 3;
let layer: HTMLElement | null = null;

export const effectsEnabled = () => {
  const s = store.state.settings;
  return !s.reducedMotion && !s.lowEffects && !(typeof matchMedia === 'function' && prefersReducedMotion());
};

/** Plays an effect centred on `target` (a size relative to it). Returns false when effects are off. */
export function vfxBurst(kind: VfxKind, target: Element | null, scale = 1.6): boolean {
  if (!target || !effectsEnabled() || !storySprite(VFX[kind])) return false;
  layer ??= document.body.appendChild(h('div', { class: 'vfx-layer', 'aria-hidden': 'true' }));
  if (layer.childElementCount >= MAX_LIVE) layer.firstElementChild?.remove();
  const r = target.getBoundingClientRect();
  const size = Math.max(64, Math.min(320, Math.max(r.width, r.height) * scale));
  const img = storyImage(VFX[kind], { className: `vfx vfx-${kind}`, alt: '' });
  img.style.left = `${r.left + r.width / 2 - size / 2}px`;
  img.style.top = `${r.top + r.height / 2 - size / 2}px`;
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  img.dataset.vfx = kind;
  layer.append(img);
  const done = () => img.remove();
  img.addEventListener('animationend', done, { once: true });
  setTimeout(done, 1600);
  return true;
}
