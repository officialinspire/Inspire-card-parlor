import type { CardCode } from '@/engine/Card';
import { ALL_CARD_CODES } from '@/engine/Card';
import type { DeckTheme } from '@/decks/DeckThemeManager';
import { MATURE_ASSET_ROOT, MATURE_BOARD_ROOT } from '@/decks/assets';
import type { AtlasFrame, ImageFormat, ImageRef } from '@/decks/types';
import { gridFrames, parseTexturePacker, type FrameMap } from './atlas';

export interface LoadedImage {
  url: string;
  width: number;
  height: number;
}

/** Everything the renderer needs to draw a deck theme with real artwork. */
export interface DeckArt {
  key: string;
  faces:
    | { kind: 'atlas'; sheet: LoadedImage; frames: FrameMap }
    | { kind: 'individual'; images: Partial<Record<CardCode, LoadedImage>> }
    | null;
  back: { image: LoadedImage; frame?: AtlasFrame } | null;
  overrides: Partial<Record<CardCode, LoadedImage>>;
  /** Codes with no artwork (rendered with the procedural fallback). */
  missing: CardCode[];
}

export class AssetBlockedError extends Error {}

export type ImageLoader = (url: string) => Promise<{ width: number; height: number }>;

export const browserImageLoader: ImageLoader = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      // Finish decode before publishing CSS atlas/board URLs to avoid a blank first paint.
      await img.decode?.().catch(() => undefined);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });

export interface AssetManagerOptions {
  baseUrl?: string;
  loadImage?: ImageLoader;
  fetchJson?: (url: string) => Promise<unknown>;
  /** Whether adult-themed assets may be requested at all. */
  matureAllowed?: () => boolean;
  supportsWebP?: () => boolean;
}

