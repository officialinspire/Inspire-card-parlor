import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { button, iconButton, type ButtonVariant } from './ui';
import { icon, type IconName } from './icons';

export interface DialogAction<T> {
  label: string;
  value: T;
  variant?: ButtonVariant;
  icon?: IconName;
}

export interface DialogOptions<T> {
  title: string;
  body: string | Node;
  icon?: IconName;
  actions: DialogAction<T>[];
  /** Value resolved when the dialog is dismissed (Escape, backdrop, ×). Omit to make it non-dismissible. */
  dismissValue?: T;
  class?: string;
  /** Index of the action to focus first (defaults to the last, i.e. the primary action). */
  focusIndex?: number;
  /** Announce as an alert dialog (questions that need an answer, like confirmations). */
  alert?: boolean;
}

let layer: HTMLElement | null = null;
let appStore: Store | null = null;
let seq = 0;
const stack: { id: string; el: HTMLElement; dismiss: (() => void) | null; restore: Element | null }[] = [];

/** Mounts the dialog layer. Dialogs report open/close to the store so global input can defer to them. */
export function attachDialogs(root: HTMLElement, store: Store): void {
  appStore = store;
  layer = h('div', { class: 'dialog-layer', hidden: true });
  root.appendChild(layer);
  document.addEventListener(
    'keydown',
    (e) => {
      const top = stack.at(-1);
      if (!top) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        top.dismiss?.();
      } else if (e.key === 'Tab') trapFocus(top.el, e);
    },
    true,
  );
}

function trapFocus(container: HTMLElement, e: KeyboardEvent): void {
  const focusables = [
    ...container.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex="0"]'),
  ];
  if (!focusables.length) return;
  const first = focusables[0]!;
  const last = focusables.at(-1)!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Opens a modal window and resolves with the chosen action's value. */
export function openDialog<T>(opts: DialogOptions<T>): Promise<T> {
  if (!layer || !appStore) throw new Error('attachDialogs() must run before openDialog()');
  const host = layer;
  const store = appStore;
  const id = `dialog-${++seq}`;

  return new Promise<T>((resolve) => {
    let closed = false;
    const close = (value: T) => {
      if (closed) return;
      closed = true;
      const i = stack.findIndex((d) => d.id === id);
      const [entry] = stack.splice(i, 1);
      store.dispatch({ type: 'MODAL_CLOSED', id });
      backdrop.classList.remove('open');
      const finish = () => {
        backdrop.remove();
        if (!stack.length) host.hidden = true;
      };
      backdrop.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 260);
      (entry?.restore as HTMLElement | null)?.focus?.({ preventScroll: true });
      resolve(value);
    };
    const dismissible = 'dismissValue' in opts;
    const dismiss = dismissible ? () => close(opts.dismissValue as T) : null;

    const actions = opts.actions.map((a) =>
      button(a.label, () => close(a.value), {
        variant: a.variant ?? 'primary',
        ...(a.icon ? { icon: a.icon } : {}),
        sfx: a.variant === 'ghost' || a.variant === 'secondary' ? 'back' : 'tap',
        attrs: { 'data-dialog-action': String(a.value) },
      }),
    );

    const panel = h(
      'div',
      {
        class: `dialog ${opts.class ?? ''}`.trim(),
        role: opts.alert ? 'alertdialog' : 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': `${id}-title`,
      },
      h(
        'header',
        { class: 'dialog-header' },
        opts.icon ? h('span', { class: 'dialog-icon' }, icon(opts.icon)) : null,
        h('h2', { id: `${id}-title`, class: 'dialog-title' }, opts.title),
        dismiss ? iconButton('close', 'Close', dismiss, { sfx: 'back', class: 'dialog-close' }) : null,
      ),
      h('div', { class: 'dialog-body' }, typeof opts.body === 'string' ? h('p', null, opts.body) : opts.body),
      h('footer', { class: 'dialog-actions' }, ...actions),
    );
    const backdrop = h('div', { class: 'dialog-backdrop', 'data-dialog': id }, panel);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) dismiss?.();
    });

    stack.push({ id, el: panel, dismiss, restore: document.activeElement });
    store.dispatch({ type: 'MODAL_OPENED', modal: { id, title: opts.title } });
    host.hidden = false;
    host.appendChild(backdrop);
    requestAnimationFrame(() => {
      backdrop.classList.add('open');
      (actions[opts.focusIndex ?? actions.length - 1] ?? panel).focus({ preventScroll: true });
    });
  });
}

export interface ConfirmOptions {
  title: string;
  message: string | Node;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: IconName;
}

/** Yes/no confirmation. Resolves true only when the player confirms. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return openDialog<boolean>({
    title: opts.title,
    body: opts.message,
    icon: opts.icon ?? (opts.danger ? 'warning' : 'info'),
    class: opts.danger ? 'dialog-danger' : '',
    dismissValue: false,
    alert: true,
    focusIndex: opts.danger ? 0 : 1,
    actions: [
      { label: opts.cancelLabel ?? 'Cancel', value: false, variant: 'ghost' },
      { label: opts.confirmLabel ?? 'Confirm', value: true, variant: opts.danger ? 'danger' : 'primary' },
    ],
  });
}

export function alertDialog(title: string, message: string | Node, okLabel = 'OK'): Promise<void> {
  return openDialog<void>({
    title,
    body: message,
    dismissValue: undefined,
    actions: [{ label: okLabel, value: undefined }],
  });
}
