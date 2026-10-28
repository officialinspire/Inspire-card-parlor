import { RANKS, SUITS, cardCode, type CardCode, type Suit } from '@/engine/Card';

/**
 * Checks the atlas.json written by scripts/art/extract_cards.py for a deck
 * cut from an uploaded sprite sheet. Pure, so the validation script and the
 * tests share it.
 */

export interface AtlasFrameRecord {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardCheck {
  colour: 'red' | 'black';
  colourOk: boolean;
  pips?: number;
  pipsOk?: boolean;
}

export interface ArtworkIssue {
  cards: string[];
  issue: string;
  /** Which automated checks this issue explains. */
  checks?: ('colour' | 'pips')[];
}

export interface AtlasReport {
  deck: string;
  source: string;
  sourceSize: { width: number; height: number };
  sourceRows: string[];
  cell: { width: number; height: number };
  layout: { columns: number; rows: number; suitOrder: string[]; rankOrder: string[] };
  frames: Record<string, AtlasFrameRecord>;
  extras: Record<string, AtlasFrameRecord>;
  jokers: number;
  verification: Record<string, CardCheck>;
  reviewedOk: Record<string, string>;
  artworkIssues: ArtworkIssue[];
}

export interface AtlasProblem {
  code: string;
  message: string;
}

const ALL_CODES: CardCode[] = SUITS.flatMap((s) => RANKS.map((r) => cardCode(r, s)));

/** Touching cards may share a few edge pixels after the cut; more than that means two codes point at one card. */
const EDGE_TOLERANCE = 3;
const overlaps = (a: AtlasFrameRecord, b: AtlasFrameRecord) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EDGE_TOLERANCE &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EDGE_TOLERANCE;

/** Every automated flag must be either confirmed correct by eye or listed as an artwork issue. */
export function unexplainedFlags(r: AtlasReport): string[] {
  const out: string[] = [];
  for (const [code, v] of Object.entries(r.verification)) {
    const failed: ('colour' | 'pips')[] = [];
    if (!v.colourOk) failed.push('colour');
    if (v.pipsOk === false) failed.push('pips');
    for (const check of failed) {
      const explained =
        code in r.reviewedOk || r.artworkIssues.some((i) => i.cards.includes(code) && i.checks?.includes(check));
      if (!explained) out.push(`${code} (${check})`);
    }
  }
  return out;
}

/**
 * @param sheetSize natural size of faces.webp
 */
export function checkAtlasReport(r: AtlasReport, sheetSize: { width: number; height: number }): AtlasProblem[] {
  const problems: AtlasProblem[] = [];
  const add = (code: string, message: string) => problems.push({ code, message });

  // The normalized sheet uses the engine's default grid: 13 × 4, A…K by ♠ ♥ ♦ ♣.
  if (r.layout.columns !== 13 || r.layout.rows !== 4) add('layout', 'faces.webp must be a 13 × 4 grid');
  if (r.layout.suitOrder.join() !== SUITS.join()) add('layout.suits', 'rows must be ♠ ♥ ♦ ♣');
  if (sheetSize.width !== r.cell.width * 13 || sheetSize.height !== r.cell.height * 4)
    add('sheet.size', `faces.webp is ${sheetSize.width}×${sheetSize.height}, expected 13 × 4 cells`);

  // 52 distinct cards, each cut from its own part of the source sheet.
  const codes = Object.keys(r.frames);
  const missing = ALL_CODES.filter((c) => !codes.includes(c));
  const unknown = codes.filter((c) => !ALL_CODES.includes(c as CardCode));
  if (missing.length) add('frames.missing', `missing ${missing.join(', ')}`);
  if (unknown.length) add('frames.unknown', `unknown codes ${unknown.join(', ')}`);
  const entries = Object.entries(r.frames);
  for (const [code, f] of entries) {
    if (f.x < 0 || f.y < 0 || f.x + f.w > r.sourceSize.width || f.y + f.h > r.sourceSize.height)
      add('frames.bounds', `${code} lies outside the source sheet`);
    if (f.w < 40 || f.h < 60) add('frames.size', `${code} is too small to be a card`);
  }
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++)
      if (overlaps(entries[i]![1], entries[j]![1]))
        add('frames.overlap', `${entries[i]![0]} and ${entries[j]![0]} come from the same part of the sheet`);

  // Each source row holds one suit, in A…K order left to right.
  r.sourceRows.forEach((suit) => {
    if (!(SUITS as readonly string[]).includes(suit)) return add('rows', `unknown suit "${suit}"`);
    const inRow = RANKS.map((rank) => r.frames[cardCode(rank, suit as Suit)]);
    if (inRow.some((f) => !f)) return;
    const ys = inRow.map((f) => f!.y + f!.h / 2);
    if (Math.max(...ys) - Math.min(...ys) > r.cell.height / 2) add('frames.row', `${suit} cards are not on one row`);
    for (let k = 1; k < inRow.length; k++)
      if (inRow[k]!.x <= inRow[k - 1]!.x) add('frames.order', `${suit} cards are not in A…K order`);
  });

  if (!r.extras.back) add('back', 'no card back on the sheet');
  const flags = unexplainedFlags(r);
  if (flags.length) add('verification', `unreviewed identity flags: ${flags.join(', ')}`);
  return problems;
}

/** Reads width × height from a WebP file header (VP8, VP8L or VP8X). */
export function webpSize(buf: Uint8Array): { width: number; height: number } {
  const text = (o: number, n: number) => String.fromCharCode(...buf.subarray(o, o + n));
  if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WEBP') throw new Error('not a WebP file');
  const chunk = text(12, 4);
  const u16 = (o: number) => buf[o]! | (buf[o + 1]! << 8);
  const u24 = (o: number) => buf[o]! | (buf[o + 1]! << 8) | (buf[o + 2]! << 16);
  if (chunk === 'VP8X') return { width: u24(24) + 1, height: u24(27) + 1 };
  if (chunk === 'VP8 ') return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const b = (o: number) => buf[21 + o]!;
    return { width: 1 + (((b(1) & 0x3f) << 8) | b(0)), height: 1 + (((b(3) & 0xf) << 10) | (b(2) << 2) | (b(1) >> 6)) };
  }
  throw new Error(`unknown WebP chunk ${chunk}`);
}
