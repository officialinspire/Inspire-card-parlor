import { h } from '@/utils/dom';
import { audio } from '@/audio';

export function toggle(label: string, value: boolean, onChange: (v: boolean) => void, hint?: string): HTMLElement {
  const input = h('input', {
    type: 'checkbox',
    role: 'switch',
    checked: value,
    onchange: () => {
      audio.play('tap');
      onChange(input.checked);
    },
  });
  return h(
    'label',
    { class: 'control control-toggle' },
    h(
      'span',
      { class: 'control-text' },
      h('span', { class: 'control-label' }, label),
      hint ? h('small', null, hint) : null,
    ),
    input,
    h('span', { class: 'switch', 'aria-hidden': 'true' }),
  );
}

export function slider(label: string, value: number, onChange: (v: number) => void): HTMLElement {
  const out = h('output', { class: 'control-value' }, `${Math.round(value * 100)}%`);
  const input = h('input', {
    type: 'range',
    min: '0',
    max: '100',
    step: '5',
    value: String(Math.round(value * 100)),
    'aria-label': label,
    oninput: () => {
      out.textContent = `${input.value}%`;
      onChange(Number(input.value) / 100);
    },
    onchange: () => audio.play('tap'),
  });
  return h('label', { class: 'control control-slider' }, h('span', { class: 'control-label' }, label), input, out);
}

export function segmented<T extends string>(
  label: string,
  options: { value: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
): HTMLElement {
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const render = (current: T) =>
    group.replaceChildren(
      ...options.map((o) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(o.value === current),
            class: o.value === current ? 'active' : '',
            onclick: () => {
              audio.play('tap');
              render(o.value);
              onChange(o.value);
            },
          },
          o.label,
        ),
      ),
    );
  render(value);
  return h('div', { class: 'control control-segmented' }, h('span', { class: 'control-label' }, label), group);
}
