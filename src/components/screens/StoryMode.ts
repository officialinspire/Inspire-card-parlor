import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { getDeck } from '@/decks/registry';
import { getBoard } from '@/boards/registry';
import { getGame } from '@/games/registry';
import { getPersonality, PERSONALITIES } from '@/games/cpu/personalities';
import { audio } from '@/audio';
import { cssUrl } from '@/boards/BoardRenderer';
import {
  CAMPAIGN_TITLE,
  STORY_CHAPTERS,
  getChapter,
  getLevel,
  type DialogueLine,
  type StoryChapter,
  type StoryLevel,
  type StoryReward,
} from '@/story/campaign';
import { getCharacter } from '@/story/chapters';
import {
  chapterProgress,
  describeReward,
  isChapterComplete,
  isChapterUnlocked,
  isLevelComplete,
  isLevelUnlocked,
  markIntroSeen,
  nextLevel,
  storyOf,
  type StoryOutcome,
} from '@/story/progress';
import { takeStoryOutcome } from '@/story/session';
import { avatar } from '../Avatar';
import { openDialog } from '../Dialog';
import { icon } from '../icons';
import { celebrate, notify } from '../Notifications';
import { passportStamps as passport } from '../passportStamps';
import { paginator } from '../Paginator';
import { badge, button, progressBar, screenFrame } from '../ui';
import { Disposer, type ScreenFactory } from '../Screen';

const asset = (path: string) => cssUrl(`${import.meta.env.BASE_URL}assets/${path}`);
const deckPreview = (deckId: string) => `${import.meta.env.BASE_URL}${getDeck(deckId).assets.basePath}preview.webp`;

const rewardNames = { deck: (id: string) => getDeck(id).name, board: (id: string) => getBoard(id).name };
const rewardText = (r: StoryReward) => describeReward(r, rewardNames);

/** A speaker's portrait: CPU opponents use their avatar, the regulars a monogram. */
function portrait(who: string): HTMLElement {
  if (PERSONALITIES.some((p) => p.id === who)) return avatar(getPersonality(who), 'story-portrait');
  const c = getCharacter(who);
  return h(
    'span',
    { class: 'story-portrait monogram', style: { '--who': c?.color ?? '#888' }, 'aria-hidden': 'true' },
    c?.name[0] ?? '?',
  );
}

/**
 * Compact dialogue: one line at a time with Next, or Skip to the end.
 * Resolves with the chosen action's value.
 */
async function dialogue<T extends string>(opts: {
  title: string;
  lines: DialogueLine[];
  extra?: Node | null;
  actions: { label: string; value: T; variant?: 'ghost' | 'primary' | 'gold'; icon?: 'play' | 'check' }[];
  dismissValue: T;
}): Promise<T> {
  let i = 0;
  const speaker = h('div', { class: 'story-line', 'aria-live': 'polite' });
  const next = button('Next', () => show(i + 1), {
    variant: 'ghost',
    size: 'sm',
    class: 'story-next',
    attrs: { 'data-dialogue': 'next' },
  });
  const show = (n: number) => {
    i = Math.min(n, opts.lines.length - 1);
    const line = opts.lines[i]!;
    const c = getCharacter(line.who);
    speaker.replaceChildren(
      portrait(line.who),
      h('div', { class: 'story-bubble' }, h('strong', null, c?.name ?? line.who), h('p', null, line.text)),
    );
    next.hidden = i >= opts.lines.length - 1;
  };
  show(0);
  return openDialog<T>({
    title: opts.title,
    class: 'dialog-story',
    body: h(
      'div',
      { class: 'story-dialogue', 'data-dialogue-lines': String(opts.lines.length) },
      speaker,
      h('div', { class: 'story-dialogue-nav' }, next),
      opts.extra ?? null,
    ),
    dismissValue: opts.dismissValue,
    actions: opts.actions,
  });
}

function rewardList(rewards: readonly StoryReward[], label: string): HTMLElement | null {
  if (!rewards.length) return null;
  return h(
    'div',
    { class: 'story-rewards', 'data-rewards': '' },
    h('small', null, label),
    h('ul', null, ...rewards.map((r) => h('li', { 'data-reward': r.kind }, rewardIcon(r), rewardText(r)))),
  );
}

