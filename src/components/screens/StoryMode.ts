import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { getGame } from '@/games/registry';
import { audio } from '@/audio';
import { loadStoryArt } from '@/story/art';
import {
  CAMPAIGN_TITLE,
  STAMPS,
  STORY_CHAPTERS,
  getChapter,
  getLevel,
  type StoryChapter,
  type StoryLevel,
} from '@/story/campaign';
import { getCharacter } from '@/story/chapters';
import {
  chapterProgress,
  isChapterUnlocked,
  isLevelComplete,
  isLevelUnlocked,
  markIntroSeen,
  nextLevel,
  storyOf,
  type StoryOutcome,
} from '@/story/progress';
import { takeStoryOutcome } from '@/story/session';
import { levelAfter, type ReplayableScene } from '@/story/world';
import type { MapStop } from '@/story/world';
import { openDialog } from '../Dialog';
import { icon } from '../icons';
import { celebrate, notify } from '../Notifications';
import { passportStamps } from '../passportStamps';
import { paginator } from '../Paginator';
import { button, progressBar, screenFrame } from '../ui';
import { Disposer, type ScreenFactory } from '../Screen';
import { journalView } from '../story/journal';
import { worldMapView } from '../story/map';
import { rewardList, storyResult } from '../story/results';
import { playScene } from '../story/scene';
import { portrait, sprite } from '../story/sprites';
import { opponentsOf, versus } from '../story/versus';

/**
 * Story Mode: THE THIRTEENTH HAND.
 *
 * One screen with three views — the world map, a chapter's challenges and
 * the quest journal — and its own back: journal → chapter → map → menu
 * (the header's Back, Escape and Backspace all step back one view). Scenes,
 * the versus card and results are dialogs over these views, so leaving one
 * never loses progress: everything is saved as it happens.
 *
 * Nothing here names a character or place: it all comes from the campaign data.
 */
type View = { kind: 'map' } | { kind: 'chapter'; id: string } | { kind: 'journal'; from: View };

