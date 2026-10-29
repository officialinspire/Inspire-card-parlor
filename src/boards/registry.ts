import type { AssetStatus } from '@/decks/types';
import { studioCredit } from '@/decks/assets';
import type { BoardDefinition } from './types';

export type { BoardDefinition, AmbientKind } from './types';

const assets = (id: string, status: AssetStatus = 'pending') => ({
  basePath: `assets/backgrounds/${id}/`,
  status,
  background: { path: 'background', formats: ['webp', 'png'] as ('webp' | 'png')[] },
  preview: { path: 'preview', formats: ['webp', 'png'] as ('webp' | 'png')[] },
});

const LIGHT_INK = '#fff8ee';
const DARK_INK = '#2a231c';
/** For mid-tone wood, where the regular dark ink falls just short of 4.5:1. */
const DEEP_INK = '#140e08';

/**
 * Gameboards. Artwork is uploaded separately (see public/assets/backgrounds/);
 * until then each board is drawn with the CSS surface below. Boards are purely
 * cosmetic and never touch game state.
 */
const registry: BoardDefinition[] = [
  {
    id: 'picnic_table',
    name: 'Picnic Table',
    description: 'Weathered wooden planks in dappled sunlight, ready for an afternoon game.',
    artist: studioCredit(),
    rarity: 'common',
    unlock: { type: 'default' },
    assets: assets('picnic_table', 'ready'),
    surface: {
      base: '#c57232',
      felt: 'repeating-linear-gradient(0deg, rgba(90,50,20,.35) 0 2px, transparent 2px 64px), linear-gradient(#c98a4f, #b8743d)',
      rim: '#7a4a24',
    },
    ink: DEEP_INK,
    ambient: 'breeze',
    art: { focus: { portrait: '50% 50%', landscape: '50% 46%' }, scrim: 0.06 },
  },
  {
    id: 'backroom_card_table',
    name: 'Backroom Card Table',
    description: 'The INSPIRE emerald felt table with its carved wooden rail.',
    artist: studioCredit(),
    rarity: 'common',
    unlock: { type: 'default' },
    assets: assets('backroom_card_table', 'ready'),
    surface: {
      base: '#1d5236',
      felt: 'radial-gradient(120% 90% at 50% 25%, #2f7a4f 0%, #1d5236 55%, #10301f 100%)',
      rim: '#5a3a22',
    },
    ink: LIGHT_INK,
    ambient: 'dust',
    art: { focus: { portrait: '50% 48%', landscape: '50% 42%' }, scrim: 0 },
  },
  {
    id: 'downtown_cafe',
    name: 'Downtown Café',
    description: 'A marble-topped café table by the window.',
    artist: { name: null, note: 'Board artwork pending upload.' },
    rarity: 'common',
    unlock: { type: 'level', value: 2 },
    assets: assets('downtown_cafe'),
    surface: {
      base: '#d8d2c8',
      felt: 'radial-gradient(60% 40% at 30% 30%, rgba(255,255,255,.55), transparent 70%), linear-gradient(115deg, transparent 40%, rgba(120,110,100,.12) 41%, transparent 43%), linear-gradient(160deg, #ece7df, #d8d2c8 60%, #c9c1b5)',
      rim: '#6b4b34',
    },
    ink: DARK_INK,
    ambient: 'steam',
  },
  {
    id: 'rappahannock_riverside',
    name: 'Rappahannock Riverside',
    description: 'A woven game mat spread on the mossy bank of the Rappahannock.',
    artist: studioCredit(),
    rarity: 'rare',
    unlock: { type: 'story', value: 'chapter-2' },
    assets: assets('rappahannock_riverside', 'ready'),
    surface: {
      base: '#daac73',
      felt: 'repeating-linear-gradient(45deg, rgba(120,90,50,.18) 0 3px, transparent 3px 6px), linear-gradient(#d6bd8e, #c9ad7c)',
      rim: '#4f5e3a',
    },
    ink: DARK_INK,
    ambient: 'river',
    art: { focus: { portrait: '50% 50%', landscape: '50% 50%' }, scrim: 0.14 },
  },
  {
    id: 'woodland_clearing',
    name: 'Woodland Clearing',
    description: 'A mossy stump table deep in the trees.',
    artist: { name: null, note: 'Board artwork pending upload.' },
    rarity: 'rare',
    unlock: { type: 'level', value: 4 },
    assets: assets('woodland_clearing'),
    surface: {
      base: '#38512f',
      felt: 'radial-gradient(90% 70% at 50% 40%, #4c6b3c 0%, #38512f 60%, #24361f 100%)',
      rim: '#5b4128',
    },
    ink: LIGHT_INK,
    ambient: 'leaves',
  },
  {
    id: 'jak_golds_casino',
    name: "Jak Gold's Casino",
    description: 'High-stakes felt trimmed in gold.',
    artist: { name: null, note: 'Board artwork pending upload.' },
    rarity: 'epic',
    unlock: { type: 'achievement', value: 'war-flawless' },
    assets: assets('jak_golds_casino'),
    surface: {
      base: '#5e1420',
      felt: 'radial-gradient(120% 90% at 50% 30%, #86222f 0%, #5e1420 55%, #340910 100%)',
      rim: '#b88a2e',
    },
    ink: LIGHT_INK,
    ambient: 'sparkle',
  },
  {
    id: 'artists_studio',
    name: "Artist's Studio",
    description: 'A paint-flecked worktable covered in canvas.',
    artist: { name: null, note: 'Board artwork pending upload.' },
    rarity: 'rare',
    unlock: { type: 'achievement', value: 'collector-5' },
    assets: assets('artists_studio'),
    surface: {
      base: '#e3dccd',
      felt: 'radial-gradient(6px 6px at 18% 24%, rgba(200,100,63,.5), transparent), radial-gradient(8px 8px at 72% 66%, rgba(95,138,110,.45), transparent), radial-gradient(5px 5px at 40% 80%, rgba(111,143,174,.5), transparent), repeating-linear-gradient(45deg, rgba(0,0,0,.025) 0 2px, transparent 2px 4px), linear-gradient(#efe9dc, #e3dccd)',
      rim: '#8a6a4a',
    },
    ink: DARK_INK,
    ambient: 'paint',
  },
  {
    id: 'safehouse',
    name: 'Safehouse',
    description: 'A steel table, a dim bulb, rain on the glass.',
    artist: { name: null, note: 'Board artwork pending upload.' },
    rarity: 'epic',
    unlock: { type: 'level', value: 8 },
    assets: assets('safehouse'),
    surface: {
      base: '#2b3036',
      felt: 'repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 28px), linear-gradient(180deg, #353b42, #2b3036 60%, #20242a)',
      rim: '#14171b',
    },
    ink: LIGHT_INK,
    ambient: 'rain',
  },
  {
    id: 'masonic_study',
    name: 'Masonic Study',
    description: 'A mahogany desk in a candlelit study.',
    artist: { name: null, note: 'Board artwork pending upload.' },
    rarity: 'legendary',
    unlock: { type: 'level', value: 12 },
    assets: assets('masonic_study'),
    surface: {
      base: '#1f2a44',
      felt: 'radial-gradient(100% 80% at 50% 35%, rgba(31,42,68,.2), rgba(14,19,32,.75)), repeating-conic-gradient(#25314f 0 25%, #1b2440 0 50%) 0 0 / 56px 56px',
      rim: '#5a2d1c',
    },
    ink: LIGHT_INK,
    ambient: 'candle',
  },
];

export const DEFAULT_BOARD_ID = 'backroom_card_table';

export function registerBoard(board: BoardDefinition): void {
  if (registry.some((b) => b.id === board.id)) throw new Error(`Board "${board.id}" is already registered`);
  registry.push(board);
}

export const allBoards = (): BoardDefinition[] => registry;
export const hasBoard = (id: string) => registry.some((b) => b.id === id);
export const getBoard = (id: string): BoardDefinition =>
  registry.find((b) => b.id === id) ?? registry.find((b) => b.id === DEFAULT_BOARD_ID)!;

/** @deprecated Use allBoards(); kept for screens that iterate the catalog. */
export const BOARDS: readonly BoardDefinition[] = registry;
