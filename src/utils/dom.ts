type Child = Node | string | number | false | null | undefined;
type Attrs = Record<string, unknown> & {
  class?: string;
  style?: Partial<CSSStyleDeclaration> | Record<`--${string}`, string> | string;
  dataset?: Record<string, string>;
};

/**
 * Tiny hyperscript helper: h('button', { class: 'btn', onclick }, 'Play').
 * `on*` function props become event listeners; everything else becomes an attribute.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key === 'style' && typeof value === 'object') {
        for (const [prop, v] of Object.entries(value as Record<string, string>)) {
          if (prop.startsWith('--')) el.style.setProperty(prop, v);
          else (el.style as unknown as Record<string, string>)[prop] = v;
        }
      } else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function')
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: (Child | Child[])[]): void {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Build an inline SVG element from markup (trusted, static strings only). */
export function svg(markup: string): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGElement;
}

export function frag(...children: (Child | Child[])[]): DocumentFragment {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}
