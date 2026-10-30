import { svg } from '@/utils/dom';
import type { AchievementDefinition } from '@/achievements/registry';
import { GLYPHS } from '@/achievements/glyphs';

let uid = 0;

/**
 * An achievement medal: a rimmed coin whose metal follows the rarity, with
 * the achievement's drawn glyph in the middle. Locked medals are drawn in
 * grey; secret ones hide their glyph behind a keyhole until earned.
 */
export function medal(
  a: AchievementDefinition,
  opts: { earned: boolean; size?: number } = { earned: true },
): SVGElement {
  const id = `m${++uid}`;
  const secret = a.hidden && !opts.earned;
  const glyph = secret ? GLYPHS.key : GLYPHS[a.icon];
  const size = opts.size ?? 48;
  return svg(
    `<svg class="medal medal-${a.rarity}${opts.earned ? ' earned' : ' locked'}" data-medal="${a.id}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="${id}-face" cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="var(--medal-hi)"/>
          <stop offset="1" stop-color="var(--medal-lo)"/>
        </radialGradient>
        <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--medal-rim-hi)"/>
          <stop offset=".5" stop-color="var(--medal-rim)"/>
          <stop offset="1" stop-color="var(--medal-rim-hi)"/>
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22.5" fill="url(#${id}-rim)"/>
      <circle cx="24" cy="24" r="18.5" fill="url(#${id}-face)"/>
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="var(--medal-line)" stroke-width="1" stroke-dasharray="1.5 2.2"/>
      <path d="M10 17a16 16 0 0 1 28 0" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5" stroke-linecap="round"/>
      <g transform="translate(12 12)" fill="currentColor" class="medal-glyph">${glyph}</g>
    </svg>`,
  );
}
