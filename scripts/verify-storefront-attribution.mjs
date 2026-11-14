import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const listeners = {},
  events = [],
  storage = new Map(),
  links = [];
let consent = true,
  config;
const location = new URL(
  'https://www.inspireclothing.art/?utm_source=newsletter&utm_medium=email&utm_campaign=november_games',
);
const sdk = {
  capture(event, properties) {
    const safe = config.before_send({ event, properties });
    if (safe) events.push(safe);
  },
  opt_out_capturing() {},
  opt_in_capturing() {},
};
const document = {
  referrer: '',
  addEventListener(name, fn) {
    (listeners[name] ??= []).push(fn);
  },
  getElementById() {
    return { classList: { contains: () => true } };
  },
  querySelectorAll() {
    return links;
  },
};
const window = {
  Shopify: { customerPrivacy: { analyticsProcessingAllowed: () => consent } },
  crypto: webcrypto,
  posthog: {
    __loaded: true,
    init(_key, c) {
      config = c;
      c.loaded(sdk);
    },
  },
};
vm.runInNewContext(
  fs.readFileSync(new URL('../integrations/shopify/inspire-store-analytics.js', import.meta.url), 'utf8'),
  {
    window,
    document,
    location,
    navigator: {},
    URL,
    URLSearchParams,
    Date,
    Math,
    sessionStorage: {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    },
  },
);
function anchor(game, modal = false) {
  const attrs = { href: `https://officialinspire.github.io/${game}/` };
  const a = {
    getAttribute: (k) => attrs[k],
    setAttribute: (k, v) => (attrs[k] = v),
    hasAttribute: (k) => k in attrs,
    removeAttribute: (k) => delete attrs[k],
    classList: { contains: (k) => modal && k === 'js-inspire-play' },
    closest: (q) => (q === 'a[href]' ? a : null),
  };
  links.push(a);
  return a;
}
function click(target, opts = {}) {
  for (const fn of listeners.click) fn({ type: 'click', button: 0, target, ...opts });
}
const a = anchor('GRIDLOCK');
click(a);
const one = events.find((e) => e.event === 'game_cta_clicked');
assert.equal(one.properties.utm_source, 'newsletter');
assert.equal(one.properties.utm_campaign, 'november_games');
assert.equal(new URL(a.getAttribute('href')).searchParams.get('utm_medium'), 'email');
assert.equal(
  new URLSearchParams(new URL(a.getAttribute('href')).hash.slice(1)).get('inspire_launch_id'),
  one.properties.launch_id,
);
assert.equal(events.at(-1).event, 'game_outbound_launched');
assert.equal(events.at(-1).properties.launch_id, one.properties.launch_id);
click(a);
assert.notEqual(events.at(-1).properties.launch_id, one.properties.launch_id);
const b = anchor('SHELLS-FEATHERS', true);
click(b);
assert.equal(events.at(-1).event, 'game_cta_clicked');
const launch = events.at(-1).properties.launch_id;
click({ closest: (q) => (q === '[data-game-modal-continue]' ? {} : null) });
assert.equal(events.at(-1).event, 'game_outbound_launched');
assert.equal(events.at(-1).properties.launch_id, launch);
const before = events.length;
consent = false;
listeners.visitorConsentCollected.forEach((fn) => fn());
click(a);
assert.equal(events.length, before);
assert.equal(new URL(a.getAttribute('href')).hash, '');
console.log(
  'PASS website click → outbound launch, fresh click IDs, modal continuation, campaign retention and consent revocation',
);
