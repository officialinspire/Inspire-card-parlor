import { h, svg } from '@/utils/dom';
import type { GameId } from '@/core/types';

/*
 * Flat, ink-outlined illustrations. Colors come from `.ill-*` classes so the
 * day and night palettes recolor every drawing without new artwork.
 */

/** The parlor's front window: neighborhood rooftops, a hanging lamp, plants and the house cat. */
export function parlorScene(className = ''): SVGElement {
  return svg(`
<svg class="ill ill-scene ${className}" viewBox="0 0 400 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <rect class="ill-wall" width="400" height="260"/>
  <g class="ill-wallpaper">
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 50 - 10} 0v260" />`).join('')}
  </g>
  <!-- window -->
  <rect class="ill-frame" x="96" y="26" width="208" height="150" rx="10"/>
  <rect class="ill-sky" x="106" y="36" width="188" height="130" rx="4"/>
  <circle class="ill-orb" cx="250" cy="70" r="16"/>
  <g class="ill-town">
    <path d="M106 166v-40h24v-14l12-10 12 10v54z"/>
    <path d="M150 166v-52h18l10-12 10 12h14v52z"/>
    <path d="M196 166v-34h20v-10h22v10h12v34z"/>
    <path d="M244 166v-46l14-12 14 12v4h22v42z"/>
  </g>
  <g class="ill-lights">
    <rect x="114" y="134" width="6" height="7" rx="1"/><rect x="160" y="124" width="6" height="7" rx="1"/>
    <rect x="178" y="140" width="6" height="7" rx="1"/><rect x="222" y="140" width="6" height="7" rx="1"/>
    <rect x="254" y="128" width="6" height="7" rx="1"/><rect x="276" y="142" width="6" height="7" rx="1"/>
  </g>
  <path class="ill-line" d="M200 36v130M106 100h188" />
  <rect class="ill-sill" x="88" y="174" width="224" height="10" rx="3"/>
  <!-- lamp -->
  <path class="ill-line" d="M58 0v40"/>
  <path class="ill-lamp" d="M36 66c0-14 10-24 22-24s22 10 22 24z"/>
  <ellipse class="ill-glow" cx="58" cy="70" rx="40" ry="10"/>
  <!-- plant on sill -->
  <path class="ill-pot" d="M278 152h28l-4 22h-20z"/>
  <path class="ill-leaf" d="M292 152c-10-10-14-22-8-30 8 6 10 18 8 30zM292 152c4-14 14-22 24-20-2 10-12 18-24 20zM292 152c-8-4-20-2-24 6 8 4 18 2 24-6z"/>
  <!-- hanging plant -->
  <path class="ill-line" d="M352 0v34"/>
  <path class="ill-pot" d="M336 34h32l-4 18h-24z"/>
  <path class="ill-leaf" d="M342 50c-4 14-2 30 6 38M352 52c0 16 2 28-2 44M362 50c6 12 6 26 2 36" fill="none" stroke-width="5"/>
  <!-- table -->
  <rect class="ill-table" x="0" y="206" width="400" height="54"/>
  <path class="ill-table-edge" d="M0 206h400v8H0z"/>
  <!-- cards on table -->
  <g transform="translate(150 186) rotate(-10)"><rect class="ill-card" width="34" height="46" rx="4"/><path class="ill-suit-red" d="M17 14c-4-6-12-2-8 5l8 8 8-8c4-7-4-11-8-5z"/></g>
  <g transform="translate(184 182) rotate(6)"><rect class="ill-card-back" width="34" height="46" rx="4"/><rect class="ill-card-back-inner" x="5" y="5" width="24" height="36" rx="2"/></g>
  <g transform="translate(214 188) rotate(16)"><rect class="ill-card" width="34" height="46" rx="4"/><path class="ill-suit-ink" d="M17 12l9 12c2 4-2 8-6 6l-2-2 2 7h-6l2-7-2 2c-4 2-8-2-6-6z"/></g>
  <!-- teacup -->
  <path class="ill-cup" d="M296 190h30v10a15 15 0 0 1-30 0z"/>
  <path class="ill-line" d="M326 194c8 0 8 10 0 10" fill="none"/>
  <path class="ill-steam" d="M304 182c-4-6 4-8 0-14M316 182c-4-6 4-8 0-14" fill="none"/>
  <!-- cat -->
  <g class="ill-cat" transform="translate(40 168)">
    <path d="M10 38c0-20 12-30 28-30 6 0 12 2 16 6l6-10 4 14c4 6 4 14 2 20z"/>
    <path d="M10 38c-8 0-12-6-8-10" fill="none" class="ill-cat-tail"/>
    <path class="ill-cat-eye" d="M46 22c2 2 4 2 6 0M56 22c1 1.5 3 1.5 4 0" fill="none"/>
  </g>
