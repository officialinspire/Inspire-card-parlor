import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { introPlan, introTimeline } from '@/core/intro';
import { Timeline } from '@/utils/timeline';
import { DEFAULT_SETTINGS } from '@/core/defaults';

describe('which opening plays', () => {
  const fresh = { seenBefore: false, playedThisSession: false };
  it('auto: the full intro on the first launch, the brief one afterwards and on a quick refresh', () => {
    expect(introPlan('auto', fresh)).toBe('full');
    expect(introPlan('auto', { seenBefore: true, playedThisSession: false })).toBe('brief');
    expect(introPlan('auto', { seenBefore: false, playedThisSession: true })).toBe('brief');
  });
  it('full and brief do what they say, every launch', () => {
    expect(introPlan('full', { seenBefore: true, playedThisSession: true })).toBe('full');
    expect(introPlan('brief', fresh)).toBe('brief');
  });
  it('defaults to auto', () => {
    expect(DEFAULT_SETTINGS.startupIntro).toBe('auto');
  });
});

describe('opening timeline', () => {
  it('orders the stages, keeps the full intro short, and the brief one starts at the title', () => {
    const full = introTimeline('full', false);
    expect(full.presents).toBeGreaterThan(0);
    expect(full.title).toBeGreaterThan(full.presents);
    expect(full.title).toBeLessThanOrEqual(3000);
    expect(introTimeline('brief', false).title).toBe(0);
  });
  it('reduced motion keeps the order but shortens every fade', () => {
    const calm = introTimeline('full', true);
    const full = introTimeline('full', false);
    expect(calm.title).toBeLessThan(full.title);
    expect(calm.leave).toBeLessThanOrEqual(150);
    expect(calm.reveal).toBeLessThanOrEqual(150);
  });
});

describe('Timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs steps in order at their times', () => {
    const seen: string[] = [];
    const t = new Timeline().at(200, () => seen.push('b')).at(100, () => seen.push('a'));
    t.start();
    vi.advanceTimersByTime(150);
    expect(seen).toEqual(['a']);
    vi.advanceTimersByTime(100);
    expect(seen).toEqual(['a', 'b']);
  });

  it('holds its clock while paused (a hidden tab) and carries on after', () => {
    const seen: string[] = [];
    const t = new Timeline().at(300, () => seen.push('title'));
    t.start();
    vi.advanceTimersByTime(200);
    t.pause();
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([]);
    t.start();
    vi.advanceTimersByTime(99);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(2);
    expect(seen).toEqual(['title']);
  });

  it('clear() cancels everything (screen teardown)', () => {
    const run = vi.fn();
    const t = new Timeline().at(100, run);
    t.start();
    t.clear();
    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
  });
});
