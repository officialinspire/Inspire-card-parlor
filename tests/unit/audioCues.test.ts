import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setSoundBackend, FANFARE_GAP, flush, gameSound, GAME_SOUND_SFX, type GameSound } from '@/audio/gameSounds';
import { audio } from '@/audio';
import { Store } from '@/core/store';
import { attachDialogs, openDialog } from '@/components/Dialog';
import { STORY_SOUNDTRACK, storyTrackFor } from '@/audio/director';
import { playableTracks } from '@/audio/tracks';
import { STORY_CHAPTERS } from '@/story/campaign';

/**
 * One action, one appropriate cue (upgrade series): story moments have their
 * own restrained sounds, fanfares never pile up, a dialog action can leave
 * the sound to what follows, and every chapter's music is an owned track.
 */
function listen() {
  let now = 10_000;
  const heard: string[] = [];
  const restore = __setSoundBackend(
    (sfx) => heard.push(sfx),
    () => now,
  );
  const say = (...events: GameSound[]) => {
    for (const e of events) gameSound(e);
    flush();
  };
  return { heard, say, wait: (ms: number) => (now += ms), restore };
}

describe('story cues', () => {
  it('each story moment has its own sound', () => {
    const own = ['evidence', 'stamp', 'suit_set', 'puzzle_solved', 'final_reveal'] as const;
    const sounds = own.map((e) => GAME_SOUND_SFX[e]);
    expect(sounds).toEqual(['discover', 'stamp', 'mark', 'unlock', 'reveal']);
    // Clues, stamps, marks and the reveal don't borrow a table sound.
    for (const s of ['discover', 'stamp', 'mark', 'reveal'])
      expect(Object.entries(GAME_SOUND_SFX).filter(([, v]) => v === s)).toHaveLength(1);
  });

  it('fanfares share one window: a stamp, an achievement and a level-up together are heard once', () => {
    const t = listen();
    t.say('stamp');
    t.wait(700);
    t.say('achievement');
    t.wait(700);
    t.say('level_up');
    expect(t.heard).toEqual(['stamp']);
    t.wait(FANFARE_GAP);
    t.say('celebrate');
    expect(t.heard).toEqual(['stamp', 'chime']);
    t.restore();
  });

  it('a clue found during a celebration is still heard: discoveries are not fanfares', () => {
    const t = listen();
    t.say('victory');
    t.wait(200);
    t.say('evidence');
    expect(t.heard).toEqual(['victory', 'discover']);
    t.restore();
  });

  it('the final reveal replaces the ordinary clue cue in the same moment', () => {
    const t = listen();
    t.say('evidence', 'final_reveal');
    expect(t.heard).toEqual(['reveal']);
    t.restore();
  });

  it('setting four marks quickly is four soft clicks; the door that opens is heard over them', () => {
    const t = listen();
    for (let i = 0; i < 4; i++) {
      t.say('suit_set');
      t.wait(150);
    }
    expect(t.heard).toEqual(['mark', 'mark', 'mark', 'mark']);
    t.say('suit_set', 'puzzle_solved');
    expect(t.heard.at(-1)).toBe('unlock');
    expect(t.heard.filter((s) => s === 'mark')).toHaveLength(4);
    t.restore();
  });
});

describe('dialog actions', () => {
  afterEach(() => document.body.replaceChildren());

  it('an action can leave its sound to what follows; others keep their tap or back', () => {
    const store = new Store();
    const layer = document.createElement('div');
    document.body.append(layer);
    attachDialogs(layer, store);
    const played = vi.spyOn(audio, 'play').mockImplementation(() => undefined);
    void openDialog<string>({
      title: 'Door',
      body: 'Set the marks',
      dismissValue: 'cancel',
      actions: [
        { label: 'Not now', value: 'cancel', variant: 'ghost' },
        { label: 'Set', value: 'set', variant: 'gold', sfx: null },
      ],
    });
    document.querySelector<HTMLButtonElement>('[data-dialog-action="set"]')!.click();
    expect(played).not.toHaveBeenCalled();
    // A fresh dialog layer (the first dialog's close waits on an animation happy-dom never runs).
    const layer2 = document.createElement('div');
    document.body.append(layer2);
    attachDialogs(layer2, new Store());
    void openDialog<string>({
      title: 'Door',
      body: 'Again',
      dismissValue: 'cancel',
      actions: [{ label: 'Not now', value: 'cancel', variant: 'ghost' }],
    });
    layer2.querySelector<HTMLButtonElement>('[data-dialog-action="cancel"]')!.click();
    expect(played).toHaveBeenCalledWith('back');
  });
});

describe('story music', () => {
  it('every chapter has a scene and a play track, all owned and playable', () => {
    const ids = new Set(playableTracks().map((t) => t.id));
    for (const c of STORY_CHAPTERS) {
      const s = STORY_SOUNDTRACK.chapters[c.id];
      expect(s, c.id).toBeTruthy();
      expect(ids.has(s!.scene), `${c.id} scene`).toBe(true);
      expect(ids.has(s!.play), `${c.id} play`).toBe(true);
      expect(storyTrackFor('chapter', c.id)).toBe(s!.scene);
      expect(storyTrackFor('play', c.id)).toBe(s!.play);
    }
    // The map keeps the player's own music.
    expect(storyTrackFor('map', null)).toBeNull();
  });
});
