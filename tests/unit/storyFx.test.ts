import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { StoryManifest } from '@/story/art';
import { useStoryManifest } from '@/story/art';
import { ALL_TRACKS, RECORDED_TRACKS, SYNTH_TRACKS } from '@/audio/tracks';
import { STORY_SOUNDTRACK, storyTrackFor } from '@/audio/director';
import { STORY_CHAPTERS, getChapter } from '@/story/campaign';
import { CHARACTERS } from '@/story/cast';
import { MOOD_POSE } from '@/components/story/sprites';
import { VFX } from '@/components/story/vfx';
import { chapterPortraits, preloadPlan } from '@/components/story/preload';
import { applyStoryResult } from '@/story/progress';
import { createDefaultProfile } from '@/core/defaults';
import { flush, gameHaptic, gameSound, setGameHaptics } from '@/audio/gameSounds';
import type { Profile } from '@/core/types';

const manifest = JSON.parse(readFileSync('public/assets/story/manifest.json', 'utf8')) as StoryManifest;
const sprites = new Set(manifest.sheets.flatMap((s) => s.sprites.map((x) => x.id)));
const trackIds = new Set(ALL_TRACKS.map((t) => t.id));

describe('story audio director', () => {
  it('assigns only tracks that exist, for every chapter, scene and table', () => {
    for (const c of STORY_CHAPTERS) {
      const t = STORY_SOUNDTRACK.chapters[c.id];
      expect(t, c.id).toBeDefined();
      expect(trackIds.has(t!.scene), `${c.id} scene ${t!.scene}`).toBe(true);
      expect(trackIds.has(t!.play), `${c.id} play ${t!.play}`).toBe(true);
    }
    expect(trackIds.has(STORY_SOUNDTRACK.ending)).toBe(true);
    // No stray chapter ids.
    expect(Object.keys(STORY_SOUNDTRACK.chapters).sort()).toEqual(STORY_CHAPTERS.map((c) => c.id).sort());
  });

  it('uses all five owned recordings, and synthesized tracks where they fit', () => {
    const used = new Set([
      STORY_SOUNDTRACK.ending,
      ...Object.values(STORY_SOUNDTRACK.chapters).flatMap((c) => [c.scene, c.play]),
    ]);
    const recorded = RECORDED_TRACKS.map((t) => t.id).filter((id) => used.has(id) || id === 'parlor-menu');
    expect(recorded.sort()).toEqual(RECORDED_TRACKS.map((t) => t.id).sort());
    expect(SYNTH_TRACKS.some((t) => used.has(t.id))).toBe(true);
    // The demo chapters: downtown and a quiet table for Cheryl; the river for Sophia.
    expect(STORY_SOUNDTRACK.chapters['th-1']).toEqual({ scene: 'fxbg-saturday-walk', play: 'silent-study-hours' });
    expect(STORY_SOUNDTRACK.chapters['th-2']!.scene).toBe('river-dawn');
  });

  it('maps a moment of the story to its track (the map keeps the player’s own music)', () => {
    expect(storyTrackFor('map', null)).toBeNull();
    expect(storyTrackFor('chapter', 'th-1')).toBe('fxbg-saturday-walk');
    expect(storyTrackFor('play', 'th-1')).toBe('silent-study-hours');
    expect(storyTrackFor('play', 'th-2')).toBe('turtle-creek');
    expect(storyTrackFor('ending', 'th-3')).toBe('fxbg-after-dark');
    expect(storyTrackFor('chapter', 'nope')).toBeNull();
  });
});

describe('NPC expressions', () => {
  it('every mood is a pose that exists in every character’s expression sheet', () => {
    for (const c of CHARACTERS.filter((x) => x.portrait?.sheet))
      for (const [mood, pose] of Object.entries(MOOD_POSE))
        expect(sprites.has(`${c.portrait!.sheet}/${pose}`), `${c.id} ${mood} → ${pose}`).toBe(true);
  });

  it('every pose a scene asks for exists', () => {
    for (const c of STORY_CHAPTERS) for (const id of chapterPortraits(c)) expect(sprites.has(id), id).toBe(true);
  });
});

describe('story effects', () => {
  it('uses effects from the VFX atlas only', () => {
    for (const [kind, id] of Object.entries(VFX)) {
      expect(id.startsWith('thirteenth-hand-vfx/'), kind).toBe(true);
      expect(sprites.has(id), id).toBe(true);
    }
  });
});

describe('asset loading', () => {
  const winChapter = (p: Profile, id: string): Profile => {
    for (const l of getChapter(id)!.levels)
      p = {
        ...p,
        ...applyStoryResult(p, l.id, {
          gameId: l.game,
          outcome: 'win',
          durationMs: 1,
          details: l.game === 'go-fish' ? { books: 7 } : {},
        }).patch,
      };
    return p;
  };

  it('warms only the current chapter’s portraits and the next place’s tile', () => {
    useStoryManifest(manifest);
    const fresh = preloadPlan(createDefaultProfile());
    expect(fresh.length).toBeGreaterThan(0);
    for (const id of fresh)
      expect(id.startsWith('cheryl/') || id === 'thumb:location-ranger-station/location-ranger-station', id).toBe(true);
    const p = winChapter(createDefaultProfile(), 'th-1');
    const next = preloadPlan(p);
    for (const id of next)
      expect(id.startsWith('sophia/') || id === 'thumb:location-neon-art-shop/location-neon-art-shop', id).toBe(true);
    // Once the demo is finished there is nothing playable to warm.
    expect(preloadPlan(winChapter(p, 'th-2'))).toEqual([]);
  });
});

describe('haptics on the table', () => {
  it('a card landing well taps lightly; picking one up taps too', () => {
    const buzz = vi.fn();
    setGameHaptics(buzz);
    gameSound('valid_move');
    flush();
    expect(buzz).toHaveBeenCalledWith('tap');
    gameHaptic('tap');
    expect(buzz).toHaveBeenCalledTimes(2);
    setGameHaptics(() => undefined);
  });
});
