import type { Store } from '@/core/store';
import { AppState } from '@/core/states';
import { chapterOfLevel } from '@/story/campaign';
import { setMusicContext } from './index';

/**
 * The story audio director: which music fits where you are in Story Mode.
 *
 * Owned recordings come first (Inspire Card Parlor Menu Track, Downtown FXBG
 * Saturday Walk, Downtown Fredericksburg After Dark, Silent Study Hours,
 * Shadows of the Occult); the synthesized library fills the places they
 * don't fit (a river morning, a lamplit lodge). Every id is checked against
 * the track library by the tests.
 *
 * The director never touches the player's own choice: it sets a *context*
 * track that plays only while Story Mode is on screen, the "Story soundtrack"
 * setting is on, and the player hasn't picked a track themselves during this
 * visit. Pause, mute and volume always apply.
 */
export type StoryPhase = 'map' | 'chapter' | 'play' | 'ending';

export interface ChapterSoundtrack {
  /** Scenes, the chapter view and its dialogue. */
  scene: string;
  /** At the table, during the chapter's challenges. */
  play: string;
}

export const STORY_SOUNDTRACK: {
  /** The world map keeps whatever the player was listening to. */
  map: string | null;
  /** The demo ending: "The adventure continues…". */
  ending: string;
  chapters: Record<string, ChapterSoundtrack>;
} = {
  map: null,
  ending: 'fxbg-after-dark',
  chapters: {
    // Downtown Fredericksburg, then a quiet table among the clocks.
    'th-1': { scene: 'fxbg-saturday-walk', play: 'silent-study-hours' },
    // Morning on the river; a mossy, calm table.
    'th-2': { scene: 'river-dawn', play: 'turtle-creek' },
    'th-3': { scene: 'minimal-parlor-loop', play: 'minimal-parlor-loop' },
    'th-4': { scene: 'high-roller', play: 'velvet-room' },
    'th-5': { scene: 'safehouse-pulse', play: 'safehouse-pulse' },
    'th-6': { scene: 'sanctum-pulse', play: 'sanctum-pulse' },
    'th-7': { scene: 'kenmore-manor-theme', play: 'kenmore-manor-theme' },
    'th-8': { scene: 'shadows-of-the-occult', play: 'last-hand' },
    'th-9': { scene: 'esoteric-order-loop', play: 'esoteric-order-loop' },
  },
};

/** The track for a moment in the story, or null to keep the player's own music. */
export function storyTrackFor(phase: StoryPhase, chapterId: string | null): string | null {
  if (phase === 'ending') return STORY_SOUNDTRACK.ending;
  if (phase === 'map' || !chapterId) return STORY_SOUNDTRACK.map;
  const c = STORY_SOUNDTRACK.chapters[chapterId];
  if (!c) return null;
  return phase === 'play' ? c.play : c.scene;
}

let scene: { phase: StoryPhase; chapterId: string | null } | null = null;
let update: () => void = () => undefined;

/** Story Mode reports where the player is (map, a chapter, the ending). */
export function setStoryScene(phase: StoryPhase, chapterId: string | null = null): void {
  scene = { phase, chapterId };
  update();
}

/** Follows the screen and the story challenge being played. */
export function attachStoryDirector(store: Store): void {
  update = () => {
    const st = store.state;
    let track: string | null = null;
    const atStoryTable = st.screen === AppState.GAMEPLAY && !!st.selection.storyLevelId;
    const inStory = atStoryTable || st.screen === AppState.STORY_MODE;
    if (atStoryTable) track = storyTrackFor('play', chapterOfLevel(st.selection.storyLevelId!)?.id ?? null);
    else if (st.screen === AppState.STORY_MODE && scene) track = storyTrackFor(scene.phase, scene.chapterId);
    setMusicContext(track, inStory);
  };
  store.select((s) => `${s.screen}|${s.selection.storyLevelId ?? ''}`, update);
  update();
}
