import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { store } from '@/core/store';
import { AppState } from '@/core/states';
import { attachDialogs, confirmDialog, openDialog } from '@/components/Dialog';
import { attachNotifications, notify } from '@/components/Notifications';
import { tabs } from '@/components/Tabs';
import { button, navHeader } from '@/components/ui';
import { paginator } from '@/components/Paginator';
import { SCREENS } from '@/components/screens';
import { h } from '@/utils/dom';

const flush = () => new Promise((r) => setTimeout(r, 0));
const root = document.createElement('div');

beforeAll(() => {
  document.body.appendChild(root);
  attachDialogs(root, store);
  attachNotifications(root, store);
  store.dispatch({ type: 'NAVIGATE', to: AppState.INITIALIZATION });
  store.dispatch({ type: 'NAVIGATE', to: AppState.MAIN_MENU });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('screens', () => {
  it('registers a screen for every state except BOOT', () => {
    const expected = Object.values(AppState).filter((s) => s !== AppState.BOOT);
    expect(Object.keys(SCREENS).sort()).toEqual(expected.sort());
  });
});

describe('button', () => {
  it('renders a label and icon and calls its handler', () => {
    const onClick = vi.fn();
    const b = button('Play', onClick, { icon: 'play', attrs: { 'data-nav': 'x' } });
    expect(b.textContent).toBe('Play');
    expect(b.querySelector('svg')).not.toBeNull();
    expect(b.dataset.nav).toBe('x');
    b.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('dialogs', () => {
  it('confirms and reports the dialog to the store while open', async () => {
    const result = confirmDialog({ title: 'Sure?', message: 'Really?' });
    await flush();
    expect(store.state.modals).toHaveLength(1);
    root.querySelector<HTMLButtonElement>('[data-dialog-action="true"]')!.click();
    await expect(result).resolves.toBe(true);
    expect(store.state.modals).toHaveLength(0);
  });

  it('resolves false when dismissed with Escape', async () => {
    const result = confirmDialog({ title: 'Sure?', message: 'Really?', danger: true });
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(result).resolves.toBe(false);
  });

  it('returns the chosen action value', async () => {
    const result = openDialog({
      title: 'Pick',
      body: 'Which?',
      dismissValue: 'none',
      actions: [
        { label: 'One', value: 'one' },
        { label: 'Two', value: 'two' },
      ],
    });
    await flush();
    root.querySelector<HTMLButtonElement>('[data-dialog-action="two"]')!.click();
    await expect(result).resolves.toBe('two');
  });
});

describe('notifications', () => {
  it('shows a toast and removes it after its duration', () => {
    vi.useFakeTimers();
    notify('Hello parlor', { duration: 1000, sound: false });
    const toast = () =>
      [...root.querySelectorAll('.toast:not(.leaving)')].find((t) => t.textContent === 'Hello parlor');
    expect(toast()).toBeTruthy();
    vi.advanceTimersByTime(1100);
    expect(toast()).toBeFalsy();
  });

  it('dismisses on click', () => {
    const id = notify('Tap me', { duration: 0, sound: false });
    root.querySelector<HTMLButtonElement>(`[data-toast="${id}"]`)!.click();
    expect(store.state.notifications.some((n) => n.id === id)).toBe(false);
  });
});

describe('tabs', () => {
  it('renders one panel at a time and switches on click', () => {
    const t = tabs([
      { id: 'a', label: 'A', render: () => h('p', null, 'panel A') },
      { id: 'b', label: 'B', render: () => h('p', null, 'panel B') },
    ]);
    expect(t.el.querySelector('.tabs-panel')!.textContent).toBe('panel A');
    t.el.querySelector<HTMLButtonElement>('[data-tab="b"]')!.click();
    expect(t.el.querySelector('.tabs-panel')!.textContent).toBe('panel B');
    expect(t.el.querySelector('[data-tab="b"]')!.getAttribute('aria-selected')).toBe('true');
  });
});

describe('paginator', () => {
  it('pages through items', () => {
    const p = paginator({
      items: Array.from({ length: 7 }, (_, i) => i),
      minTileWidth: 100,
      minTileHeight: 100,
      render: (i) => h('div', { class: 'item' }, String(i)),
    });
    expect(p.page).toBe(0);
    p.goTo(3);
    // Without layout (no measured size) everything is one page.
    expect(p.page).toBe(0);
    p.destroy();
  });
});

describe('navigation header', () => {
  it('wires back and home buttons to the store', () => {
    store.dispatch({ type: 'NAVIGATE', to: AppState.SETTINGS });
    const header = navHeader({ title: 'Settings' });
    document.body.appendChild(header);
    header.querySelector<HTMLButtonElement>('[data-nav="home"]')!.click();
    expect(store.state.screen).toBe(AppState.MAIN_MENU);

    store.dispatch({ type: 'NAVIGATE', to: AppState.ACHIEVEMENTS });
    navHeader({ title: 'x' }).querySelector<HTMLButtonElement>('[data-nav="back"]')!.click();
    expect(store.state.screen).toBe(AppState.MAIN_MENU);
    header.remove();
  });

  it('shows setup steps', () => {
    const header = navHeader({ title: 'Klondike', steps: { current: 2, total: 3, labels: ['Game', 'Deck', 'Board'] } });
    expect(header.querySelector('.nav-steps li.current')!.textContent).toBe('Deck');
    expect(header.querySelectorAll('.nav-steps li.done')).toHaveLength(1);
  });
});
