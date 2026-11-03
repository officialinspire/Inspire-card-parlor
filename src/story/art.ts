import { h } from '@/utils/dom';

/**
 * Story artwork at runtime: characters, quest items, map pieces, UI, stamps,
 * effects and illustrations built by `npm run art:story` into
 * public/assets/story/ and described by its manifest.json.
 *
 * Sprites are separate WebP files with known sizes, shown with plain <img>
 * elements (reliable on every browser, desktop and mobile; lazily decoded).
 * When a sprite is missing or fails to load, a clearly labelled "artwork
 * missing" placeholder is shown instead: placeholder art is never presented
 * as the finished picture.
 */
export interface StoryFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StorySprite {
  /** "<sheet>/<name>", e.g. "cheryl/portrait-greet". */
  id: string;
  name: string;
  /** Rectangle in the original source sheet. */
  frame: StoryFrame;
  src: string;
  width: number;
  height: number;
  thumb: string;
  thumbWidth: number;
  thumbHeight: number;
  touchesEdge?: boolean;
  clipped?: Record<string, number>;
}

export interface StoryWarning {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export type StoryGroup =
  'characters' | 'items' | 'map' | 'stamps' | 'effects' | 'ui' | 'illustrations' | 'boards' | 'decks';

export interface StorySheet {
  id: string;
  title: string;
  group: StoryGroup;
  layout: { type: 'grid' | 'blobs' | 'single' | 'board' | 'audit'; [key: string]: unknown };
  source: {
    path: string;
    sha256: string;
    width?: number;
    height?: number;
    mode?: string;
    hasAlpha?: boolean;
    transparentShare?: number;
  };
  status: 'processed' | 'audit-only' | 'missing' | 'error';
  /** True only once the artist has confirmed names and use. */
  verified: boolean;
  notes?: string | null;
  sprites: StorySprite[];
  board?: {
    background: string;
    backgroundWidth: number;
    backgroundHeight: number;
    preview: string;
    previewWidth: number;
    previewHeight: number;
    registered: boolean;
  };
  warnings: StoryWarning[];
}

export interface StoryManifest {
  pipelineVersion: number;
  poseRows: { row: string; poses: string[] }[];
  sheets: StorySheet[];
}

const base = () => (typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : './');
export const storyUrl = (path: string) => `${base()}${path}`;

let manifest: StoryManifest | null = null;
let loading: Promise<StoryManifest | null> | null = null;
const index = new Map<string, StorySprite>();

function indexManifest(m: StoryManifest): void {
  manifest = m;
  index.clear();
  for (const sheet of m.sheets) for (const s of sheet.sprites) index.set(s.id, s);
}

/** Loads the manifest once. Resolves null (never throws) if it can't be fetched. */
export function loadStoryArt(): Promise<StoryManifest | null> {
  loading ??= fetch(storyUrl('assets/story/manifest.json'))
    .then((r) => (r.ok ? (r.json() as Promise<StoryManifest>) : null))
    .then((m) => {
      if (m) indexManifest(m);
      return m;
    })
    .catch(() => null);
  return loading;
}

/** For tests and tools that already hold the manifest. */
export const useStoryManifest = (m: StoryManifest) => indexManifest(m);

export const storySprite = (id: string): StorySprite | undefined => index.get(id);
export const storySheet = (id: string): StorySheet | undefined => manifest?.sheets.find((s) => s.id === id);

/** A character's pose, e.g. characterPose('cheryl', 'portrait-greet'). */
export const characterPose = (character: string, pose: string) => storySprite(`${character}/${pose}`);

/** A clearly labelled stand-in for artwork that is missing or failed to load. */
export function missingArt(label: string, size: { width: number; height: number } = { width: 96, height: 96 }) {
  return h(
    'span',
    {
      class: 'story-art-missing',
      role: 'img',
      'aria-label': `${label} (artwork missing)`,
      'data-missing-art': label,
      style: { aspectRatio: `${size.width} / ${size.height}` },
    },
    h('small', null, 'Artwork missing'),
  );
}

/**
 * An <img> for a sprite (or its thumbnail), sized by its real dimensions so the
 * layout never jumps. Unknown ids and load failures become `missingArt`.
 */
export function storyImage(id: string, opts: { thumb?: boolean; alt?: string; className?: string } = {}): HTMLElement {
  const s = storySprite(id);
  const alt = opts.alt ?? id;
  if (!s) return missingArt(alt);
  const w = opts.thumb ? s.thumbWidth : s.width;
  const hgt = opts.thumb ? s.thumbHeight : s.height;
  const img = h('img', {
    class: `story-art ${opts.className ?? ''}`.trim(),
    src: storyUrl(opts.thumb ? s.thumb : s.src),
    alt,
    width: w,
    height: hgt,
    loading: opts.className?.includes('portrait-art') ? 'eager' : 'lazy',
    decoding: 'async',
    draggable: false,
    'data-story-sprite': s.id,
  });
  img.addEventListener(
    'error',
    () => {
      const fallback = missingArt(alt, { width: w, height: hgt });
      if (opts.className) fallback.classList.add(...opts.className.split(/\s+/).filter(Boolean));
      img.replaceWith(fallback);
    },
    { once: true },
  );
  return img;
}
