import { h } from '@/utils/dom';
import { audio, type Sfx } from '@/audio';
import { goBack } from '@/core/store';

type BtnVariant = 'primary' | 'ghost' | 'icon' | 'plain';

export function button(
  label: string | Node,
  onClick: (e: MouseEvent) => void,
  opts: { variant?: BtnVariant; sfx?: Sfx | null; title?: string; disabled?: boolean; class?: string } = {},
): HTMLButtonElement {
  const { variant = 'primary', sfx = 'tap', title, disabled, class: extra = '' } = opts;
  return h(
    'button',
    {
      type: 'button',
      class: `btn btn-${variant} ${extra}`.trim(),
      title,
      'aria-label': title,
      disabled,
      onclick: (e: MouseEvent) => {
        if (sfx) audio.play(sfx);
        onClick(e);
      },
    },
    label,
  );
}

export function backButton(onClick: () => void = goBack): HTMLButtonElement {
  return button(h('span', { 'aria-hidden': 'true' }, '‹'), onClick, {
    variant: 'icon',
    sfx: 'back',
    title: 'Back',
    class: 'btn-back',
  });
}

/**
 * Standard full-height screen frame: header / body (fills, never scrolls) / footer.
 */
export function screenFrame(opts: {
  title: string;
  subtitle?: string;
  back?: boolean | (() => void);
  actions?: Node[];
  body: Node;
  footer?: Node | null;
  class?: string;
}): HTMLElement {
  const back = opts.back === undefined ? true : opts.back;
  return h(
    'section',
    { class: `frame ${opts.class ?? ''}`.trim() },
    h(
      'header',
      { class: 'frame-header' },
      back ? backButton(typeof back === 'function' ? back : undefined) : h('span', { class: 'frame-spacer' }),
      h(
        'div',
        { class: 'frame-titles' },
        h('h1', { class: 'screen-title', tabindex: '-1' }, opts.title),
        opts.subtitle ? h('p', { class: 'screen-subtitle' }, opts.subtitle) : null,
      ),
      h('div', { class: 'frame-actions' }, ...(opts.actions ?? [])),
    ),
    h('div', { class: 'frame-body' }, opts.body),
    opts.footer ? h('footer', { class: 'frame-footer' }, opts.footer) : null,
  );
}

export function badge(text: string, kind = ''): HTMLElement {
  return h('span', { class: `badge ${kind}`.trim() }, text);
}

export function progressBar(ratio: number, label?: string): HTMLElement {
  return h(
    'div',
    {
      class: 'progress',
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(Math.round(ratio * 100)),
      'aria-label': label,
    },
    h('div', { class: 'progress-fill', style: { width: `${Math.round(ratio * 100)}%` } }),
  );
}

export function stars(n: number, max = 3): HTMLElement {
  return h('span', { class: 'stars', 'aria-label': `Difficulty ${n} of ${max}` }, '★'.repeat(n) + '☆'.repeat(max - n));
}