function rewardIcon(r: StoryReward): Node {
  const map: Record<StoryReward['kind'], Parameters<typeof icon>[0]> = {
    credits: 'credits',
    xp: 'star',
    deck: 'cards',
    board: 'board',
    variant: 'cards',
    stamp: 'check',
    achievement: 'trophy',
  };
  return icon(map[r.kind]);
}

/** Five pips showing a chapter's progress. */
function pips(done: number, total: number): HTMLElement {
  return h(
    'span',
    { class: 'story-pips', role: 'img', 'aria-label': `${done} of ${total} challenges complete` },
    ...Array.from({ length: total }, (_, i) => h('i', { class: i < done ? 'on' : '' })),
  );
}

/** The chapter's illustration: its painting (if any) with the real deck art laid over it. */
function chapterArt(chapter: StoryChapter, large = false): HTMLElement {
  const art = chapter.artwork;
  return h(
    'span',
    {
      class: `story-art${large ? ' large' : ''}${art.placeholder ? ' placeholder' : ''}`,
      style: { '--tint': art.tint, ...(art.backdrop ? { '--backdrop': asset(art.backdrop) } : {}) },
      'aria-hidden': 'true',
    },
    h(
      'span',
      { class: 'story-art-decks' },
      ...art.decks
        .slice(0, 2)
        .map((d, i) =>
          h('img', { src: deckPreview(d), alt: '', loading: 'lazy', decoding: 'async', style: { '--i': String(i) } }),
        ),
    ),
    art.placeholder ? h('span', { class: 'story-art-label', 'data-placeholder': '' }, art.placeholder) : null,
  );
}