let webpSupport: boolean | null = null;
function detectWebP(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

/**
 * Loads card artwork: PNG/WebP sprite sheets (grid or explicit frames, incl.
 * TexturePacker JSON) and individual card images. Picks WebP when supported,
 * falls back to PNG per file, caches every request, and refuses to touch the
 * mature asset folder unless the player has opted in.
 */
export class AssetManager {
  #images = new Map<string, Promise<LoadedImage | null>>();
  #decks = new Map<string, DeckArt>();
  #pending = new Map<string, Promise<DeckArt>>();
  #listeners = new Set<(key: string) => void>();
  /** While set, face sheets wait for it (backs load at once); see `deferFacesUntil`. */
  #facesGate: Promise<unknown> | null = null;
  readonly opts: Required<AssetManagerOptions>;

  constructor(opts: AssetManagerOptions = {}) {
    this.opts = {
      baseUrl: opts.baseUrl ?? (import.meta.env?.BASE_URL || '/'),
      loadImage: opts.loadImage ?? browserImageLoader,
      fetchJson:
        opts.fetchJson ?? ((url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(url))))),
      matureAllowed: opts.matureAllowed ?? (() => false),
      supportsWebP: opts.supportsWebP ?? detectWebP,
    };
  }

  /** Candidate URLs for an image, best format first. */
  candidates(basePath: string, ref: ImageRef): string[] {
    const formats: ImageFormat[] = ref.formats ?? ['webp', 'png'];
    const ordered = this.opts.supportsWebP() ? formats : formats.filter((f) => f !== 'webp');
    return ordered.map((f) => this.url(basePath, `${ref.path}.${f}`));
  }

  url(basePath: string, file: string): string {
    if (
      (basePath.startsWith(MATURE_ASSET_ROOT) || basePath.startsWith(MATURE_BOARD_ROOT)) &&
      !this.opts.matureAllowed()
    ) {
      throw new AssetBlockedError(`Mature assets are disabled (${basePath})`);
    }
    return `${this.opts.baseUrl}${basePath}${file}`;
  }

  /** Loads the first candidate that exists. Resolves null if none load. */
  loadImage(basePath: string, ref: ImageRef): Promise<LoadedImage | null> {
    let urls: string[];
    try {
      urls = this.candidates(basePath, ref);
    } catch (err) {
      // Blocked adult-only artwork never loads; callers keep the drawn surface.
      if (err instanceof AssetBlockedError) return Promise.resolve(null);
      throw err;
    }
    const key = urls.join('|');
    let p = this.#images.get(key);
    if (!p) {
      p = (async () => {
        for (const url of urls) {
          try {
            const { width, height } = await this.opts.loadImage(url);
            return { url, width, height };
          } catch {
            /* try next format */
          }
        }
        return null;
      })();
      this.#images.set(key, p);
    }
    // A temporary offline miss must be retryable when the connection returns.
    void p.then((image) => {
      if (!image && this.#images.get(key) === p) this.#images.delete(key);
    });
    return p;
  }

  /**
   * Holds face sheets back until `gate` settles. During the opening only card
   * backs are on screen, and a deck's face sheet (~330 KB) would share a slow
   * connection with the title artwork; measured on a throttled phone it delayed
   * Touch to Start by about 1.5 s. Decks asked for meanwhile publish their back
   * first and their faces when the gate opens.
   */
  deferFacesUntil(gate: Promise<unknown>): void {
    const held = gate.catch(() => undefined);
    this.#facesGate = held;
    void held.then(() => {
      if (this.#facesGate === held) this.#facesGate = null;
    });
  }

  /** Synchronous lookup for the renderer; undefined until `loadDeck` has finished. */
  getDeckArt(key: string): DeckArt | undefined {
    return this.#decks.get(key);
  }

  onDeckLoaded(listener: (key: string) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Loads all artwork for a theme. Themes whose assets are still pending
   * resolve immediately with no art, so the renderer uses fallbacks
   * without requesting files that do not exist yet.
   */
  loadDeck(theme: DeckTheme): Promise<DeckArt> {
    // An opening back-only publication is not a completed deck.
    const pending = this.#pending.get(theme.key);
    if (pending) return pending;
    const cached = this.#decks.get(theme.key);
    if (cached) return Promise.resolve(cached);
    const loading = this.#load(theme).then((art) => {
      this.#decks.set(theme.key, art);
      this.#pending.delete(theme.key);
      for (const l of this.#listeners) l(theme.key);
      return art;
    });
    this.#pending.set(theme.key, loading);
    return loading;
  }

  async #load(theme: DeckTheme): Promise<DeckArt> {
    const art: DeckArt = { key: theme.key, faces: null, back: null, overrides: {}, missing: [...ALL_CARD_CODES] };
    if (theme.assets.status !== 'ready') return art;
    if (theme.mature && !this.opts.matureAllowed()) return art;

    const { basePath, faces, back } = theme.assets;
    try {
      // Opening: show the back now, the faces once the gate opens.
      if (this.#facesGate && !('atlasFrame' in back)) {
        const img = await this.loadImage(basePath, back);
        if (img) {
          this.#decks.set(theme.key, { ...art, back: { image: img } });
          for (const l of this.#listeners) l(theme.key);
        }
        await this.#facesGate;
      }
      if (faces.type === 'atlas') {
        const sheet = await this.loadImage(basePath, faces.image);
        if (sheet) {
          let frames: FrameMap = faces.frames ?? {};
          if (faces.metaPath) {
            const meta = await this.opts.fetchJson(this.url(basePath, faces.metaPath)).catch(() => null);
            if (meta) frames = { ...parseTexturePacker(meta).frames, ...frames };
          }
          if (faces.grid) frames = { ...gridFrames(faces.grid, sheet.width, sheet.height), ...frames };
          art.faces = { kind: 'atlas', sheet, frames };
        }
      } else {
        const images: Partial<Record<CardCode, LoadedImage>> = {};
        await Promise.all(
          ALL_CARD_CODES.map(async (code) => {
            const img = await this.loadImage(basePath, {
              path: faces.pattern.replace('{code}', code),
              formats: faces.formats ?? ['webp', 'png'],
            });
            if (img) images[code] = img;
          }),
        );
        art.faces = { kind: 'individual', images };
      }

      if ('atlasFrame' in back) {
        const frame = art.faces?.kind === 'atlas' ? art.faces.frames.back : undefined;
        if (frame && art.faces?.kind === 'atlas') art.back = { image: art.faces.sheet, frame };
      } else {
        const img = await this.loadImage(basePath, back);
        if (img) art.back = { image: img };
      }

      const overrideBase = theme.overrideBasePath ?? basePath;
      await Promise.all(
        Object.entries(theme.overrides).map(async ([code, ref]) => {
          const img = await this.loadImage(overrideBase, ref!);
          if (img) art.overrides[code as CardCode] = img;
        }),
      );
    } catch (err) {
      if (!(err instanceof AssetBlockedError)) console.warn(`[assets] ${theme.key}:`, err);
    }

    art.missing = ALL_CARD_CODES.filter((code) => {
      if (art.overrides[code]) return false;
      if (art.faces?.kind === 'atlas') return !art.faces.frames[code];
      if (art.faces?.kind === 'individual') return !art.faces.images[code];
      return true;
    });
    return art;
  }

  /** Loads a preview image (deck catalog art). Null when pending, missing or blocked. */
  async loadPreview(theme: DeckTheme): Promise<LoadedImage | null> {
    if (theme.assets.status !== 'ready') return null;
    try {
      return await this.loadImage(theme.assets.basePath, theme.assets.preview);
    } catch {
      return null;
    }
  }

  /** Forget cached art (e.g. after the mature-content setting is turned off). */
  clear(predicate: (key: string) => boolean = () => true): void {
    for (const key of [...this.#decks.keys()]) if (predicate(key)) this.#decks.delete(key);
  }
}
