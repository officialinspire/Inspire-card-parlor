import type { Page } from '@playwright/test';

/**
 * Layout checks run in the page (Prompt 28): what a player would see as
 * broken, independent of any one screen.
 *
 *  · overflow — the page scrolls sideways (or, on navigation screens, at all);
 *  · clipped — text cut off by its box with no ellipsis or line clamp to say so;
 *  · unreachable — a control outside the viewport, unless it sits in an
 *    on-screen container that scrolls to it;
 *  · covered — another element sits over a control's centre;
 *  · tiny-target — a control smaller than 24px (pager dots excepted: their
 *    targets are larger than the dot);
 *  · tiny-text — UI text under 11px (card faces are artwork, not UI);
 *  · dialog-outside — the open dialog does not fit the viewport.
 */
export interface LayoutOptions {
  /** Navigation screens must not scroll the page at all (not just sideways). */
  noPageScroll?: boolean;
}

export async function layoutIssues(page: Page, opts: LayoutOptions = {}): Promise<string[]> {
  return page.evaluate(({ noPageScroll }) => {
    const W = innerWidth;
    const H = innerHeight;
    const out: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth > W + 1) out.push(`overflow: page is ${de.scrollWidth}px wide in ${W}px`);
    if (noPageScroll && de.scrollHeight > H + 1) out.push(`overflow: page scrolls (${de.scrollHeight}px in ${H}px)`);
    const dialogs = [...document.querySelectorAll<HTMLElement>('.dialog-backdrop:not([aria-hidden]) .dialog')];
    const top = dialogs.at(-1);
    const scope = top ?? document.querySelector<HTMLElement>('.screen:not([aria-hidden])');
    if (!scope) return ['no screen'];
    if (top) {
      const r = top.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)
        out.push(
          `dialog-outside: ${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}`,
        );
    }
    const shown = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (el.closest('[aria-hidden="true"]:not(.dialog-backdrop), [inert], .sr-only, .toast-region')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const label = (el: Element) =>
      (el.getAttribute('aria-label') || el.textContent || el.className.toString())
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
    for (const el of scope.querySelectorAll<HTMLElement>('*')) {
      if (!shown(el)) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (el.matches('button:not(:disabled), a[href], [role=tab], select, input:not([type=hidden])')) {
        const outside = r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1;
        if (outside) {
          let scroller: HTMLElement | null = null;
          for (let e = el.parentElement; e; e = e.parentElement) {
            const c = getComputedStyle(e);
            if (
              /(auto|scroll)/.test(c.overflowX + c.overflowY) &&
              (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
            ) {
              scroller = e;
              break;
            }
          }
          const sr = scroller?.getBoundingClientRect();
          const reachable = !!sr && sr.top >= -1 && sr.bottom <= H + 1 && sr.left >= -1 && sr.right <= W + 1;
          if (!reachable && !el.closest('.tabs-strip, .pager-viewport')) out.push(`unreachable: "${label(el)}"`);
        } else {
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const hit = document.elementFromPoint(x, y);
          if (hit && !el.contains(hit) && !hit.contains(el) && !hit.closest('.toast-region'))
            out.push(`covered: "${label(el)}" under ${hit.className.toString().split(' ')[0] || hit.tagName}`);
        }
        if ((r.width < 24 || r.height < 24) && !el.closest('.pager-dots')) out.push(`tiny-target: "${label(el)}"`);
      }
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!ownText) continue;
      if (parseFloat(cs.fontSize) < 11 && !el.closest('.card, .card-face, .avatar'))
        out.push(`tiny-text: "${label(el)}" ${cs.fontSize}`);
      // Text that spills visibly past the button it belongs to (onto its neighbour).
      const owner = el.closest('button, a[href]');
      if (owner && owner !== el.parentElement?.closest('.sr-only')) {
        const or = owner.getBoundingClientRect();
        for (const n of el.childNodes) {
          if (n.nodeType !== 3 || !n.textContent!.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          const tr = range.getBoundingClientRect();
          const clipped = /hidden|clip/.test(cs.overflowX) || /hidden|clip/.test(getComputedStyle(owner).overflowX);
          if (!clipped && (tr.right > or.right + 2 || tr.left < or.left - 2))
            out.push(`spills: "${label(el)}" past its button`);
        }
      }
      const clamped = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
      const hidesX = /hidden|clip/.test(cs.overflowX);
      const hidesY = /hidden|clip/.test(cs.overflowY);
      if (hidesX && cs.textOverflow !== 'ellipsis' && !clamped && el.scrollWidth > el.clientWidth + 2)
        out.push(`clipped: "${label(el)}" ${el.scrollWidth}px in ${el.clientWidth}px`);
      if (hidesY && !clamped && el.scrollHeight > el.clientHeight + 3)
        out.push(`clipped: "${label(el)}" ${el.scrollHeight}px tall in ${el.clientHeight}px`);
    }
    return [...new Set(out)];
  }, opts);
}
