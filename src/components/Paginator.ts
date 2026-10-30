import { h } from '@/utils/dom';
import { audio } from '@/audio';
import { clamp } from '@/utils/math';
import { iconButton } from './ui';

export interface PaginatorOptions<T> {
  items: readonly T[];
  render: (item: T, index: number) => HTMLElement;
  /** Minimum tile footprint in px; used to fit as many tiles as the space allows. */
  minTileWidth: number;
  minTileHeight: number;
  /** Tiles grow up to this height (default 1.6× min) instead of stretching to fill. */
  maxTileHeight?: number;
  /** Stretch rows to fill the whole viewport (large "one card per page" carousels). */
  fill?: boolean;
  gap?: number;
  /** Clamp columns (e.g. list layouts use maxColumns: 1). */
  maxColumns?: number;
  /** Clamp rows (carousels use maxRows: 1). */
  maxRows?: number;
  label?: string;
  initialIndex?: number;
  onPageChange?: (page: number, pages: number) => void;
}

const MAX_DOTS = 9;

/** Page dots to show when there are too many for one row: ends plus the current neighbourhood. */
export function dotWindow(page: number, pages: number): number[] {
  const set = new Set([0, pages - 1]);
  const from = clamp(page - 2, 0, pages - 5);
  for (let i = from; i < from + 5; i++) set.add(i);
  return [...set].filter((i) => i >= 0 && i < pages).sort((a, b) => a - b);
}

export interface GridLayout {
  cols: number;
  rows: number;
  perPage: number;
  pages: number;
}

/** Pure layout math, shared with tests: how many tiles fit, and how many pages that makes. */
export function computeGrid(
  width: number,
  height: number,
  count: number,
  o: Pick<PaginatorOptions<unknown>, 'minTileWidth' | 'minTileHeight' | 'maxColumns' | 'maxRows' | 'gap'>,
): GridLayout {
  const gap = o.gap ?? 12;
  const fitCols = clamp(Math.floor((width + gap) / (o.minTileWidth + gap)), 1, o.maxColumns ?? 99);
  const rows = clamp(Math.floor((height + gap) / (o.minTileHeight + gap)), 1, o.maxRows ?? 99);
  // Never leave columns empty when there are fewer items than fit across.
  const cols = Math.max(1, Math.min(fitCols, count));
  const perPage = cols * rows;
  return { cols, rows, perPage, pages: Math.max(1, Math.ceil(count / perPage)) };
}

/**
 * Fits a grid of tiles into the available space and pages through the rest
 * instead of scrolling. Supports buttons, dots, swipe, wheel and keys.
 */
export function paginator<T>(opts: PaginatorOptions<T>) {
  const gap = opts.gap ?? 12;
  const grid = h('div', { class: 'pager-grid', role: 'list', 'aria-label': opts.label });
  const dots = h('div', { class: 'pager-dots' });
  const status = h('span', { class: 'sr-only', 'aria-live': 'polite' });
  const prev = iconButton('chevronLeft', 'Previous page', () => go(page - 1), {
    sfx: 'flip',
    attrs: { 'data-pager': 'prev' },
  });
  const next = iconButton('chevronRight', 'Next page', () => go(page + 1), {
    sfx: 'flip',
    attrs: { 'data-pager': 'next' },
  });
  const nav = h(
    'nav',
    { class: 'pager-nav', 'aria-label': `${opts.label ?? 'Items'} pages` },
    prev,
    dots,
    next,
    status,
  );
  const viewport = h('div', { class: 'pager-viewport', tabindex: '-1' }, grid);
  const el = h('div', { class: 'pager' }, viewport, nav);
  nav.hidden = true;

  let layout: GridLayout = { cols: 1, rows: 1, perPage: 1, pages: 1 };
  let page = 0;
  let pendingIndex = opts.initialIndex ?? -1;

  // Space the page controls take (44px buttons + 10px gap), reserved only when there are several pages.
  const NAV_SPACE = 54;

  function measure(): void {
    const { clientWidth: w, clientHeight: hgt } = viewport;
    if (!w || !hgt) return;
    const first = pendingIndex >= 0 ? pendingIndex : page * layout.perPage;
    // Measure against the total space (as if the nav were hidden), then make room for
    // the nav only if it will be shown. The result no longer depends on the nav's
    // current visibility, so showing it does not trigger a second, different layout.
    const total = hgt + (nav.hidden ? 0 : NAV_SPACE);
    const o = { ...opts, gap };
    layout = computeGrid(w, total, opts.items.length, o);
    if (layout.pages > 1) layout = computeGrid(w, total - NAV_SPACE, opts.items.length, o);
    page = clamp(Math.floor(first / layout.perPage), 0, layout.pages - 1);
    pendingIndex = -1;
    draw();
  }

  function draw(direction = 0): void {
    const { cols, perPage, pages } = layout;
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gap = `${gap}px`;
    grid.style.gridAutoRows = opts.fill
      ? 'minmax(0, 1fr)'
      : `minmax(${opts.minTileHeight}px, ${opts.maxTileHeight ?? Math.round(opts.minTileHeight * 1.6)}px)`;
    grid.classList.toggle('fill', !!opts.fill);
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
    status.textContent = `Page ${page + 1} of ${pages}`;
    // Many pages: the first, the last and the current neighbourhood, so the row never overflows.
    const shown = pages <= MAX_DOTS ? Array.from({ length: pages }, (_, i) => i) : dotWindow(page, pages);
    dots.replaceChildren(
      ...shown
        .map((i, k) =>
          i - (shown[k - 1] ?? i - 1) > 1
            ? [h('span', { class: 'pager-gap', 'aria-hidden': 'true' }, '…'), dotButton(i)]
            : [dotButton(i)],
        )
        .flat(),
    );
    function dotButton(i: number) {
      return h('button', {
        type: 'button',
        class: `pager-dot${i === page ? ' active' : ''}`,
        'aria-current': i === page ? 'page' : null,
        'aria-label': `Page ${i + 1} of ${pages}`,
        'data-pager': `dot-${i}`,
        onclick: () => {
          audio.play('flip');
          go(i);
        },
      });
    }
    opts.onPageChange?.(page, pages);
  }

  function go(p: number): void {
    const target = clamp(p, 0, layout.pages - 1);
    if (target === page) return;
    const dir = Math.sign(target - page);
    page = target;
    draw(dir);
  }

  // Swipe (ignored when the gesture starts on a control inside a tile)
  let startX = 0;
  let startY = 0;
  let tracking = false;
  viewport.addEventListener('pointerdown', (e) => {
    tracking = e.isPrimary;
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
    if (e.key === 'PageDown' || (e.key === 'ArrowRight' && e.target === viewport)) go(page + 1);
    if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && e.target === viewport)) go(page - 1);
  });

  const ro = new ResizeObserver(() => measure());
  ro.observe(viewport);

  return {
    el,
    /** Re-render the current page (e.g. after a selection changed). */
    refresh: () => draw(),
    goTo: go,
    get page() {
      return page;
    },
    destroy: () => ro.disconnect(),
  };
}

/** Paginator as a tab panel element; `Tabs` calls `destroy` when switching away. */
export function paginatorPanel<T>(opts: PaginatorOptions<T>): HTMLElement {
  const p = paginator(opts);
  return Object.assign(p.el, { destroy: p.destroy });
}
