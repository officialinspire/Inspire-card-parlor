import { RANKS, SUITS, cardCode, type CardCode } from '@/engine/Card';
import type { AtlasFrame, AtlasGrid } from '@/decks/types';

export type FrameMap = Partial<Record<CardCode | 'back', AtlasFrame>>;

/** Frames for a uniform grid sheet of the given pixel size. */
export function gridFrames(grid: AtlasGrid, width: number, height: number): FrameMap {
  const margin = grid.margin ?? 0;
  const spacing = grid.spacing ?? 0;
  const cellW = (width - 2 * margin - spacing * (grid.columns - 1)) / grid.columns;
  const cellH = (height - 2 * margin - spacing * (grid.rows - 1)) / grid.rows;
  const cell = (column: number, row: number): AtlasFrame => ({
    x: margin + column * (cellW + spacing),
    y: margin + row * (cellH + spacing),
    w: cellW,
    h: cellH,
  });
  const suits = grid.suitOrder ?? [...SUITS];
  const ranks = grid.rankOrder ?? [...RANKS];
  const frames: FrameMap = {};
  suits.forEach((suit, row) => {
    ranks.forEach((rank, column) => {
      if (column < grid.columns && row < grid.rows) frames[cardCode(rank, suit)] = cell(column, row);
    });
  });
  if (grid.backCell) frames.back = cell(grid.backCell.column, grid.backCell.row);
  return frames;
}

/** Reads TexturePacker "JSON (Hash)" output: { frames: { "AS.png": { frame: {x,y,w,h} } }, meta: { size } }. */
export function parseTexturePacker(json: unknown): { frames: FrameMap; size?: { width: number; height: number } } {
  const data = json as {
    frames?: Record<string, { frame?: AtlasFrame } | AtlasFrame>;
    meta?: { size?: { w: number; h: number } };
  };
  const frames: FrameMap = {};
  for (const [name, entry] of Object.entries(data.frames ?? {})) {
    const key = name.replace(/\.(png|webp|svg)$/i, '') as CardCode | 'back';
    const f = 'frame' in entry && entry.frame ? entry.frame : (entry as AtlasFrame);
    frames[key] = { x: f.x, y: f.y, w: f.w, h: f.h };
  }
  const s = data.meta?.size;
  return s ? { frames, size: { width: s.w, height: s.h } } : { frames };
}

/**
 * CSS that shows one frame of a sheet scaled to fill its element:
 * background-size scales the sheet so one frame = 100% of the box, and
 * background-position (in %) picks the frame regardless of element size.
 */
export function frameStyle(frame: AtlasFrame, sheet: { width: number; height: number }) {
  const pct = (offset: number, sheetLen: number, frameLen: number) =>
    sheetLen === frameLen ? 0 : (offset / (sheetLen - frameLen)) * 100;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    backgroundSize: `${round((sheet.width / frame.w) * 100)}% ${round((sheet.height / frame.h) * 100)}%`,
    backgroundPosition: `${round(pct(frame.x, sheet.width, frame.w))}% ${round(pct(frame.y, sheet.height, frame.h))}%`,
  };
}
