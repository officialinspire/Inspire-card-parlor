import { ALL_CARD_CODES, RANKS, SUITS, cardCode, parseCardCode, type CardCode } from '@/engine/Card';
import { CHAPTERS } from '@/story/chapters';
import { ACHIEVEMENTS } from '@/achievements/registry';
import { MATURE_ASSET_ROOT } from './assets';
import type { AtlasGrid, BackAsset, DeckDefinition, FaceAssets, ImageRef, UnlockRequirement } from './types';

export type IssueLevel = 'error' | 'warning';

export interface DeckIssue {
  level: IssueLevel;
  code: string;
  message: string;
}

/** One file the deck needs; any of `candidates` satisfies it (e.g. back.webp or back.png). */
export interface RequiredFile {
  purpose: string;
  candidates: string[];
}

export interface DeckReport {
  deckId: string;
  status: DeckDefinition['assets']['status'];
  ok: boolean;
  issues: DeckIssue[];
  requiredFiles: RequiredFile[];
  missingFiles: RequiredFile[];
}

const ID_RE = /^[a-z0-9_]+$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

const files = (base: string, ref: ImageRef, defaults: string[] = ['webp', 'png']) =>
  (ref.formats ?? defaults).map((f) => `${base}${ref.path}.${f}`);

/** Which card codes a grid sheet maps, and any collisions with the back cell. */
export function gridCoverage(grid: AtlasGrid): { codes: Set<CardCode>; problems: string[] } {
  const problems: string[] = [];
  const suits = grid.suitOrder ?? [...SUITS];
  const ranks = grid.rankOrder ?? [...RANKS];
  if (new Set(suits).size !== suits.length) problems.push('suitOrder has duplicates');
  if (new Set(ranks).size !== ranks.length) problems.push('rankOrder has duplicates');
  const codes = new Set<CardCode>();
  suits.forEach((suit, row) =>
    ranks.forEach((rank, col) => {
      if (row < grid.rows && col < grid.columns) codes.add(cardCode(rank, suit));
    }),
  );
  if (grid.backCell) {
    const { column, row } = grid.backCell;
    if (column >= grid.columns || row >= grid.rows) problems.push('backCell is outside the grid');
    else if (row < suits.length && column < ranks.length) problems.push('backCell overlaps a card face');
  }
  return { codes, problems };
}

function checkUnlock(u: UnlockRequirement, add: (l: IssueLevel, c: string, m: string) => void): void {
  switch (u.type) {
    case 'default':
      return;
    case 'level':
      if (!Number.isInteger(u.value) || u.value < 1)
        add('error', 'unlock.level', 'Level unlock needs a positive integer');
      return;
    case 'story':
      if (!CHAPTERS.some((c) => c.id === u.value)) add('error', 'unlock.story', `Unknown story chapter "${u.value}"`);
      return;
    case 'achievement':
      if (!ACHIEVEMENTS.some((a) => a.id === u.value))
        add('error', 'unlock.achievement', `Unknown achievement "${u.value}"`);
      return;
    default:
      add('error', 'unlock.type', `Unknown unlock type "${(u as { type: string }).type}"`);
  }
}

function checkFaces(
  faces: FaceAssets,
  back: BackAsset,
  base: string,
  add: (l: IssueLevel, c: string, m: string) => void,
  required: RequiredFile[],
  label = '',
): void {
  if (faces.type === 'atlas') {
    required.push({ purpose: `${label}face sprite sheet`, candidates: files(base, faces.image) });
    if (faces.metaPath) required.push({ purpose: `${label}atlas metadata`, candidates: [`${base}${faces.metaPath}`] });
    const covered = new Set<string>();
    if (faces.grid) {
      const { codes, problems } = gridCoverage(faces.grid);
      problems.forEach((p) => add('error', 'atlas.grid', p));
      codes.forEach((c) => covered.add(c));
    }
    if (faces.frames) {
      for (const [key, f] of Object.entries(faces.frames)) {
        if (key !== 'back' && !parseCardCode(key)) add('error', 'atlas.frames', `Unknown frame "${key}"`);
        if (!f || f.w <= 0 || f.h <= 0) add('error', 'atlas.frames', `Frame "${key}" has no size`);
        if (f && faces.size && (f.x < 0 || f.y < 0 || f.x + f.w > faces.size.width || f.y + f.h > faces.size.height)) {
          add(
            'error',
            'atlas.frames',
            `Frame "${key}" lies outside the ${faces.size.width}×${faces.size.height} sheet`,
          );
        }
        covered.add(key);
      }
      if (!faces.size && !faces.grid)
        add('warning', 'atlas.size', 'Explicit frames without a sheet size cannot be bounds-checked');
    }
    // A metadata file is checked when it is present on disk (see validateAtlasMeta).
    if (!faces.metaPath) {
      const missing = ALL_CARD_CODES.filter((c) => !covered.has(c));
      if (missing.length) add('error', 'faces.missing', `Sprite sheet has no frame for: ${missing.join(', ')}`);
    }
    if ('atlasFrame' in back) {
      const hasBack = covered.has('back') || !!faces.grid?.backCell || !!faces.metaPath;
      if (!hasBack) add('error', 'back.frame', 'Back uses the atlas but the atlas has no "back" frame');
    }
  } else {
    if (!faces.pattern.includes('{code}')) add('error', 'faces.pattern', 'Individual face pattern must contain {code}');
    for (const code of ALL_CARD_CODES) {
      required.push({
        purpose: `${label}face ${code}`,
        candidates: files(base, {
          path: faces.pattern.replace('{code}', code),
          formats: faces.formats ?? ['webp', 'png'],
        }),
      });
    }
  }
  if (!('atlasFrame' in back)) required.push({ purpose: `${label}card back`, candidates: files(base, back) });
}

