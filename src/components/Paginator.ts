import { h } from '@/utils/dom';
import { audio } from '@/audio';
import { clamp } from '@/utils/math';
import { button } from './ui';

export interface PaginatorOptions<T> {
  items: readonly T[];
  render: (item: T, index: number) => HTMLElement;
  /** Minimum tile footprint in px; used to fit as many tiles as the space allows. */
  minTileWidth: number;
  minTileHeight: number;
  gap?: number;
  /** Tiles grow up to this height (default 1.6× min) instead of stretching to fill. */
  maxTileHeight?: number;
  /** Clamp columns (e.g. list layouts use maxColumns: 1). */
  maxColumns?: number;
  label?: string;
  initialIndex?: number;
}

/**
 * Fits a grid of tiles into the available space and pages through the rest
 * instead of scrolling. Supports buttons, dots, swipe, wheel and arrow keys.
 */
export function paginator<T>(opts: PaginatorOptions<T>): { el: HTMLElement; refresh: () => void; destroy: () => void } {
  const gap = opts.gap ?? 12;
  const grid = h('div', { class: 'pager-grid', role: 'list', 'aria-label': opts.label });
  const dots = h('div', { class: 'pager-dots', role: 'tablist' });
  const prev = button('‹', () => go(page - 1), { variant: 'icon', sfx: 'flip', title: 'Previous page' });
  const next = button('›', () => go(page + 1), { variant: 'icon', sfx: 'flip', title: 'Next page' });
  const nav = h('div', { class: 'pager-nav' }, prev, dots, next);
  const viewport = h('div', { class: 'pager-viewport' }, grid);
  const el = h('div', { class: 'pager' }, viewport, nav);

  let perPage = 1;
  let cols = 1;
  let page = 0;
  let pages = 1;

  function layout(): void {
    const { clientWidth: w, clientHeight: hgt } = viewport;
    if (!w || !hgt) return;
    const fitCols = clamp(Math.floor((w + gap) / (opts.minTileWidth + gap)), 1, opts.maxColumns ?? 99);
    const rows = Math.max(1, Math.floor((hgt + gap) / (opts.minTileHeight + gap)));
    // Never leave columns empty when there are fewer items than fit across.
    cols = Math.max(1, Math.min(fitCols, opts.items.length));
    const first = page * perPage;
    perPage = cols * rows;
    pages = Math.max(1, Math.ceil(opts.items.length / perPage));
    page = clamp(Math.floor(first / perPage), 0, pages - 1);
    draw();
  }

  function draw(direction = 0): void {
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gap = `${gap}px`;
    const maxH = opts.maxTileHeight ?? Math.round(opts.minTileHeight * 1.6);
    grid.style.gridAutoRows = `minmax(${opts.minTileHeight}px, ${maxH}px)`;
    grid.replaceChildren(
      ...opts.items.slice(page * perPage, (page + 1) * perPage).map((item, i) => {
        const tile = opts.render(item, page * perPage + i);
        tile.setAttribute('role', 'listitem');
        return tile;
      }),
    );
    if (direction) {
      grid.classList.remove('page-in-left', 'page-in-right');
      void grid.offsetWidth;
      grid.classList.add(direction > 0 ? 'page-in-right' : 'page-in-left');
    }
    nav.hidden = pages <= 1;
    prev.disabled = page === 0;
    next.disabled = page >= pages - 1;
    dots.replaceChildren(
      ...Array.from({ length: pages }, (_, i) =>
        h('button', {
          type: 'button',
          class: `pager-dot${i === page ? ' active' : ''}`,
          role: 'tab',
          'aria-selected': String(i === page),
          'aria-label': `Page ${i + 1} of ${pages}`,
          onclick: () => {
            audio.play('flip');
            go(i);
          },
        }),
      ),
    );
  }

  function go(p: number): void {
    const target = clamp(p, 0, pages - 1);
    if (target === page) return;
    const dir = Math.sign(target - page);
    page = target;
    draw(dir);
  }

  // Swipe
  let startX = 0;
  let startY = 0;
  let tracking = false;
  viewport.addEventListener('pointerdown', (e) => {
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
  });
  viewport.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - startY) * 1.5) {
      audio.play('flip');
      go(page + (dx < 0 ? 1 : -1));
    }
  });
  viewport.addEventListener('pointercancel', () => (tracking = false));
  // Wheel / trackpad
  let wheelLock = 0;
  viewport.addEventListener(
    'wheel',
    (e) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 20 || Date.now() < wheelLock) return;
      wheelLock = Date.now() + 350;
      go(page + Math.sign(d));
    },
    { passive: true },
  );
  // Keyboard
  el.addEventListener('keydown', (e) => {
    if (e.key === 'PageDown') go(page + 1);
    if (e.key === 'PageUp') go(page - 1);
  });

  const ro = new ResizeObserver(() => layout());
  ro.observe(viewport);

  if (opts.initialIndex) {
    // Page is resolved once the first layout knows perPage.
    requestAnimationFrame(() => go(Math.floor(opts.initialIndex! / perPage)));
  }

  return { el, refresh: () => draw(), destroy: () => ro.disconnect() };
}

/** Paginator as a tab panel element; `Tabs` calls `destroy` when switching away. */
export function paginatorPanel<T>(opts: PaginatorOptions<T>): HTMLElement {
  const p = paginator(opts);
  return Object.assign(p.el, { destroy: p.destroy });
}
