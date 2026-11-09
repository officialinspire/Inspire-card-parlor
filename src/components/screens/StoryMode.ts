import { releaseLive } from '../live';
import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { getGame } from '@/games/registry';
import { audio, gameSound } from '@/audio';
import { loadStoryArt } from '@/story/art';
import {
  CAMPAIGN_TITLE,
  EPILOGUE,
  EPILOGUE_TITLE,
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
import { takeStoryOutcome, takeStoryReturn } from '@/story/session';
import { GHOST_REMATCHES, rematchesUnlocked, type GhostRematch } from '@/story/rematches';
import { isPlayableChapter, levelAfter, objectiveNote, recapOf, type ReplayableScene } from '@/story/world';
import { getEvidence } from '@/story/evidence';
import type { InfoCard } from '@/story/campaign';
import { adventureContinues } from '../story/continues';
import { isPuzzleSolved, markPuzzleSolved, solveSuitPuzzle } from '../story/puzzle';
import { vfxBurst } from '../story/vfx';
import { preloadStory } from '../story/preload';
import { setStoryScene } from '@/audio/director';
import { haptic } from '@/utils/haptics';
import { infoCards } from '../story/notes';
import type { MapStop } from '@/story/world';
import { openDialog } from '../Dialog';
import { icon } from '../icons';
import { notify } from '../Notifications';
import { passportStamps } from '../passportStamps';
import { paginator } from '../Paginator';
import { button, iconButton, progressBar, screenFrame } from '../ui';
import { openMusicPlayer } from '../musicPlayer';
import { Disposer, type ScreenFactory } from '../Screen';
import { inspectClue, journalView } from '../story/journal';
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
  // Back from a challenge (however it was left): its chapter, that challenge in view.
  const back = takeStoryReturn();
  const backChapter = back && getChapter(back.chapterId);
  let view: View =
    backChapter && isChapterUnlocked(profile(), backChapter)
      ? { kind: 'chapter', id: backChapter.id }
      : { kind: 'map' };
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
  /** The music player, here too: a track the player picks wins over the story soundtrack. */
  const musicButton = () =>
    iconButton('music', 'Music', () => void openMusicPlayer(), {
      class: 'story-music-btn',
      attrs: { 'data-action': 'story-music' },
    });

  function mapView() {
    const el = screenFrame({
      title: 'Story Mode',
      subtitle: CAMPAIGN_TITLE,
      // The map's way out is always the main menu (history may hold a finished game).
      back: () => navigate(AppState.MAIN_MENU),
      actions: [musicButton(), journalButton()],
      body: h(
        'div',
        { class: 'stack story-stack' },
        passportStamps(store),
        rematchesUnlocked(profile()) ? finishedBanner() : continueStrip(),
        worldMapView(profile(), onStop),
      ),
    });
    el.dataset.storyView = 'map';
    return { el, destroy: () => undefined };
  }

  /**
   * The next challenge, on the map: where, what it asks and what it pays,
   * with Continue. (Replays of finished challenges are in their chapter;
   * rematches open once the story is finished.)
   */
  function continueStrip(): HTMLElement | null {
    const next = recapOf(profile()).next;
    if (next.kind !== 'challenge') return null;
    const { chapter: ch, level: lv } = next;
    const credits = lv.rewards.find((r) => r.kind === 'credits');
    const xp = lv.rewards.find((r) => r.kind === 'xp');
    const clues = lv.rewards.filter((r) => r.kind === 'evidence').length;
    const pays = [
      credits?.kind === 'credits' ? `${credits.amount} credits` : '',
      xp?.kind === 'xp' ? `${xp.amount} XP` : '',
      clues ? (clues === 1 ? 'a new clue' : `${clues} new clues`) : '',
    ].filter(Boolean);
    return h(
      'div',
      { class: 'story-next', 'data-story-next': lv.id },
      h(
        'p',
        { class: 'story-next-text' },
        h('small', null, `Next · Chapter ${ch.index} · ${ch.location}`),
        h('strong', null, `${lv.title}: ${lv.objectiveText}`),
        h(
          'span',
          { class: 'story-next-pays' },
          [objectiveNote(lv), pays.length ? `Earns ${pays.join(', ')}.` : ''].filter(Boolean).join(' '),
        ),
      ),
      button('Continue', () => void continueStory(ch, lv), {
        variant: 'gold',
        size: 'sm',
        icon: 'play',
        attrs: { 'data-action': 'continue-story' },
      }),
    );
  }

  /** Continue: open the chapter (its arrival first, if unseen), then the next challenge's brief. */
  async function continueStory(ch: StoryChapter, lv: StoryLevel): Promise<void> {
    if (!isLevelUnlocked(profile(), lv)) return;
    // (The Continue button has already made its one tap.)
    await openChapter(ch);
    await startLevel(ch, lv);
  }

  /** Once the story is finished: the epilogue to replay, and the ghosts' rematches. */
  function finishedBanner(): HTMLElement {
    return h(
      'div',
      { class: 'story-finished', 'data-story-finished': '' },
      h('p', { class: 'story-finished-text' }, icon('trophy'), 'The thirteenth hand is played.'),
      h(
        'div',
        { class: 'story-finished-actions' },
        button('Epilogue', () => void epilogue(), {
          variant: 'ghost',
          size: 'sm',
          icon: 'story',
          attrs: { 'data-action': 'epilogue' },
        }),
        button('Ghost rematches', () => void rematches(), {
          variant: 'gold',
          size: 'sm',
          icon: 'play',
          attrs: { 'data-action': 'rematches' },
        }),
      ),
    );
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
        ch.levels.findIndex((l) => l.id === (back?.chapterId === ch.id ? back.levelId : next?.id)),
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
          chapterNotes(ch).length
            ? button('Field notes', () => void fieldNotes(`${ch.location}: field notes`, chapterNotes(ch)), {
                variant: 'ghost',
                size: 'sm',
                icon: 'info',
                attrs: { 'data-action': 'field-notes' },
              })
            : null,
        ),
      ),
    );
    const el = screenFrame({
      title: `${ch.index}. ${ch.title}`,
      subtitle: ch.location,
      back: () => go({ kind: 'map' }),
      actions: [musicButton(), journalButton()],
      body: h('div', { class: 'stack story-stack' }, hero, pager.el),
    });
    el.dataset.chapterView = ch.id;
    el.dataset.storyView = 'chapter';
    return { el, destroy: pager.destroy };
  }

  function journalScreen(from: View) {
    const j = journalView(store, {
      onReplay: (scene) => void replay(scene),
      onContinue: (ch, lv) => void continueStory(ch, lv),
      onRematch: () => void rematches(),
    });
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

  let disposed = false;
  function render(): void {
    if (disposed) return;
    releaseLive(root);
    mounted?.destroy();
    mounted =
      view.kind === 'map'
        ? mapView()
        : view.kind === 'chapter'
          ? chapterView(getChapter(view.id)!)
          : journalScreen(view.from);
    root.replaceChildren(mounted.el);
    setPlace(view.kind === 'chapter' ? view.id : null);
    // The audio director follows the place: a chapter's music in it, the player's own on the map.
    const where = view.kind === 'journal' ? view.from : view;
    setStoryScene(where.kind === 'chapter' ? 'chapter' : 'map', where.kind === 'chapter' ? where.id : null);
  }

  /**
   * The place you are in: a chapter's look (palette, panels, texture) while
   * its screen or its scenes are open. It is set on <html> because scenes,
   * the versus card and results are dialogs outside the screen. The map and
   * the journal keep the parlor's own look.
   */
  function setPlace(chapterId: string | null): void {
    if (chapterId) document.documentElement.dataset.storyPlace = chapterId;
    else delete document.documentElement.dataset.storyPlace;
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
    if (stop.state === 'preview') return void continues(stop.chapter);
    void openChapter(stop.chapter);
  }

  /** The end of the playable demo: a preview of the next place, never a playable chapter. */
  async function continues(next: StoryChapter): Promise<void> {
    setStoryScene('ending', next.id);
    const choice = await adventureContinues(next);
    if (choice === 'menu') navigate(AppState.MAIN_MENU);
    else go({ kind: 'map' });
  }

  async function openChapter(ch: StoryChapter): Promise<void> {
    if (!isChapterUnlocked(profile(), ch)) return;
    if (!isPlayableChapter(ch)) return continues(ch);
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

  /** Every field note in a chapter: its own, then each challenge's. */
  const chapterNotes = (ch: StoryChapter): InfoCard[] => [
    ...(ch.info ?? []),
    ...ch.levels.flatMap((l) => l.info ?? []),
  ];

  function fieldNotes(title: string, cards: InfoCard[]): Promise<void> {
    return openDialog<void>({
      title,
      icon: 'info',
      class: 'dialog-notes',
      body: infoCards(cards),
      dismissValue: undefined,
      actions: [{ label: 'Close', value: undefined }],
    });
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
          objectiveNote(lv) ? h('p', { class: 'story-hint', 'data-objective-note': '' }, objectiveNote(lv)) : null,
          lv.info?.length
            ? h(
                'div',
                { class: 'story-notes' },
                ...lv.info.map((card) =>
                  button(`Field note: ${card.title}`, () => void fieldNotes(card.title, [card]), {
                    variant: 'ghost',
                    size: 'sm',
                    icon: 'info',
                    attrs: { 'data-field-note': card.id },
                  }),
                ),
              )
            : null,
          isLevelComplete(profile(), lv.id)
            ? h(
                'p',
                { class: 'story-hint', 'data-replay-note': '' },
                'Complete. Replay it any time, for fun: its rewards and clues are already yours.',
              )
            : rewardList(lv.rewards, 'Rewards', storyOf(profile()).evidence ?? []),
        ),
        actions: [
          { label: 'Not now', value: 'cancel', variant: 'ghost' },
          isLevelComplete(profile(), lv.id)
            ? { label: 'Replay', value: 'play', variant: 'gold', icon: 'restart' }
            : { label: 'Ready', value: 'play', variant: 'gold', icon: 'play' },
        ],
        dismissValue: 'cancel',
      });
      if (choice !== 'play') return;
    }
    // A puzzle (the Chapter 8 door) comes before the first win; once solved it stays solved.
    if (lv.puzzle && !isLevelComplete(profile(), lv.id) && !isPuzzleSolved(lv.id)) {
      const found = storyOf(profile()).evidence ?? [];
      const clues = (lv.puzzle.clues ?? []).flatMap((id) => {
        const e = found.includes(id) ? getEvidence(id) : undefined;
        return e ? [e] : [];
      });
      if (!(await solveSuitPuzzle(lv.puzzle, lv.title, clues, (c) => inspectClue(c, profile())))) return;
      markPuzzleSolved(lv.id);
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
      // No fanfare here: the table has just played its victory, and the closing
      // scene's discovery has its own cue. The results panel lists the rewards.
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
      // The last chapter: the epilogue, then the rematches it opens.
      if (ch === STORY_CHAPTERS.at(-1)) {
        go({ kind: 'map' });
        await epilogue();
        await rematches();
        return;
      }
      go({ kind: 'map' });
      // The newly revealed place on the map gets its moment.
      const opened = STORY_CHAPTERS[ch.index];
      if (opened)
        requestAnimationFrame(() => vfxBurst('unlock', root.querySelector(`[data-chapter="${opened.id}"]`), 1.3));
      // The demo ends here: the next chapter is still being written.
      const next = STORY_CHAPTERS[ch.index];
      if (next && !isPlayableChapter(next)) await continues(next);
      return;
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
    // The stamp's own cue; the toast stays silent so the two don't stack.
    gameSound('stamp');
    notify(ch.location, { kind: 'celebrate', title: 'Passport stamped', icon: 'trophy', duration: 4200, sound: false });
    haptic('celebrate');
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
          ? h(
              'p',
              { class: 'story-hint' },
              isPlayableChapter(next)
                ? `A new place is open on the map: ${next.location}.`
                : `A new place appears on the map: ${next.location}.`,
            )
          : h('p', { class: 'story-hint' }, 'The thirteenth hand is played. The mystery is solved.'),
      ),
      actions: [
        { label: 'Skip', value: 'skip', variant: 'ghost' },
        { label: next ? 'To the map' : 'The end', value: 'ok', variant: 'gold' },
      ],
      dismissValue: 'ok',
      onOpen: (panel) => {
        vfxBurst('stamp', panel.querySelector('.chapter-complete .stamp'), 2);
        const deckReward = panel.querySelector('.chapter-complete [data-reward="deck"]');
        if (deckReward) setTimeout(() => vfxBurst('deck', deckReward, 2.2), 450);
      },
    });
  }

  async function epilogue(): Promise<void> {
    setStoryScene('ending', STORY_CHAPTERS.at(-1)!.id);
    await playScene({
      title: EPILOGUE_TITLE,
      lines: EPILOGUE,
      actions: [
        { label: 'Skip', value: 'skip', variant: 'ghost' },
        { label: 'The end', value: 'ok', variant: 'gold' },
      ],
      dismissValue: 'ok',
      className: 'scene-epilogue',
    });
    setStoryScene('map');
  }

  /** The ghosts' rematches: free-play War tables, no story rewards. */
  async function rematches(): Promise<void> {
    const choice = await openDialog<string>({
      title: 'Ghost rematches',
      icon: 'trophy',
      class: 'dialog-rematches',
      body: h(
        'div',
        { class: 'rematches', 'data-rematches': '' },
        h(
          'p',
          { class: 'story-hint' },
          'Friendly War tables against the ghosts. Play as often as you like — the story is already won.',
        ),
        h(
          'ul',
          { class: 'rematch-list' },
          ...GHOST_REMATCHES.map((r) =>
            h(
              'li',
              { class: 'rematch', 'data-rematch': r.id },
              portrait(getCharacter(r.opponent)?.id ?? r.opponent, 'portrait-greet', 'rematch-portrait'),
              h('span', { class: 'rematch-text' }, h('strong', null, r.title), h('small', null, r.blurb)),
            ),
          ),
        ),
      ),
      dismissValue: '',
      actions: [
        { label: 'Later', value: '', variant: 'ghost' },
        ...GHOST_REMATCHES.map((r) => ({
          label: getCharacter(r.opponent)?.name.replace('’s Ghost', '') ?? r.title,
          value: r.id,
          variant: 'gold' as const,
          icon: 'play' as const,
        })),
      ],
    });
    const r = GHOST_REMATCHES.find((x) => x.id === choice);
    if (r) startRematch(r);
  }

  function startRematch(r: GhostRematch): void {
    store.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: null, chapterId: null });
    store.dispatch({ type: 'UPDATE_SETTINGS', patch: { warOpponent: r.opponent } });
    store.dispatch({ type: 'SELECT_GAME', gameId: 'war' });
    store.dispatch({ type: 'SELECT_BOARD', boardId: r.boardId });
    navigate(AppState.GAMEPLAY);
  }

  async function replay(scene: ReplayableScene): Promise<void> {
    setPlace(scene.chapter.id);
    await playScene({
      title: scene.title,
      lines: scene.lines,
      actions: [{ label: 'Close', value: 'ok' }],
      dismissValue: 'ok',
      className: 'scene-replay',
    });
    if (!disposed) setPlace(view.kind === 'chapter' ? view.id : null);
  }

  render();
  // Story art arrives after the first paint: redraw once it is in (it is optional).
  void loadStoryArt().then((m) => {
    if (!m || disposed) return;
    render();
    // Warm only what comes next: this chapter's portraits and the next place on the map.
    preloadStory(profile());
  });
  d.add(() => {
    disposed = true;
    setPlace(null);
    mounted?.destroy();
    releaseLive(root);
  });

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