/** Static checks plus the list of files the deck needs. Does not touch the file system. */
export function validateDeckDefinition(deck: DeckDefinition, allIds: string[] = [deck.id]): DeckReport {
  const issues: DeckIssue[] = [];
  const add = (level: IssueLevel, code: string, message: string) => issues.push({ level, code, message });
  const required: RequiredFile[] = [];
  const { assets } = deck;

  if (!ID_RE.test(deck.id)) add('error', 'id', `Deck id "${deck.id}" must be lowercase letters, digits and _`);
  if (allIds.filter((id) => id === deck.id).length > 1)
    add('error', 'id.duplicate', `Deck id "${deck.id}" is registered twice`);
  if (!deck.name?.trim()) add('error', 'name', 'Display name is required');
  if (!deck.description?.trim()) add('error', 'description', 'Description is required');
  if (!deck.artist) add('error', 'artist', 'Artist attribution is required');
  else if (!deck.artist.name) {
    add(assets.status === 'ready' ? 'error' : 'warning', 'artist.name', 'Artist name not set yet');
  }
  checkUnlock(deck.unlock, add);

  // Content isolation: adult-themed assets live only under the mature folder.
  if (!assets.basePath.endsWith('/')) add('error', 'basePath', 'basePath must end with "/"');
  if (!assets.basePath.startsWith('assets/cards/')) add('error', 'basePath', 'basePath must be under assets/cards/');
  const inMature = assets.basePath.startsWith(MATURE_ASSET_ROOT);
  if (deck.contentRating === 'mature' && !inMature) {
    add('error', 'mature.isolation', `Mature deck assets must live under ${MATURE_ASSET_ROOT}`);
  }
  if (deck.contentRating !== 'mature' && inMature) {
    add('error', 'mature.isolation', 'General deck must not use the mature asset folder');
  }

  checkFaces(assets.faces, assets.back, assets.basePath, add, required);
  required.push({ purpose: 'preview image', candidates: files(assets.basePath, assets.preview) });

  for (const [k, v] of Object.entries({
    ...deck.fallback.face,
    base: deck.fallback.back.base,
    accent: deck.fallback.back.accent,
  })) {
    if (!HEX_RE.test(v)) add('error', 'fallback.color', `Fallback colour "${k}" must be #rrggbb`);
  }

  // Alternate artwork: cosmetic only, never changes the 52-card composition.
  const variantIds = new Set<string>();
  for (const v of deck.variants) {
    const label = `variant ${v.id}: `;
    if (!ID_RE.test(v.id)) add('error', 'variant.id', `${label}id must be lowercase letters, digits and _`);
    if (variantIds.has(v.id)) add('error', 'variant.id', `${label}duplicate id`);
    variantIds.add(v.id);
    if (!v.name?.trim()) add('error', 'variant.name', `${label}name is required`);
    checkUnlock(v.unlock, (l, c, m) => add(l, `variant.${c}`, label + m));
    const vBase = v.assets.basePath ?? assets.basePath;
    const vMature = v.contentRating === 'mature' || deck.contentRating === 'mature';
    if (vMature && !vBase.startsWith(MATURE_ASSET_ROOT)) {
      add('error', 'mature.isolation', `${label}mature artwork must live under ${MATURE_ASSET_ROOT}`);
    }
    if (!vMature && vBase.startsWith(MATURE_ASSET_ROOT)) {
      add('error', 'mature.isolation', `${label}general artwork must not use the mature folder`);
    }
    for (const code of Object.keys(v.assets.overrides ?? {})) {
      if (!parseCardCode(code)) add('error', 'variant.override', `${label}"${code}" is not a card in a standard deck`);
    }
    const vRequired: RequiredFile[] = [];
    if (v.assets.faces) checkFaces(v.assets.faces, v.assets.back ?? assets.back, vBase, add, vRequired, label);
    else if (v.assets.back && !('atlasFrame' in v.assets.back)) {
      vRequired.push({ purpose: `${label}card back`, candidates: files(vBase, v.assets.back) });
    }
    if (v.assets.preview)
      vRequired.push({ purpose: `${label}preview image`, candidates: files(vBase, v.assets.preview) });
    for (const [code, ref] of Object.entries(v.assets.overrides ?? {})) {
      vRequired.push({ purpose: `${label}override ${code}`, candidates: files(vBase, ref!) });
    }
    // Variant files only become required once the variant itself is ready.
    if (v.assets.status === 'ready') required.push(...vRequired);
  }

  return {
    deckId: deck.id,
    status: assets.status,
    ok: !issues.some((i) => i.level === 'error'),
    issues,
    requiredFiles: required,
    missingFiles: [],
  };
}