</svg>`);
}

const card = (x: number, y: number, r = 0, cls = 'ill-card') =>
  `<rect class="${cls}" x="${x}" y="${y}" width="26" height="36" rx="3" transform="rotate(${r} ${x + 13} ${y + 18})"/>`;
const back = (x: number, y: number, r = 0) =>
  `${card(x, y, r, 'ill-card-back')}<rect class="ill-card-back-inner" x="${x + 4}" y="${y + 4}" width="18" height="28" rx="2" transform="rotate(${r} ${x + 13} ${y + 18})"/>`;
const heart = (x: number, y: number, s = 1) =>
  `<path class="ill-suit-red" transform="translate(${x} ${y}) scale(${s})" d="M0 4c-3-5-10-2-6 4l6 6 6-6c4-6-3-9-6-4z"/>`;
const spade = (x: number, y: number, s = 1) =>
  `<path class="ill-suit-ink" transform="translate(${x} ${y}) scale(${s})" d="M0 -6l7 9c2 3-1 6-4 5l-2-1 1 5h-4l1-5-2 1c-3 1-6-2-4-5z"/>`;

const THUMBS: Record<GameId, string> = {
  klondike: `
    ${[0, 1, 2, 3, 4].map((c) => Array.from({ length: c + 1 }, (_, r) => (r < c ? back(14 + c * 34, 30 + r * 8) : card(14 + c * 34, 30 + r * 8))).join('')).join('')}
    ${heart(27, 52, 0.9)}${spade(61, 64, 0.9)}${heart(95, 76, 0.9)}${spade(129, 88, 0.9)}${heart(163, 100, 0.9)}`,
  spider: `
    <g class="ill-web">
      <path d="M100 6v108M46 60h108M62 22l76 76M138 22l-76 76" />
      <path d="M100 26l22 12 12 22-12 22-22 12-22-12-12-22 12-22z" fill="none"/>
      <path d="M100 42l12 6 6 12-6 12-12 6-12-6-6-12 6-12z" fill="none"/>
    </g>
    ${back(22, 70, -14)}${back(152, 70, 14)}
    ${card(87, 66)}${spade(100, 86, 1)}
    <g class="ill-spider"><circle cx="100" cy="30" r="5"/><path d="M95 28l-6-4M95 32l-6 4M105 28l6-4M105 32l6 4" fill="none"/></g>`,
  freecell: `
    ${[0, 1, 2, 3].map((i) => `<rect class="ill-slot" x="${12 + i * 31}" y="12" width="26" height="36" rx="3"/>`).join('')}
    ${card(43, 12)}${heart(56, 26, 0.7)}
    ${[0, 1, 2, 3, 4, 5].map((c) => [0, 1, 2].map((r) => card(14 + c * 30, 60 + r * 12)).join('')).join('')}
    ${heart(27, 96, 0.8)}${spade(57, 98, 0.8)}${heart(87, 96, 0.8)}${spade(117, 98, 0.8)}${heart(147, 96, 0.8)}${spade(177, 98, 0.8)}
    <g class="ill-foundation"><rect x="140" y="12" width="26" height="36" rx="3"/><rect x="170" y="12" width="26" height="36" rx="3"/></g>`,
  war: `
    <g transform="translate(46 30) rotate(-14 20 30)"><rect class="ill-card" width="44" height="62" rx="5"/>${spade(22, 32, 1.6)}</g>
    <g transform="translate(110 30) rotate(14 20 30)"><rect class="ill-card" width="44" height="62" rx="5"/>${heart(22, 26, 1.6)}</g>
    <g class="ill-burst"><path d="M100 18l4 10 10-4-4 10 10 4-10 4 4 10-10-4-4 10-4-10-10 4 4-10-10-4 10-4-4-10 10 4z"/></g>
    ${back(10, 76, -6)}${back(164, 76, 6)}`,
  'go-fish': `
    <path class="ill-water" d="M0 70c20-8 40 8 60 0s40 8 60 0 40 8 60 0 20 0 20 0v50H0z"/>
    <g class="ill-fish" transform="translate(120 80)"><path d="M0 10c10-12 30-12 40 0-10 12-30 12-40 0zM40 10l12-8v16z"/><circle class="ill-fish-eye" cx="10" cy="8" r="2"/></g>
    <g class="ill-fish alt" transform="translate(30 92) scale(.7)"><path d="M0 10c10-12 30-12 40 0-10 12-30 12-40 0zM40 10l12-8v16z"/><circle class="ill-fish-eye" cx="10" cy="8" r="2"/></g>
    <path class="ill-line" d="M150 0c0 20-10 40-24 58" fill="none"/>
    <path class="ill-line" d="M126 58c-4 4 0 10 4 6" fill="none"/>
    ${card(40, 14, -16)}${heart(53, 28, 0.8)}${card(66, 10, -4)}${spade(79, 32, 0.8)}${card(92, 14, 10)}${heart(105, 28, 0.8)}`,
};

export function gameThumbnail(id: GameId, className = ''): SVGElement {
  return svg(
    `<svg class="ill ill-thumb ill-thumb-${id} ${className}" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <rect class="ill-felt" width="200" height="120" rx="10"/>${THUMBS[id]}
    </svg>`,
  );
}

/**
 * The INSPIRE Card Parlor logo. Its alt text carries the title for screen
 * readers; if the image cannot load, the alt text is shown in its place.
 */
export function brandLogo(className = ''): HTMLImageElement {
  return h('img', {
    class: `brand-logo ${className}`.trim(),
    src: `${import.meta.env.BASE_URL}assets/branding/logo.webp`,
    alt: 'INSPIRE Card Parlor',
    width: '960',
    height: '582',
    decoding: 'async',
  }) as HTMLImageElement;
}
