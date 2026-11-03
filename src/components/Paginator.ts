import { releaseLive } from './live';
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
// Fewest dots a row ever shows: first, last and the current page with a neighbour each side.
const MIN_DOTS = 5;
// A dot's target width, and what the two arrows and the row's gaps take beside them.
const DOT_W = 30;
const NAV_CHROME = 2 * 44 + 2 * 10;

/** How many dots fit beside the arrows in a row this wide. */
export function maxDotsFor(width: number): number {
  return clamp(Math.floor((width - NAV_CHROME) / DOT_W), MIN_DOTS, MAX_DOTS);
}

/**
 * Page dots to show: every page when they fit in `maxDots`, otherwise the ends
 * plus the current neighbourhood, sized so the dots and their "…" gaps still fit.
 */
export function pageDots(page: number, pages: number, maxDots = MAX_DOTS): number[] {
  if (pages <= maxDots) return Array.from({ length: pages }, (_, i) => i);
  // Two "…" gaps take roughly one more dot's width: leave room for the ends and them.
  return dotWindow(page, pages, Math.max(3, maxDots - 4));
}

/** Page dots to show when there are too many for one row: ends plus the current neighbourhood. */
export function dotWindow(page: number, pages: number, span = 5): number[] {
  const set = new Set([0, pages - 1]);
  const from = clamp(page - Math.floor(span / 2), 0, pages - span);
  for (let i = from; i < from + span; i++) set.add(i);
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
    sfx: null,
    attrs: { 'data-pager': 'prev' },
  });
  const next = iconButton('chevronRight', 'Next page', () => go(page + 1), {
    sfx: null,
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
  /** The grid and page last laid out by `measure`. */
  let drawnKey = '';

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
    // Same grid, same page: keep the tiles (and whatever has focus in them).
    const key = `${layout.cols}x${layout.rows}:${page}:${maxDotsFor(w)}`;
    if (key === drawnKey) return;
    drawnKey = key;
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
    const tiles = opts.items
      .slice(page * perPage, (page + 1) * perPage)
      .map((item, i) => opts.render(item, page * perPage + i));
    // A tile that is itself a control (a button, a radio…) keeps its own role, so screen
    // readers still announce it as one; the page is then a labelled group. Plain tiles
    // (cards holding their own buttons) are list items in a list.
    const interactive = tiles.some(
      (t) => t.hasAttribute('role') || /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName),
    );
    grid.setAttribute('role', interactive ? 'group' : 'list');
    for (const t of tiles) if (!interactive) t.setAttribute('role', 'listitem');
    releaseLive(grid);
    grid.replaceChildren(...tiles);
    if (direction) {
      grid.classList.remove('page-in-left', 'page-in-right');
      void grid.offsetWidth;
      grid.classList.add(direction > 0 ? 'page-in-right' : 'page-in-left');
    }
    nav.hidden = pages <= 1;
    prev.disabled = page === 0;
    next.disabled = page >= pages - 1;
    status.textContent = `Page ${page + 1} of ${pages}`;
    // Many pages: the first, the last and the current neighbourhood, as many as the
    // row has room for beside the arrows, so it never overflows a narrow phone.
    const shown = pageDots(page, pages, maxDotsFor(viewport.clientWidth || el.clientWidth));
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
    audio.play('flip');
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
    const forward = e.key === 'PageDown' || (e.key === 'ArrowRight' && e.target === viewport);
    const back = e.key === 'PageUp' || (e.key === 'ArrowLeft' && e.target === viewport);
    if (forward || back) {
      e.preventDefault();
      go(page + (forward ? 1 : -1));
    }
  });

  // Re-lay out on the next frame, and only when the size really changed: laying out
  // inside the observer's own callback can resize the box it watches, which the
  // browser reports as "ResizeObserver loop completed with undelivered notifications".
  let lastSize = '';
  let frame = 0;
  const ro = new ResizeObserver((entries) => {
    const r = entries[entries.length - 1]?.contentRect;
    const size = r ? `${Math.round(r.width)}x${Math.round(r.height)}` : '';
    if (size === lastSize) return;
    lastSize = size;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
  });
  ro.observe(viewport);

  return {
    el,
    /** Re-render the current page (e.g. after a selection changed). */
    refresh: () => draw(),
    goTo: go,
    get page() {
      return page;
    },
    destroy: () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      releaseLive(el);
    },
  };
}

/** Paginator as a tab panel element; `Tabs` calls `destroy` when switching away. */
export function paginatorPanel<T>(opts: PaginatorOptions<T>): HTMLElement {
  const p = paginator(opts);
  return Object.assign(p.el, { destroy: p.destroy });
}