/** Checks a TexturePacker/explicit-frame metadata file covers all 52 faces (and a back if needed). */
export function validateAtlasMeta(meta: unknown, needsBack: boolean): string[] {
  const frames = (meta as { frames?: Record<string, unknown> })?.frames;
  if (!frames || typeof frames !== 'object') return ['Atlas metadata has no "frames" object'];
  const keys = new Set(Object.keys(frames).map((k) => k.replace(/\.(png|webp|svg)$/i, '')));
  const problems = ALL_CARD_CODES.filter((c) => !keys.has(c)).map((c) => `Atlas metadata is missing frame ${c}`);
  if (needsBack && !keys.has('back')) problems.push('Atlas metadata is missing the "back" frame');
  return problems;
}

export interface FileCheckOptions {
  /** Treat missing files on pending decks as errors too. */
  strict?: boolean;
  /** Reads a JSON file (for atlas metadata checks). */
  readJson?: (path: string) => Promise<unknown> | unknown;
}

/**
 * Adds file-system checks to a report. Missing files are errors for decks
 * marked `ready` and warnings for decks whose artwork is still pending.
 */
export async function validateDeckFiles(
  deck: DeckDefinition,
  exists: (path: string) => boolean | Promise<boolean>,
  opts: FileCheckOptions = {},
  report: DeckReport = validateDeckDefinition(deck),
): Promise<DeckReport> {
  const missing: RequiredFile[] = [];
  for (const f of report.requiredFiles) {
    let found = false;
    for (const c of f.candidates) if (await exists(c)) found = true;
    if (!found) missing.push(f);
  }
  const level: IssueLevel = deck.assets.status === 'ready' || opts.strict ? 'error' : 'warning';
  if (missing.length) {
    const isFace = (m: RequiredFile) => /(^|: )face (A|[2-9]|10|J|Q|K)[SHDC]$/.test(m.purpose);
    const faces = missing.filter(isFace).length;
    const other = missing.filter((m) => !isFace(m)).map((m) => m.purpose);
    report.issues.push({
      level,
      code: 'files.missing',
      message: `Missing ${[faces ? `${faces} face image(s)` : '', ...other].filter(Boolean).join(', ')}`,
    });
  }
  const faces = deck.assets.faces;
  if (faces.type === 'atlas' && faces.metaPath && opts.readJson) {
    const path = `${deck.assets.basePath}${faces.metaPath}`;
    if (await exists(path)) {
      const meta = await opts.readJson(path);
      for (const p of validateAtlasMeta(meta, 'atlasFrame' in deck.assets.back)) {
        report.issues.push({ level: 'error', code: 'atlas.meta', message: p });
      }
    }
  }
  report.missingFiles = missing;
  report.ok = !report.issues.some((i) => i.level === 'error');
  return report;
}

/** Validates every deck in a registry, including duplicate ids. */
export function validateRegistry(decks: DeckDefinition[]): DeckReport[] {
  const ids = decks.map((d) => d.id);
  return decks.map((d) => validateDeckDefinition(d, ids));
}
