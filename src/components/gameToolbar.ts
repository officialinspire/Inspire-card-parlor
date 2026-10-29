import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { audio, type Sfx } from '@/audio';
import { fullscreen, isStandalone } from '@/utils/device';
import { icon, type IconName } from './icons';
import { live } from './live';
import { notify } from './Notifications';

/**
 * The table's compact toolbar. Games put their primary actions (Pause, Undo,
 * Hint, New Game) in `primary`; the toolbar adds Music and Settings and a
 * More button whose panel holds everything else (rules, statistics, the
 * game's secondary actions, full screen and the way home). The playing area
 * stays as large as possible.
 */

export interface ToolOptions {
  action: string;
  sfx?: Sfx | null;
  disabled?: boolean;
  /** Toggle buttons report their state through aria-pressed. */
  pressed?: boolean;
}

/** One toolbar button: an icon over a short label. */
export function toolButton(name: IconName, label: string, onClick: () => void, opts: ToolOptions): HTMLButtonElement {
  const btn = h(
    'button',
    {
      type: 'button',
      class: 'tool-btn',
      'data-action': opts.action,
      title: label,
      disabled: opts.disabled,
      onclick: () => {
        if (opts.sfx !== null) audio.play(opts.sfx ?? 'tap');
        onClick();
      },
    },
    icon(name),
    h('span', { class: 'tool-label' }, label),
  ) as HTMLButtonElement;
  if (opts.pressed !== undefined) btn.setAttribute('aria-pressed', String(opts.pressed));
  return btn;
}

/** Updates a tool button's icon and label in place (Pause ↔ Resume). */
export function setTool(btn: HTMLElement, name: IconName, label: string): void {
  btn.replaceChildren(icon(name), h('span', { class: 'tool-label' }, label));
  btn.title = label;
}

/** A row in the More panel. */
export function moreItem(name: IconName, label: string, onClick: () => void, action: string): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: 'more-item',
      'data-action': action,
      onclick: () => {
        audio.play('tap');
        onClick();
      },
    },
    icon(name),
    h('span', null, label),
  ) as HTMLButtonElement;
}

export interface GameToolbarOptions {
  onSettings: () => void;
  onRules?: () => void;
  onStats?: () => void;
  onHome: () => void;
}

export interface GameToolbar {
  el: HTMLElement;
  /** Primary game actions go here, in order. */
  primary: HTMLElement;
  /** Secondary game actions (shown in the More panel). */
  more: HTMLElement;
  closeMore(): void;
  destroy(): void;
}

export function gameToolbar(store: Store, opts: GameToolbarOptions): GameToolbar {
  const primary = h('div', { class: 'toolbar-group toolbar-primary' });
  const gameMore = h('div', { class: 'more-group', 'data-more': 'game' });

  const music = live(
    toolButton('music', 'Music', () => toggleMusic(), { action: 'music', sfx: null }),
    (s) => s.settings.musicMuted,
    (btn, muted) => {
      setTool(btn, muted ? 'musicOff' : 'music', 'Music');
      btn.setAttribute('aria-pressed', String(!muted));
      btn.title = muted ? 'Music off — tap to turn on' : 'Music on — tap to turn off';
    },
  );
  const toggleMusic = () => {
    const muted = !store.state.settings.musicMuted;
    audio.play('tap');
    store.dispatch({ type: 'UPDATE_SETTINGS', patch: { musicMuted: muted } });
  };
  const settings = toolButton('settings', 'Settings', () => opts.onSettings(), { action: 'game-settings' });
  const moreBtn = toolButton('more', 'More', () => setOpen(!open), { action: 'more' });
  moreBtn.setAttribute('aria-haspopup', 'true');
  moreBtn.setAttribute('aria-expanded', 'false');

  // Full screen where the browser allows it; elsewhere (iPhone Safari) a
  // focus mode that folds the header away so the cards get the room.
  const screenItem = (): HTMLButtonElement => {
    if (fullscreen.supported()) {
      return live(
        moreItem('expand', 'Full screen', () => void fullscreen.toggle(), 'fullscreen'),
        (s) => s.fullscreen,
        (b, on) => {
          b.replaceChildren(icon(on ? 'shrink' : 'expand'), h('span', null, on ? 'Exit full screen' : 'Full screen'));
          b.setAttribute('aria-pressed', String(on));
        },
      );
    }
    let focusOn = false;
    const item = moreItem(
      'focus',
      'Focus mode',
      () => {
        focusOn = !focusOn;
        document.documentElement.classList.toggle('focus-mode', focusOn);
        item.setAttribute('aria-pressed', String(focusOn));
        if (focusOn && !isStandalone())
          notify('Tip: add the parlor to your Home Screen to play in full screen.', { kind: 'info', duration: 4000 });
      },
      'focus-mode',
    );
    item.setAttribute('aria-pressed', 'false');
    return item;
  };

  const panel = h(
    'div',
    { class: 'more-panel', role: 'menu', 'aria-label': 'More', hidden: true, 'data-more-panel': '' },
    opts.onRules ? moreItem('info', 'How to play', () => opts.onRules!(), 'rules') : null,
    opts.onStats ? moreItem('stats', 'Statistics', () => opts.onStats!(), 'game-stats') : null,
    gameMore,
    isStandalone() && !fullscreen.supported() ? null : screenItem(),
    (() => {
      const home = moreItem('home', 'Main menu', () => opts.onHome(), 'home');
      home.dataset.nav = 'home';
      return home;
    })(),
  );
  // Picking any item closes the panel (the item's own action runs first).
  panel.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) setOpen(false);
  });

  let open = false;
  function setOpen(next: boolean): void {
    open = next;
    panel.hidden = !open;
    moreBtn.setAttribute('aria-expanded', String(open));
    el.classList.toggle('more-open', open);
    if (open) panel.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }
  const onDocDown = (e: PointerEvent) => {
    if (open && !el.contains(e.target as Node)) setOpen(false);
  };
  // Escape closes the panel before it can mean "leave the table".
  const onKey = (e: KeyboardEvent) => {
    if (open && e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      setOpen(false);
      moreBtn.focus();
    }
  };
  addEventListener('pointerdown', onDocDown, true);
  addEventListener('keydown', onKey, true);

  const el = h(
    'nav',
    { class: 'game-toolbar', role: 'toolbar', 'aria-label': 'Game controls' },
    primary,
    h('div', { class: 'toolbar-group toolbar-system' }, music, settings, moreBtn),
    panel,
  );

  return {
    el,
    primary,
    more: gameMore,
    closeMore: () => setOpen(false),
    destroy() {
      removeEventListener('pointerdown', onDocDown, true);
      removeEventListener('keydown', onKey, true);
      document.documentElement.classList.remove('focus-mode');
    },
  };
}

/** "Paused" veil over a table, with a Resume button. */
export function pauseVeil(onResume: () => void): HTMLElement {
  const resume = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-gold btn-lg',
      'data-action': 'resume',
      onclick: () => {
        audio.play('tap');
        onResume();
      },
    },
    icon('play'),
    h('span', { class: 'btn-label' }, 'Resume'),
  );
  return h('div', { class: 'table-pause', hidden: true, 'data-paused': '' }, h('p', null, 'Paused'), resume);
}
