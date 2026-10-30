import { h } from '@/utils/dom';
import { store, type Store } from '@/core/store';
import type { Notification, NotificationKind } from '@/core/types';
import { audio } from '@/audio';
import { icon, type IconName } from './icons';
import { medal } from './medal';
import { getAchievement } from '@/achievements/registry';

let seq = 0;

const KIND_ICON: Record<NotificationKind, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'warning',
  error: 'warning',
  celebrate: 'trophy',
};

/** Suits thrown out by the celebration burst. */
const BURST = ['♠', '♥', '♦', '♣', '★', '♠', '♥', '♦', '♣', '★'];

/** Shows a toast. Returns its id so callers can dismiss it early. */
export function notify(
  message: string,
  opts: {
    kind?: NotificationKind;
    icon?: IconName;
    duration?: number;
    sound?: boolean;
    title?: string;
    badge?: string;
  } = {},
): number {
  const id = ++seq;
  const kind = opts.kind ?? 'info';
  if (opts.sound !== false)
    audio.play(
      kind === 'error' || kind === 'warning' ? 'error' : kind === 'success' || kind === 'celebrate' ? 'chime' : 'tap',
    );
  store.dispatch({
    type: 'NOTIFY',
    notification: {
      id,
      message,
      kind,
      icon: opts.icon ?? KIND_ICON[kind],
      title: opts.title,
      ...(opts.badge ? { badge: opts.badge } : {}),
      duration: opts.duration ?? 2800,
    },
  });
  return id;
}

/** Gold toast for achievements and unlocks, with a small burst of suits. */
export const celebrate = (title: string, message: string, iconName: IconName = 'trophy') =>
  notify(message, { kind: 'celebrate', icon: iconName, title, duration: 4200 });

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
      // Timed toasts never block a tap: they are click-through and dismiss themselves.
      // A sticky one (duration 0) is the exception: tap it to dismiss.
      const sticky = n.duration <= 0;
      const el = h(
        sticky ? 'button' : 'div',
        {
          ...(sticky
            ? {
                type: 'button',
                title: 'Dismiss',
                onclick: () => s.dispatch({ type: 'DISMISS_NOTIFICATION', id: n.id }),
              }
            : {}),
          class: `toast toast-${n.kind}${n.badge ? ' toast-achievement' : ''}${sticky ? ' toast-sticky' : ''}`,
          ...(n.badge ? { 'data-achievement': n.badge } : {}),
          'data-toast': String(n.id),
        },
        ...(n.kind === 'celebrate'
          ? [
              h(
                'span',
                { class: 'toast-burst', 'aria-hidden': 'true' },
                ...BURST.map((suit, i) => {
                  const angle = (i / BURST.length) * Math.PI * 2;
                  return h(
                    'span',
                    {
                      style: {
                        '--i': String(i),
                        '--dx': `${Math.round(Math.cos(angle) * 46)}px`,
                        '--dy': `${Math.round(Math.sin(angle) * 34)}px`,
                        '--rot': `${(i % 2 ? 1 : -1) * 90}deg`,
                      },
                    },
                    suit,
                  );
                }),
              ),
              n.badge && getAchievement(n.badge)
                ? h(
                    'span',
                    { class: 'toast-medal toast-medal-art' },
                    medal(getAchievement(n.badge)!, { earned: true, size: 40 }),
                  )
                : h('span', { class: 'toast-medal' }, icon((n.icon as IconName | undefined) ?? 'trophy')),
              h(
                'span',
                { class: 'toast-text' },
                n.title ? h('small', null, n.title) : null,
                h('span', null, n.message),
              ),
            ]
          : [icon((n.icon as IconName | undefined) ?? KIND_ICON[n.kind]), h('span', null, n.message)]),
      );
      rendered.set(n.id, el);
      region.appendChild(el);
      if (n.duration > 0) setTimeout(() => s.dispatch({ type: 'DISMISS_NOTIFICATION', id: n.id }), n.duration);
    }
  };
  sync(s.state.notifications);
  s.select((st) => st.notifications, sync);
}