export const StoryModeScreen: ScreenFactory = ({ store }) => {
  const d = new Disposer();
  const profile = () => store.state.profile;
  let view: { el: HTMLElement; destroy(): void } | null = null;
  const root = h('div', { class: 'story-root' });

  // ----- Chapter list -----
  function chapterList(): { el: HTMLElement; destroy(): void } {
    const reached = STORY_CHAPTERS.findIndex((c) => !isChapterComplete(profile(), c));
    const pager = paginator({
      items: STORY_CHAPTERS,
      minTileWidth: 260,
      minTileHeight: 210,
      maxTileHeight: 320,
      label: 'Chapters',
      initialIndex: Math.max(0, reached),
      render: (ch) => {
        const unlocked = isChapterUnlocked(profile(), ch);
        const prog = chapterProgress(profile(), ch);
        const done = prog.done === prog.total;
        return h(
          'button',
          {
            type: 'button',
            class: `tile chapter-card${unlocked ? '' : ' locked'}${done ? ' done' : ''}`,
            'data-chapter': ch.id,
            'aria-label': `Chapter ${ch.index}: ${ch.title}${unlocked ? `, ${prog.done} of ${prog.total} complete` : ', locked'}`,
            onclick: () => {
              if (!unlocked)
                return void notify(`Finish Chapter ${ch.index - 1} to open ${ch.title}.`, {
                  kind: 'warning',
                  icon: 'lock',
                });
              audio.play('tap');
              void openChapter(ch);
            },
          },
          chapterArt(ch),
          h(
            'span',
            { class: 'chapter-card-body' },
            h('span', { class: 'tile-kicker' }, `Chapter ${ch.index} · ${ch.location}`),
            h('span', { class: 'tile-title' }, ch.title),
            unlocked
              ? h(
                  'span',
                  { class: 'chapter-card-meta' },
                  pips(prog.done, prog.total),
                  done ? badge('Stamped', 'badge-done') : null,
                )
              : h('span', { class: 'tile-lock' }, icon('lock'), `Finish Chapter ${ch.index - 1}`),
          ),
        );
      },
    });
    const el = screenFrame({
      title: 'Story Mode',
      subtitle: CAMPAIGN_TITLE,
      body: h('div', { class: 'stack story-stack' }, passport(store), pager.el),
    });
    return { el, destroy: pager.destroy };
  }

  // ----- One chapter: its challenges -----
  function chapterView(ch: StoryChapter): { el: HTMLElement; destroy(): void } {
    const prog = chapterProgress(profile(), ch);
    const next = nextLevel(profile(), ch);
    const pager = paginator({
      items: ch.levels,
      minTileWidth: 240,
      minTileHeight: 118,
      maxTileHeight: 168,
      label: 'Challenges',
      initialIndex: Math.max(
        0,
        ch.levels.findIndex((l) => l.id === next?.id),
      ),
      render: (lv) => levelTile(ch, lv),
    });
    const hero = h(
      'div',
      { class: 'chapter-hero' },
      chapterArt(ch, true),
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
            attrs: { 'data-action': 'chapter-intro' },
          }),
          rewardPeek(ch),
        ),
      ),
    );
    const el = screenFrame({
      title: `${ch.index}. ${ch.title}`,
      subtitle: ch.location,
      back: () => show(chapterList()),
      body: h('div', { class: 'stack story-stack' }, hero, pager.el),
    });
    el.dataset.chapterView = ch.id;
    return { el, destroy: pager.destroy };
  }

  function rewardPeek(ch: StoryChapter): HTMLElement {
    return button(
      'Chapter rewards',
      () =>
        void openDialog({
          title: `${ch.title}: rewards`,
          icon: 'trophy',
          body: rewardList(ch.rewards, 'For finishing all five challenges') ?? '',
          dismissValue: undefined,
          actions: [{ label: 'Close', value: undefined }],
        }),
      { variant: 'ghost', size: 'sm', attrs: { 'data-action': 'chapter-rewards' } },
    );
  }

  function levelTile(ch: StoryChapter, lv: StoryLevel): HTMLElement {
    const unlocked = isLevelUnlocked(profile(), lv);
    const done = isLevelComplete(profile(), lv.id);
    const game = getGame(lv.game);
    return h(
      'button',
      {
        type: 'button',
        class: `tile level-tile${unlocked ? '' : ' locked'}${done ? ' done' : ''}${lv.finale ? ' finale' : ''}`,
        'data-level': lv.id,
        'aria-label': `Challenge ${lv.number}: ${lv.title}. ${lv.objectiveText}${done ? ' Complete.' : unlocked ? '' : ' Locked.'}`,
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
        h('span', { class: 'tile-kicker' }, lv.finale ? 'Finale' : `Challenge ${lv.number}`),
        h('span', { class: 'tile-title' }, lv.title),
        h('span', { class: 'level-objective', 'data-objective': '' }, lv.objectiveText),
        h(
          'span',
          { class: 'tile-meta' },
          game ? badge(game.name) : null,
          lv.setup.seed !== undefined ? badge('Verified deal', 'badge-soft') : null,
          done
            ? badge('Done', 'badge-done')
            : !unlocked
              ? h('span', { class: 'tile-lock' }, icon('lock'), 'Locked')
              : null,
        ),
      ),
    );
  }

  // ----- Dialogue, launching, outcomes -----
  async function chapterIntro(ch: StoryChapter): Promise<void> {
    await dialogue({
      title: `Chapter ${ch.index}: ${ch.title}`,
      lines: ch.intro,
      actions: [
        { label: 'Skip', value: 'skip', variant: 'ghost' },
        { label: 'Let’s go', value: 'ok', icon: 'play' },
      ],
      dismissValue: 'ok',
    });
    store.dispatch({ type: 'UPDATE_PROFILE', patch: markIntroSeen(profile(), ch.id) });
  }

  async function openChapter(ch: StoryChapter): Promise<void> {
    show(chapterView(ch));
    if (!storyOf(profile()).introsSeen.includes(ch.id)) await chapterIntro(ch);
  }

  async function startLevel(ch: StoryChapter, lv: StoryLevel): Promise<void> {
    const game = getGame(lv.game);
    const choice = await dialogue<'play' | 'cancel'>({
      title: lv.title,
      lines: lv.intro,
      extra: h(
        'div',
        { class: 'story-brief' },
        h('p', { class: 'story-objective', 'data-objective': '' }, icon('check'), lv.objectiveText),
        h(
          'p',
          { class: 'story-setup' },
          `${game?.name ?? lv.game} · ${getDeck(lv.setup.deckId).name} · ${getBoard(lv.setup.boardId).name}`,
        ),
        isLevelComplete(profile(), lv.id)
          ? h('p', { class: 'ask-hint' }, 'Already complete — play again any time, just for fun.')
          : rewardList(lv.rewards, 'Rewards'),
      ),
      actions: [
        { label: 'Not now', value: 'cancel', variant: 'ghost' },
        { label: 'Play', value: 'play', variant: 'gold', icon: 'play' },
      ],
      dismissValue: 'cancel',
    });
    if (choice !== 'play') return;
    store.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: lv.id, chapterId: ch.id });
    navigate(AppState.GAMEPLAY);
  }

  async function showOutcome(o: StoryOutcome): Promise<void> {
    const ch = getChapter(o.chapterId)!;
    const lv = getLevel(o.levelId)!;
    show(chapterView(ch));
    if (!o.met) {
      const again = await openDialog<'retry' | 'later'>({
        title: 'Not this time',
        icon: 'info',
        class: 'dialog-story-result',
        body: h(
          'div',
          { class: 'story-result', 'data-story-result': 'retry' },
          h('p', null, `${lv.title}: ${lv.objectiveText}`),
          h(
            'p',
            { class: 'ask-hint' },
            lv.setup.seed !== undefined ? 'This deal can be won — try it again.' : 'A fresh deal is waiting.',
          ),
        ),
        dismissValue: 'later',
        actions: [
          { label: 'Later', value: 'later', variant: 'ghost' },
          { label: 'Try again', value: 'retry', icon: 'play' },
        ],
      });
      if (again === 'retry') {
        store.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: lv.id, chapterId: ch.id });
        navigate(AppState.GAMEPLAY);
      }
      return;
    }
    if (o.firstClear) {
      audio.play('levelup');
      notify(lv.title, { kind: 'celebrate', title: 'Challenge complete', icon: 'star', duration: 4200, sound: false });
    }
    await openDialog({
      title: o.firstClear ? 'Challenge complete!' : 'Well played!',
      icon: 'trophy',
      class: 'dialog-story-result',
      body: h(
        'div',
        { class: 'story-result', 'data-story-result': 'complete' },
        h('p', null, lv.title),
        rewardList(o.levelRewards, 'You earned') ??
          h('p', { class: 'ask-hint' }, 'Rewards for this challenge were already collected.'),
      ),
      dismissValue: undefined,
      actions: [{ label: o.chapterComplete ? 'Continue' : 'Back to the chapter', value: undefined }],
    });
    if (o.chapterComplete) await chapterComplete(ch, o);
    show(chapterView(ch));
  }

  async function chapterComplete(ch: StoryChapter, o: StoryOutcome): Promise<void> {
    celebrate('Passport stamped', ch.title, 'trophy');
    const stampIndex = STORY_CHAPTERS.indexOf(ch) + 1;
    const next = STORY_CHAPTERS[stampIndex];
    await dialogue({
      title: `Chapter ${ch.index} complete`,
      lines: ch.outro,
      extra: h(
        'div',
        { class: 'chapter-complete', 'data-chapter-complete': ch.id },
        h('span', { class: 'stamp big earned', 'aria-hidden': 'true' }, String(stampIndex)),
        rewardList(o.chapterRewards, 'Chapter rewards'),
        next
          ? h('p', { class: 'ask-hint' }, `Chapter ${next.index}, ${next.title}, is open.`)
          : h('p', { class: 'ask-hint' }, 'You have finished the Chronicles!'),
      ),
      actions: [
        { label: 'Skip', value: 'skip', variant: 'ghost' },
        { label: next ? 'Onward' : 'The end', value: 'ok', variant: 'gold' },
      ],
      dismissValue: 'ok',
    });
  }

  function show(v: { el: HTMLElement; destroy(): void }): void {
    view?.destroy();
    view = v;
    root.replaceChildren(v.el);
  }

  show(chapterList());
  d.add(() => view?.destroy());

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
