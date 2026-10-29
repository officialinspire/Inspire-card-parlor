import { frag, h } from '@/utils/dom';
import { audio, type Sfx } from '@/audio';
import { AppState } from '@/core/states';
import { goBack, navigate } from '@/core/store';
import { fullscreen } from '@/utils/device';
import { icon, type IconName } from './icons';
import { live } from './live';

export type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'icon' | 'plain' | 'danger';

export interface ButtonOptions {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  sfx?: Sfx | null;
  title?: string;
  disabled?: boolean;
  class?: string;
  /** Extra attributes, e.g. { 'data-nav': 'SETTINGS' }. */
  attrs?: Record<string, string>;
}

/** The one button component every screen uses: consistent look, sound and press feedback. */
export function button(label: string | Node | null, onClick: (e: MouseEvent) => void, opts: ButtonOptions = {}) {
  const { variant = 'primary', size = 'md', sfx = 'tap', title, disabled, attrs = {} } = opts;
  const el = h(
    'button',
    {
      type: 'button',
      class: `btn btn-${variant} btn-${size} ${opts.class ?? ''}`.trim(),
      title,
      'aria-label': title,
      disabled,
      ...attrs,
      onclick: (e: MouseEvent) => {
        if (sfx) audio.play(sfx);
        onClick(e);
      },
    },
    opts.icon ? icon(opts.icon) : null,
    label == null ? null : typeof label === 'string' ? h('span', { class: 'btn-label' }, label) : label,
  );
  return el;
}

export const iconButton = (name: IconName, title: string, onClick: () => void, opts: ButtonOptions = {}) =>
  button(null, onClick, { variant: 'icon', icon: name, title, ...opts });

/** Fullscreen toggle that tracks the real fullscreen state. Hidden where unsupported (e.g. iPhone Safari). */
export function fullscreenButton(): HTMLElement | null {
  if (!fullscreen.supported()) return null;
  const btn = iconButton('expand', 'Enter fullscreen', () => void fullscreen.toggle(), {
    attrs: { 'data-action': 'fullscreen' },
  });
  return live(
    btn,
    (s) => s.fullscreen,
    (el, on) => {
      el.replaceChildren(icon(on ? 'shrink' : 'expand'));
      el.title = on ? 'Exit fullscreen' : 'Enter fullscreen';
      el.setAttribute('aria-label', el.title);
      el.setAttribute('aria-pressed', String(on));
    },
  );
}

export function creditsPill(): HTMLElement {
  return live(
    h('span', { class: 'pill pill-credits', title: 'Credits' }),
    (s) => s.profile.credits,
    (el, credits) => el.replaceChildren(icon('credits'), h('span', null, credits.toLocaleString())),
  );
}

export function levelPill(): HTMLElement {
  return live(
    h('span', { class: 'pill pill-level', title: 'Player level' }),
    (s) => s.profile.level,
    (el, level) => el.replaceChildren(h('span', { class: 'pill-level-num' }, String(level)), h('span', null, 'Lv')),
  );
}

export interface NavHeaderOptions {
  title: string;
  subtitle?: string;
  /** true = history back, function = custom handler, false = hidden. */
  back?: boolean | (() => void);
  /** Show the home (main menu) button. */
  home?: boolean | (() => void);
  steps?: { current: number; total: number; labels?: string[] };
  actions?: (Node | null)[];
  showCredits?: boolean;
}

/** Shared navigation header: back · title (+steps) · credits · home · fullscreen. */
export function navHeader(opts: NavHeaderOptions): HTMLElement {
  const { back = true, home = true, showCredits = true } = opts;
  const backEl = back
    ? iconButton('back', 'Back', typeof back === 'function' ? back : goBack, {
        sfx: 'back',
        class: 'btn-back',
        attrs: { 'data-nav': 'back' },
      })
    : h('span', { class: 'nav-spacer' });

  const steps = opts.steps
    ? h(
        'ol',
        { class: 'nav-steps', 'aria-label': `Step ${opts.steps.current} of ${opts.steps.total}` },
        ...Array.from({ length: opts.steps.total }, (_, i) =>
          h(
            'li',
            { class: i + 1 === opts.steps!.current ? 'current' : i + 1 < opts.steps!.current ? 'done' : '' },
            opts.steps!.labels?.[i] ?? String(i + 1),
          ),
        ),
      )
    : null;

  return h(
    'header',
    { class: 'nav-header' },
    backEl,
    h(
      'div',
      { class: 'nav-titles' },
      h('h1', { class: 'screen-title', tabindex: '-1' }, opts.title),
      steps ?? (opts.subtitle ? h('p', { class: 'screen-subtitle' }, opts.subtitle) : null),
    ),
    h(
      'div',
      { class: 'nav-actions' },
      ...(opts.actions ?? []),
      showCredits ? creditsPill() : null,
      home
        ? iconButton('home', 'Main menu', typeof home === 'function' ? home : () => navigate(AppState.MAIN_MENU), {
            sfx: 'back',
            attrs: { 'data-nav': 'home' },
          })
        : null,
      fullscreenButton(),
    ),
  );
}

/** Standard full-height screen: nav header / body (fills, never scrolls) / footer. */
export function screenFrame(
  opts: NavHeaderOptions & { body: Node; footer?: Node | null; class?: string },
): HTMLElement {
  return h(
    'section',
    { class: `frame ${opts.class ?? ''}`.trim() },
    navHeader(opts),
    h('div', { class: 'frame-body' }, opts.body),
    opts.footer ? h('footer', { class: 'frame-footer' }, opts.footer) : null,
  );
}

export function badge(text: string, kind = ''): HTMLElement {
  return h('span', { class: `badge ${kind}`.trim() }, text);
}

export function progressBar(ratio: number, label?: string): HTMLElement {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return h(
    'div',
    {
      class: 'progress',
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(pct),
      'aria-label': label,
    },
    h('div', { class: 'progress-fill', style: { width: `${pct}%` } }),
  );
}

const DIFFICULTY_LABEL = ['', 'Relaxed', 'Thoughtful', 'Challenging'];

export function difficulty(n: number, max = 3): HTMLElement {
  return h(
    'span',
    { class: 'difficulty', 'aria-label': `Difficulty: ${DIFFICULTY_LABEL[n] ?? n} (${n} of ${max})` },
    frag(...Array.from({ length: max }, (_, i) => h('span', { class: `pip${i < n ? ' on' : ''}` }))),
    h('span', { class: 'difficulty-label' }, DIFFICULTY_LABEL[n] ?? ''),
  );
}

/** Key/value stat used on cards and in the statistics screen. */
export function statItem(label: string, value: string | number): HTMLElement {
  return h(
    'div',
    { class: 'stat-item' },
    h('span', { class: 'stat-value' }, String(value)),
    h('span', { class: 'stat-label' }, label),
  );
}