export const StoryModeScreen: ScreenFactory = ({ store }) => {
  const d = new Disposer();
  const profile = () => store.state.profile;
  const root = h('div', { class: 'story-root' });
  let view: View = { kind: 'map' };
  let mounted: { el: HTMLElement; destroy(): void } | null = null;

  // ----- Views -----
  const journalButton = () =>
    button('Journal', () => go({ kind: 'journal', from: view }), {
      variant: 'ghost',
      size: 'sm',
      icon: 'binder',
      class: 'story-journal-btn',
      attrs: { 'data-action': 'journal' },
    });

  function mapView() {
    const el = screenFrame({
      title: 'Story Mode',
      subtitle: CAMPAIGN_TITLE,
      actions: [journalButton()],
      body: h('div', { class: 'stack story-stack' }, passportStamps(store), worldMapView(profile(), onStop)),
    });
    el.dataset.storyView = 'map';
    return { el, destroy: () => undefined };
  }

  function chapterView(ch: StoryChapter) {
    const prog = chapterProgress(profile(), ch);
    const next = nextLevel(profile(), ch);
    const pager = paginator({
      items: ch.levels,
      minTileWidth: 250,
      minTileHeight: 132,
      maxTileHeight: 190,
      gap: 10,
      label: 'Challenges',
      initialIndex: Math.max(
        0,
        ch.levels.findIndex((l) => l.id === next?.id),
      ),
      render: (lv) => challengeCard(ch, lv),
    });
    const hero = h(
      'div',
      { class: 'chapter-hero' },
      h(
        'span',
        { class: 'chapter-hero-art', style: { '--tint': ch.artwork.tint }, 'aria-hidden': 'true' },
        sprite(ch.artwork.locationSprite, { thumb: true, alt: '' }),
        ch.artwork.placeholder
          ? h('span', { class: 'story-art-label', 'data-placeholder': '' }, ch.artwork.placeholder)
          : null,
      ),
      h(
        'div',
        { class: 'chapter-hero-text' },
        h('p', null, ch.description),
        h(
          'div',
          { class: 'chapter-progress', 'data-chapter-progress': `${prog.done}/${prog.total}` },
          progressBar(prog.done / prog.total, 'Chapter progress'),
          h('span', null, `${prog.done} / ${prog.total}`),
        ),
        h(
          'div',
          { class: 'chapter-hero-actions' },
          button('Story so far', () => void chapterIntro(ch), {
            variant: 'ghost',
            size: 'sm',
            icon: 'story',
            attrs: { 'data-action': 'chapter-intro' },
          }),
          button('Rewards', () => void chapterRewards(ch), {
            variant: 'ghost',
            size: 'sm',
            icon: 'trophy',
            attrs: { 'data-action': 'chapter-rewards' },
          }),
        ),
      ),
    );
    const el = screenFrame({
      title: `${ch.index}. ${ch.title}`,
      subtitle: ch.location,
      back: () => go({ kind: 'map' }),
      actions: [journalButton()],
      body: h('div', { class: 'stack story-stack' }, hero, pager.el),
    });
    el.dataset.chapterView = ch.id;
    el.dataset.storyView = 'chapter';
    return { el, destroy: pager.destroy };
  }

  function journalScreen(from: View) {
    const j = journalView(store, (scene) => void replay(scene));
    const el = screenFrame({ title: 'Journal', subtitle: CAMPAIGN_TITLE, back: () => go(from), body: j.el });
    el.dataset.storyView = 'journal';
    return { el, destroy: j.destroy };
  }

  /** A challenge card: game, objective, opponents, rewards and its state. */
  function challengeCard(ch: StoryChapter, lv: StoryLevel): HTMLElement {
    const unlocked = isLevelUnlocked(profile(), lv);
    const done = isLevelComplete(profile(), lv.id);
    const game = getGame(lv.game);
    const opponents = opponentsOf(lv);
    const credits = lv.rewards.find((r) => r.kind === 'credits');
    const xp = lv.rewards.find((r) => r.kind === 'xp');
    const clues = lv.rewards.filter((r) => r.kind === 'evidence').length;
    const state = done ? 'Replay' : unlocked ? 'Start' : 'Locked';
    return h(
      'button',
      {
        type: 'button',
        class: `tile level-tile challenge-card${unlocked ? '' : ' locked'}${done ? ' done' : ''}${lv.finale ? ' finale' : ''}`,
        'data-level': lv.id,
        'aria-label': `Challenge ${lv.number}: ${lv.title}. ${game?.name ?? lv.game}. ${lv.objectiveText}${
          opponents.length ? ` Against ${opponents.map((o) => getCharacter(o)?.name ?? o).join(', ')}.` : ''
        } ${done ? 'Complete — replay.' : unlocked ? 'Start.' : 'Locked.'}`,
        onclick: () => {
          if (!unlocked)
            return void notify('Finish the challenge before this one first.', { kind: 'warning', icon: 'lock' });
          audio.play('tap');
          void startLevel(ch, lv);
        },
      },
      h('span', { class: 'level-num' }, done ? icon('check') : String(lv.number)),
      h(
        'span',
        { class: 'tile-body' },
        h(
          'span',
          { class: 'tile-kicker' },
          `${lv.finale ? 'Finale' : `Challenge ${lv.number}`} · ${game?.name ?? lv.game}`,
        ),
        h('span', { class: 'tile-title' }, lv.title),
        h('span', { class: 'level-objective', 'data-objective': '' }, lv.objectiveText),
        h(
          'span',
          { class: 'challenge-meta' },
          opponents.length
            ? h(
                'span',
                { class: 'challenge-opponents', 'aria-hidden': 'true' },
                ...opponents.map((o) => portrait(o, undefined, 'mini-portrait')),
              )
            : null,
          h(
            'span',
            { class: 'challenge-rewards', 'aria-hidden': 'true' },
            credits?.kind === 'credits' ? h('span', null, icon('credits'), String(credits.amount)) : null,
            xp?.kind === 'xp' ? h('span', null, icon('star'), String(xp.amount)) : null,
            clues ? h('span', { 'data-clues': String(clues) }, icon('hint'), String(clues)) : null,
          ),
          h(
            'span',
            { class: `challenge-state ${state.toLowerCase()}`, 'data-challenge-state': state.toLowerCase() },
            state,
          ),
        ),
      ),
    );
  }

  function render(): void {
    mounted?.destroy();
    mounted =
      view.kind === 'map'
        ? mapView()
        : view.kind === 'chapter'
          ? chapterView(getChapter(view.id)!)
          : journalScreen(view.from);
    root.replaceChildren(mounted.el);
  }

  function go(v: View): void {
    view = v;
    render();
  }

  // ----- Actions -----
  function onStop(stop: MapStop): void {
    if (stop.state === 'undiscovered')
      return void notify('Keep following the clues to find this place.', { kind: 'info', icon: 'hint' });
    if (stop.state === 'locked')
      return void notify(`Finish Chapter ${stop.chapter.index - 1} to open ${stop.chapter.location}.`, {
        kind: 'warning',
        icon: 'lock',
      });
    audio.play('tap');
    void openChapter(stop.chapter);
  }

  async function openChapter(ch: StoryChapter): Promise<void> {
    if (!isChapterUnlocked(profile(), ch)) return;
    go({ kind: 'chapter', id: ch.id });
    if (!storyOf(profile()).introsSeen.includes(ch.id)) await chapterIntro(ch);
  }

  async function chapterIntro(ch: StoryChapter): Promise<void> {
    await playScene({
      title: `Chapter ${ch.index}: ${ch.title}`,
      lines: ch.intro,
      actions: [
        { label: 'Skip', value: 'skip', variant: 'ghost' },
        { label: 'Let’s go', value: 'ok', icon: 'play' },
      ],
      dismissValue: 'ok',
    });
    // Seen (even when skipped): it is offered again from the chapter and the journal.
    const patch = markIntroSeen(profile(), ch.id);
    if (Object.keys(patch).length) store.dispatch({ type: 'UPDATE_PROFILE', patch });
  }

  function chapterRewards(ch: StoryChapter): Promise<void> {
    return openDialog<void>({
      title: `${ch.title}: rewards`,
      icon: 'trophy',
      body: rewardList(ch.rewards, 'For finishing all five challenges') ?? '',
      dismissValue: undefined,
      actions: [{ label: 'Close', value: undefined }],
    });
  }

  /** Intro scene → versus card → the table. Backing out at any step returns to the chapter. */
  async function startLevel(ch: StoryChapter, lv: StoryLevel, skipIntro = false): Promise<void> {
    if (!skipIntro) {
      const choice = await playScene<'play' | 'cancel'>({
        title: lv.title,
        lines: lv.intro,
        extra: h(
          'div',
          { class: 'story-brief' },
          h('p', { class: 'story-objective', 'data-objective': '' }, icon('check'), lv.objectiveText),
          isLevelComplete(profile(), lv.id)
            ? h('p', { class: 'story-hint' }, 'Already complete — play again any time, just for fun.')
            : rewardList(lv.rewards, 'Rewards'),
        ),
        actions: [
          { label: 'Not now', value: 'cancel', variant: 'ghost' },
          { label: 'Ready', value: 'play', variant: 'gold', icon: 'play' },
        ],
        dismissValue: 'cancel',
      });
      if (choice !== 'play') return;
    }
    if ((await versus(lv)) !== 'play') return;
    store.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: lv.id, chapterId: ch.id });
    navigate(AppState.GAMEPLAY);
  }

  /** Back from a challenge: its closing scene, then the results, then wherever the player chooses. */
  async function showOutcome(o: StoryOutcome): Promise<void> {
    const ch = getChapter(o.chapterId)!;
    const lv = getLevel(o.levelId)!;
    go({ kind: 'chapter', id: ch.id });
    if (o.met && o.firstClear) {
      audio.play('levelup');
      if (lv.outro.length)
        await playScene({
          title: lv.title,
          lines: lv.outro,
          actions: [
            { label: 'Skip', value: 'skip', variant: 'ghost' },
            { label: 'Continue', value: 'ok' },
          ],
          dismissValue: 'ok',
          className: 'scene-outro',
        });
    }
    const choice = await storyResult(o);
    if (o.met && o.chapterComplete && choice !== 'retry') {
      await chapterComplete(ch, o);
      return go({ kind: 'map' });
    }
    switch (choice) {
      case 'retry':
        return startLevel(ch, lv, true);
      case 'map':
        return go({ kind: 'map' });
      case 'continue': {
        const next = levelAfter(lv.id);
        if (next && isLevelUnlocked(profile(), next)) return startLevel(ch, next);
        return go({ kind: 'chapter', id: ch.id });
      }
      default:
        return go({ kind: 'chapter', id: ch.id });
    }
  }

  async function chapterComplete(ch: StoryChapter, o: StoryOutcome): Promise<void> {
    celebrate('Passport stamped', ch.location, 'trophy');
    const next = STORY_CHAPTERS[ch.index];
    const stamp = o.chapterRewards.find((r) => r.kind === 'stamp');
    await playScene({
      title: `Chapter ${ch.index} complete`,
      lines: ch.outro,
      extra: h(
        'div',
        { class: 'chapter-complete', 'data-chapter-complete': ch.id },
        h(
          'span',
          { class: 'stamp big earned', 'aria-hidden': 'true' },
          (stamp && sprite(STAMPS.find((x) => x.id === stamp.id)?.sprite, { thumb: true, alt: '' })) ??
            String(ch.index),
        ),
        rewardList(o.chapterRewards, 'Chapter rewards'),
        next
          ? h('p', { class: 'story-hint' }, `A new place is open on the map: ${next.location}.`)
          : h('p', { class: 'story-hint' }, 'The thirteenth hand is played. The mystery is solved.'),
      ),
      actions: [
        { label: 'Skip', value: 'skip', variant: 'ghost' },
        { label: next ? 'To the map' : 'The end', value: 'ok', variant: 'gold' },
      ],
      dismissValue: 'ok',
    });
  }

  async function replay(scene: ReplayableScene): Promise<void> {
    await playScene({
      title: scene.title,
      lines: scene.lines,
      actions: [{ label: 'Close', value: 'ok' }],
      dismissValue: 'ok',
      className: 'scene-replay',
    });
  }

  render();
  // Story art arrives after the first paint: redraw once it is in (it is optional).
  void loadStoryArt().then((m) => {
    if (m && root.isConnected !== false) render();
  });
  d.add(() => mounted?.destroy());

  return {
    el: root,
    mount() {
      // Back from a challenge: show how it went.
      const outcome = takeStoryOutcome();
      if (outcome) void showOutcome(outcome);
    },
    unmount: () => d.dispose(),
  };
};
