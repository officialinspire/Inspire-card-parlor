import { h } from '@/utils/dom';
import { audio } from '@/audio';

export interface TabDef {
  id: string;
  label: string;
  icon?: string;
  render: () => HTMLElement;
}

/** Accessible tab strip with a single lazily-rendered panel. */
export function tabs(defs: TabDef[], opts: { initial?: string; onChange?: (id: string) => void } = {}) {
  let active = opts.initial ?? defs[0]!.id;
  let cleanup: (() => void) | null = null;
  const strip = h('div', { class: 'tabs-strip', role: 'tablist' });
  const panel = h('div', { class: 'tabs-panel', role: 'tabpanel' });
  const el = h('div', { class: 'tabs' }, strip, panel);

  const buttons = defs.map((d) =>
    h(
      'button',
      {
        type: 'button',
        class: 'tab',
        role: 'tab',
        id: `tab-${d.id}`,
        onclick: () => {
          if (d.id === active) return;
          audio.play('tap');
          select(d.id);
        },
        onkeydown: (e: KeyboardEvent) => {
          const i = defs.findIndex((x) => x.id === active);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const n = defs[(i + (e.key === 'ArrowRight' ? 1 : defs.length - 1)) % defs.length]!;
            select(n.id);
            buttons[defs.indexOf(n)]!.focus();
          }
        },
      },
      d.icon ? h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, d.icon) : null,
      h('span', { class: 'tab-label' }, d.label),
    ),
  );
  strip.append(...buttons);

  function select(id: string): void {
    active = id;
    defs.forEach((d, i) => {
      const on = d.id === id;
      buttons[i]!.classList.toggle('active', on);
      buttons[i]!.setAttribute('aria-selected', String(on));
      buttons[i]!.tabIndex = on ? 0 : -1;
    });
    cleanup?.();
    const content = defs.find((d) => d.id === id)!.render();
    cleanup = (content as HTMLElement & { destroy?: () => void }).destroy ?? null;
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    panel.replaceChildren(content);
    opts.onChange?.(id);
  }

  select(active);
  return { el, select, destroy: () => cleanup?.() };
}
