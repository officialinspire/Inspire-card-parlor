import { h } from '@/utils/dom';

/**
 * Shows a speech bubble attached to `anchor` (which must be position: relative).
 * Replaces any bubble already there. Resolves when it has faded out.
 */
export function say(
  anchor: HTMLElement,
  text: string,
  opts: { duration?: number; tone?: 'ask' | 'reply' | 'info' } = {},
): Promise<void> {
  anchor.querySelector(':scope > .bubble')?.remove();
  const bubble = h('div', { class: `bubble bubble-${opts.tone ?? 'reply'}`, role: 'status' }, text);
  anchor.appendChild(bubble);
  const duration = opts.duration ?? 1800;
  return new Promise((resolve) => {
    setTimeout(() => {
      bubble.classList.add('leaving');
      setTimeout(() => {
        bubble.remove();
        resolve();
      }, 200);
    }, duration);
  });
}
