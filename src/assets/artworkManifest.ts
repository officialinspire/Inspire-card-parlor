import { allDecks } from '@/decks/registry';
import { allBoards } from '@/boards/registry';
import { validateDeckDefinition } from '@/decks/validation';
import type {
  ArtistCredit,
  ArtVariant,
  AssetStatus,
  BackAsset,
  DeckDefinition,
  FaceAssets,
  ImageRef,
} from '@/decks/types';
import type { BoardDefinition } from '@/boards/types';

/**
 * Optional public/assets/artwork.json, uploaded alongside commissioned art so it
 * can be wired in without code changes. Each entry patches an existing deck or
 * board; entries are validated first and rejected (with reasons) if invalid.
 * Artwork files themselves are only ever referenced, never modified.
 *
 * {
 *   "version": 1,
 *   "decks":  { "jak_gold": { "status": "ready", "artist": { "name": "…", "url": "…" },
 *                             "faces": { "type": "atlas", "image": { "path": "faces" }, "grid": { "columns": 13, "rows": 4 } },
 *                             "variants": [ … ] } },
 *   "boards": { "picnic_table": { "status": "ready", "artist": { "name": "…" } } }
 * }
 */
export interface DeckPatch {
  status?: AssetStatus;
  artist?: ArtistCredit;
  description?: string;
  faces?: FaceAssets;
  back?: BackAsset;
  preview?: ImageRef;
  variants?: ArtVariant[];
}

export interface BoardPatch {
  status?: AssetStatus;
  artist?: ArtistCredit;
  background?: ImageRef;
  preview?: ImageRef;
  ambientSprites?: { image: ImageRef; frames: number };
}

export interface ArtworkManifest {
  version: 1;
  decks?: Record<string, DeckPatch>;
  boards?: Record<string, BoardPatch>;
}

export interface ManifestResult {
  applied: string[];
  rejected: { id: string; reasons: string[] }[];
}

const IMAGE_PATH = /^[a-zA-Z0-9_\-/]+$/;
const FORMATS = new Set(['webp', 'png']);

function checkImage(ref: ImageRef | undefined, label: string, out: string[]): void {
  if (!ref) return;
  if (!IMAGE_PATH.test(ref.path) || ref.path.includes('..')) out.push(`${label}: invalid path "${ref.path}"`);
  if (ref.formats && !ref.formats.every((f) => FORMATS.has(f))) out.push(`${label}: formats must be webp/png`);
}

function checkBoard(b: BoardDefinition): string[] {
  const out: string[] = [];
  if (!b.assets.basePath.startsWith('assets/backgrounds/')) out.push('basePath must be under assets/backgrounds/');
  checkImage(b.assets.background, 'background', out);
  checkImage(b.assets.preview, 'preview', out);
  checkImage(b.assets.ambientSprites?.image, 'ambientSprites', out);
  if (b.assets.status === 'ready' && !b.artist?.name) out.push('a board marked ready needs an artist credit');
  return out;
}

/** Validates and applies a manifest to the registries in place. */
export function applyArtworkManifest(manifest: unknown): ManifestResult {
  const result: ManifestResult = { applied: [], rejected: [] };
  const m = manifest as ArtworkManifest;
  if (!m || typeof m !== 'object' || m.version !== 1) {
    result.rejected.push({ id: 'manifest', reasons: ['Unsupported or missing "version": 1'] });
    return result;
  }
  const decks = allDecks();
  const ids = decks.map((d) => d.id);
  for (const [id, patch] of Object.entries(m.decks ?? {})) {
    const deck = decks.find((d) => d.id === id);
    if (!deck) {
      result.rejected.push({ id, reasons: ['Unknown deck'] });
      continue;
    }
    const candidate: DeckDefinition = {
      ...deck,
      ...(patch.description ? { description: patch.description } : {}),
      artist: patch.artist ?? deck.artist,
      assets: {
        ...deck.assets,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.faces ? { faces: patch.faces } : {}),
        ...(patch.back ? { back: patch.back } : {}),
        ...(patch.preview ? { preview: patch.preview } : {}),
      },
      variants: [...deck.variants, ...(patch.variants ?? [])],
    };
    const report = validateDeckDefinition(candidate, ids);
    const errors = report.issues.filter((i) => i.level === 'error').map((i) => i.message);
    if (errors.length) result.rejected.push({ id, reasons: errors });
    else {
      Object.assign(deck, candidate);
      result.applied.push(id);
    }
  }
  for (const [id, patch] of Object.entries(m.boards ?? {})) {
    const board = allBoards().find((b) => b.id === id);
    if (!board) {
      result.rejected.push({ id, reasons: ['Unknown board'] });
      continue;
    }
    const candidate: BoardDefinition = {
      ...board,
      artist: patch.artist ?? board.artist,
      assets: {
        ...board.assets,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.background ? { background: patch.background } : {}),
        ...(patch.preview ? { preview: patch.preview } : {}),
        ...(patch.ambientSprites ? { ambientSprites: patch.ambientSprites } : {}),
      },
    };
    const errors = checkBoard(candidate);
    if (errors.length) result.rejected.push({ id, reasons: errors });
    else {
      Object.assign(board, candidate);
      result.applied.push(id);
    }
  }
  return result;
}

/** Fetches and applies public/assets/artwork.json if it exists. */
export async function loadArtworkManifest(baseUrl = import.meta.env?.BASE_URL || '/'): Promise<ManifestResult | null> {
  try {
    const res = await fetch(`${baseUrl}assets/artwork.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    const result = applyArtworkManifest(await res.json());
    for (const r of result.rejected) console.warn(`[artwork] ${r.id} not applied:`, r.reasons.join('; '));
    return result;
  } catch {
    return null;
  }
}
