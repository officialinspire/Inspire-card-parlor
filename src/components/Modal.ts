import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { button } from './ui';

/** Renders `state.modal` as a centered window over the current screen. */
export function attachModalLayer(root: HTMLElement, store: Store): void {
  const layer = h('div', { class: 'modal-layer', hidden: true });
  root.appendChild(layer);
  const close = () => store.dispatch({ type: 'CLOSE_MODAL' });

  layer.addEventListener('click', (e) => {
    if (e.target === layer) close();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && store.state.modal) close();
  });

  store.select(
    (s) => s.modal,
    (modal) => {
      if (!modal) {
        layer.classList.remove('open');
        setTimeout(() => {
          if (!store.state.modal) layer.hidden = true;
        }, 200);
        return;
      }
      layer.replaceChildren(
        h(
          'div',
          { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' },
          h('h2', { id: 'modal-title', class: 'modal-title' }, modal.title),
          h('p', { class: 'modal-body' }, modal.body),
          h('div', { class: 'modal-actions' }, button('OK', close)),
        ),
      );
      layer.hidden = false;
      requestAnimationFrame(() => {
        layer.classList.add('open');
        layer.querySelector<HTMLElement>('button')?.focus();
      });
    },
  );
}

export const showModal = (store: Store, title: string, body: string) =>
  store.dispatch({ type: 'OPEN_MODAL', modal: { id: `${Date.now()}`, title, body } });
