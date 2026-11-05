import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/core/defaults';
import { Store } from '@/core/store';
import { purchaseCollectible } from '@/progression/shop';
import { isDeckUnlocked, isBoardUnlocked } from '@/progression/levels';
import { getChapter } from '@/story/campaign';
import { storyTrackFor } from '@/audio/director';

describe('collectible purchases and rewards', () => {
  it('charges the catalog price once, persists ownership in the profile, and rejects unaffordable purchases', () => {
    const s = new Store();
    s.dispatch({ type: 'BUY_COLLECTIBLE', kind: 'deck', id: 'dante_v2' });
    expect(s.state.profile.credits).toBe(250);
    expect(isDeckUnlocked('dante_v2', s.state.profile)).toBe(false);
    s.dispatch({ type: 'UPDATE_PROFILE', patch: { credits: 600 } });
    s.dispatch({ type: 'BUY_COLLECTIBLE', kind: 'deck', id: 'dante_v2' });
    expect(s.state.profile.credits).toBe(100);
    expect(isDeckUnlocked('dante_v2', s.state.profile)).toBe(true);
    const bought = s.state.profile;
    s.dispatch({ type: 'BUY_COLLECTIBLE', kind: 'deck', id: 'dante_v2' });
    expect(s.state.profile).toBe(bought);
    expect(purchaseCollectible(bought, 'deck', 'cannabis_nugs')).toBe(bought);
    expect(purchaseCollectible(bought, 'board', 'missing')).toBe(bought);
  });
  it('buys a board and retains default ownership', () => {
    const p = purchaseCollectible(createDefaultProfile(), 'board', 'germanna_library');
    expect(p.credits).toBe(0);
    expect(isBoardUnlocked('germanna_library', p)).toBe(true);
    expect(isBoardUnlocked('backroom_card_table', p)).toBe(true);
  });
  it('rewards actual chapter completion, including existing completed saves', () => {
    for (const [id, ch] of [
      ['cannabis_nugs', 'th-3'],
      ['yummyhole_standard', 'th-4'],
    ]) {
      const p = createDefaultProfile();
      const completed = getChapter(ch!)!.levels.map((l) => l.id);
      expect(isDeckUnlocked(id!, { ...p, level: 99 })).toBe(false);
      expect(isDeckUnlocked(id!, { ...p, story: { ...p.story, completed: completed.slice(1) } })).toBe(false);
      expect(isDeckUnlocked(id!, { ...p, story: { ...p.story, completed } })).toBe(true);
    }
    const p = createDefaultProfile();
    expect(isBoardUnlocked('kenmore_parlor', { ...p, level: 99 })).toBe(false);
    expect(
      isBoardUnlocked('kenmore_parlor', {
        ...p,
        story: { ...p.story, completed: getChapter('th-7')!.levels.map((l) => l.id) },
      }),
    ).toBe(true);
  });
  it('routes all five requested chapter themes', () => {
    for (const [ch, track] of [
      ['th-3', 'minimal-parlor-loop'],
      ['th-5', 'safehouse-pulse'],
      ['th-6', 'sanctum-pulse'],
      ['th-7', 'kenmore-manor-theme'],
      ['th-9', 'esoteric-order-loop'],
    ]) {
      expect(storyTrackFor('play', ch!)).toBe(track);
      expect(storyTrackFor('chapter', ch!)).toBe(track);
    }
  });
});
