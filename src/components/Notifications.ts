import { h } from '@/utils/dom';
import { store, type Store } from '@/core/store';
import type { Notification, NotificationKind } from '@/core/types';
import { audio } from '@/audio';
import { icon, type IconName } from './icons';

let seq = 0;

const KIND_ICON: Record<NotificationKind, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'warning',
  error: 'warning',
};

/** Shows a toast. Returns its id so callers can dismiss it early. */
export function notify(
  message: string,
  opts: { kind?: NotificationKind; icon?: IconName; duration?: number; sound?: boolean } = {},
): number {
  const id = ++seq;
  const kind = opts.kind ?? 'info';
  if (opts.sound !== false)
    audio.play(kind === 'error' || kind === 'warning' ? 'error' : kind === 'success' ? 'chime' : 'tap');
  store.dispatch({
    type: 'NOTIFY',
    notification: { id, message, kind, icon: opts.icon ?? KIND_ICON[kind], duration: opts.duration ?? 2800 },
  });
  return id;
}

export const dismissNotification = (id: number) => store.dispatch({ type: 'DISMISS_NOTIFICATION', id });

/** Renders `state.notifications` as a stack of toasts. */
export function attachNotifications(root: HTMLElement, s: Store): void {
  const region = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
  root.appendChild(region);
  const rendered = new Map<number, HTMLElement>();

  const sync = (list: Notification[]) => {
    for (const [id, el] of rendered) {
      if (list.some((n) => n.id === id)) continue;
      rendered.delete(id);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 250);
    }
    for (const n of list) {
      if (rendered.has(n.id)) continue;
      const el = h(
        'button',
        {
          type: 'button',
          class: `toast toast-${n.kind}`,
          'data-toast': String(n.id),
          title: 'Dismiss',
          onclick: () => s.dispatch({ type: 'DISMISS_NOTIFICATION', id: n.id }),
        },
        icon((n.icon as IconName | undefined) ?? KIND_ICON[n.kind]),
        h('span', null, n.message),
      );
      rendered.set(n.id, el);
      region.appendChild(el);
      if (n.duration > 0) setTimeout(() => s.dispatch({ type: 'DISMISS_NOTIFICATION', id: n.id }), n.duration);
    }
  };
  sync(s.state.notifications);
  s.select((st) => st.notifications, sync);
}
