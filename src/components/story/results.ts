import { h } from '@/utils/dom';
import { getDeck } from '@/decks/registry';
import { getBoard } from '@/boards/registry';
import { getChapter, getLevel, type StoryReward } from '@/story/campaign';
import { getEvidence } from '@/story/evidence';
import { describeReward, type StoryOutcome } from '@/story/progress';
import { levelAfter } from '@/story/world';
import { openDialog, type DialogAction } from '../Dialog';
import { icon, type IconName } from '../icons';
import { deco, MOOD_POSE, portrait, sprite, UI } from './sprites';
import { opponentsOf } from './versus';
import { CHARACTERS } from '@/story/chapters';

const names = { deck: (id: string) => getDeck(id).name, board: (id: string) => getBoard(id).name };

const REWARD_ICON: Record<StoryReward['kind'], IconName> = {
  credits: 'credits',
  xp: 'star',
  deck: 'cards',
  board: 'board',
  variant: 'cards',
  stamp: 'passport',
  achievement: 'trophy',
  evidence: 'hint',
};

/** A list of rewards; clues show their artwork. */
export function rewardList(rewards: readonly StoryReward[], label: string): HTMLElement | null {
  if (!rewards.length) return null;
  return h(
    'div',
    { class: 'story-rewards', 'data-rewards': '' },
    h('small', null, label),
    h(
      'ul',
      null,
      ...rewards.map((r) => {
        const clue = r.kind === 'evidence' ? getEvidence(r.id) : undefined;
        return h(
          'li',
          { 'data-reward': r.kind },
          (clue && sprite(clue.sprite, { thumb: true, className: 'reward-art', alt: '' })) ?? icon(REWARD_ICON[r.kind]),
          describeReward(r, names),
        );
      }),
    ),
  );
}

export type ResultChoice = 'continue' | 'retry' | 'map' | 'chapter';

/**
 * The end of a story challenge: an illustrated victory or defeat panel with
 * what was earned, and where to go next. Escape (or ×) returns to the
 * chapter, so the player is never stuck in it.
 */
export function storyResult(o: StoryOutcome): Promise<ResultChoice> {
  const level = getLevel(o.levelId)!;
  const chapter = getChapter(o.chapterId)!;
  const won = o.met;
  const next = levelAfter(level.id);
  const earned = [...o.levelRewards, ...o.chapterRewards];
  // The opponent (as a story character) reacts: crestfallen when beaten, pleased when they win.
  const firstOpponent = opponentsOf(level)[0];
  const opponent = firstOpponent ? CHARACTERS.find((c) => c.opponentId === firstOpponent)?.id : undefined;
  const actions: DialogAction<ResultChoice>[] = won
    ? [
        { label: 'Map', value: 'map', variant: 'ghost' },
        { label: 'Replay', value: 'retry', variant: 'ghost' },
        {
          label: o.chapterComplete || !next ? 'Continue Story' : 'Next challenge',
          value: 'continue',
          variant: 'gold',
          icon: 'play',
        },
      ]
    : [
        { label: 'Map', value: 'map', variant: 'ghost' },
        { label: 'Chapter', value: 'chapter', variant: 'ghost' },
        { label: 'Try again', value: 'retry', variant: 'gold', icon: 'play' },
      ];
  return openDialog<ResultChoice>({
    title: won ? (o.firstClear ? 'Challenge complete!' : 'Well played!') : 'Not this time',
    class: `dialog-story-result ${won ? 'result-win' : 'result-loss'}`,
    body: h(
      'div',
      { class: 'story-result', 'data-story-result': won ? 'complete' : 'retry' },
      h(
        'div',
        { class: 'result-art', 'aria-hidden': 'true' },
        deco(won ? UI.victory : UI.defeat, 'result-fx'),
        opponent
          ? portrait(
              opponent,
              MOOD_POSE[won ? (level.finale ? 'frustration' : 'defeat') : 'victory'],
              'result-portrait',
            )
          : deco(won ? UI.crest : UI.questAlert, 'result-emblem'),
      ),
      h(
        'div',
        { class: 'result-text' },
        h(
          'small',
          { class: 'tile-kicker' },
          `Chapter ${chapter.index} · ${level.finale ? 'Finale' : `Challenge ${level.number}`}`,
        ),
        h('p', { class: 'result-title' }, level.title),
        won
          ? (rewardList(earned, 'You earned') ??
              h('p', { class: 'story-hint' }, 'Rewards for this challenge were already collected.'))
          : h(
              'p',
              { class: 'story-hint' },
              `${level.objectiveText} ${level.setup.seed !== undefined ? 'This deal can be won — try it again.' : 'A fresh deal is waiting.'}`,
            ),
        won && o.chapterComplete
          ? h('p', { class: 'result-stamp' }, icon('passport'), `Chapter ${chapter.index} complete — passport stamped.`)
          : null,
      ),
    ),
    dismissValue: 'chapter',
    actions,
  });
}
