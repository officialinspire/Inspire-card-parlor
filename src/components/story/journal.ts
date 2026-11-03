import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import {
  journalOf,
  objectiveNote,
  recapOf,
  relatedFound,
  replayableScenes,
  type JournalChapter,
  type JournalClue,
  type ReplayableScene,
} from '@/story/world';
import type { Profile } from '@/core/types';
import type { Evidence } from '@/story/types';
import type { StoryChapter, StoryLevel } from '@/story/campaign';
import { getLocation } from '@/story/locations';
import { getChapter } from '@/story/campaign';
import { storyOf } from '@/story/progress';
import { openDialog } from '../Dialog';
import { icon } from '../icons';
import { paginatorPanel } from '../Paginator';
import { tabs } from '../Tabs';
import { badge, button } from '../ui';
import { deco, sprite } from './sprites';

/**
 * The quest journal: an antique notebook of clues, chapter summaries and
 * replayable scenes. All text is real HTML — the artwork is only the frame.
 * Clues come from the save (`story.evidence`), so they persist with it.
 */
export interface JournalActions {
  onReplay: (scene: ReplayableScene) => void;
  /** Continue the story: the next challenge to play. */
  onContinue?: (chapter: StoryChapter, level: StoryLevel) => void;
  /** Once the story is finished: the ghost rematches. */
  onRematch?: () => void;
}

export function journalView(store: Store, actions: JournalActions | ((scene: ReplayableScene) => void)) {
  const { onReplay, onContinue, onRematch } = typeof actions === 'function' ? { onReplay: actions } : actions;
  const profile = store.state.profile;
  const j = journalOf(profile);
  const recap = recapOf(profile);

  // "Where you left off": the last clue, the question still open, and what to do next. Three short lines.
  const next = recap.next;
  const objective = h(
    'div',
    { class: 'journal-objective journal-recap', 'data-journal-objective': '', 'data-recap': '' },
    deco('map-icons/quest-scroll-alert', 'journal-objective-icon'),
    h(
      'div',
      { class: 'recap-lines' },
      h('small', { class: 'recap-head' }, 'Where you left off'),
      recap.lastClue
        ? h(
            'p',
            { class: 'recap-line', 'data-recap-clue': recap.lastClue.id },
            h('span', { class: 'recap-label' }, 'Last clue'),
            h(
              'button',
              {
                type: 'button',
                class: 'recap-link',
                onclick: () => void inspectClue(recap.lastClue!, profile),
              },
              recap.lastClue.name,
            ),
          )
        : null,
      recap.question
        ? h(
            'p',
            { class: 'recap-line', 'data-recap-question': '' },
            h('span', { class: 'recap-label' }, 'Open question'),
            h('span', null, recap.question.text),
          )
        : null,
      h(
        'p',
        { class: 'recap-line recap-next', 'data-recap-next': next.kind },
        h('span', { class: 'recap-label' }, 'Next'),
        h(
          'strong',
          null,
          next.kind === 'challenge'
            ? `Chapter ${next.chapter.index} · ${next.level.title}: ${next.level.objectiveText}${objectiveNote(next.level) ? ` ${objectiveNote(next.level)}` : ''}`
            : next.kind === 'preview'
              ? `The adventure continues: Chapter ${next.chapter.index}, ${next.chapter.location}, is still being written.`
              : 'The thirteenth hand is finished.',
        ),
      ),
    ),
    next.kind === 'challenge' && onContinue
      ? button('Continue', () => onContinue(next.chapter, next.level), {
          variant: 'gold',
          size: 'sm',
          icon: 'play',
          attrs: { 'data-action': 'continue-story' },
        })
      : next.kind === 'finished' && onRematch
        ? button('Rematch', () => onRematch(), {
            variant: 'ghost',
            size: 'sm',
            icon: 'play',
            attrs: { 'data-action': 'rematch' },
          })
        : null,
  );

  const clueTile = (c: JournalClue) =>
    h(
      'button',
      {
        type: 'button',
        class: `tile clue-tile ${c.importance}`,
        'data-clue': c.id,
        'aria-label': `${c.name}. ${c.importance === 'key' ? 'Key clue' : 'Optional clue'}, chapter ${c.chapterIndex}. Inspect.`,
        onclick: () => void inspectClue(c, store.state.profile),
      },
      h(
        'span',
        { class: 'clue-art' },
        sprite(c.sprite, { thumb: true, alt: '' }) ?? h('span', { class: 'clue-blank' }, icon('hint')),
      ),
      h('span', { class: 'tile-title' }, c.name),
      h(
        'span',
        { class: 'tile-meta' },
        badge(c.importance === 'key' ? 'Key' : 'Optional', c.importance === 'key' ? 'badge-accent' : 'badge-soft'),
        h('small', null, `Ch. ${c.chapterIndex}`),
      ),
    );

  const cluesPanel = () => {
    if (!j.clues.length)
      return h(
        'p',
        { class: 'journal-empty' },
        'No clues yet. Start Chapter 1 at Cheryl’s Antique Shop — anything you find is noted here.',
      );
    return h(
      'div',
      { class: 'stack journal-clues' },
      h('p', { class: 'journal-count', 'data-clue-count': String(j.clues.length) }, `${j.clues.length} clues found`),
      paginatorPanel({
        items: j.clues,
        minTileWidth: 132,
        minTileHeight: 150,
        maxTileHeight: 200,
        gap: 10,
        label: 'Clues',
        render: clueTile,
      }),
    );
  };

  const chaptersPanel = () =>
    paginatorPanel({
      items: j.chapters,
      minTileWidth: 260,
      minTileHeight: 110,
      maxTileHeight: 200,
      gap: 10,
      label: 'Chapter summaries',
      // A card shows the start of the summary; tapping it reads the whole thing.
      render: (c) =>
        h(
          'button',
          {
            type: 'button',
            class: `tile journal-chapter ${c.state}`,
            'data-journal-chapter': c.chapter.id,
            'aria-label': `Chapter ${c.chapter.index}: ${c.chapter.title}. ${c.state === 'completed' ? 'Solved' : 'Open'}, ${c.cluesFound} of ${c.cluesTotal} clues. Read the summary.`,
            onclick: () => void readSummary(c),
          },
          h('span', { class: 'tile-kicker' }, `Chapter ${c.chapter.index} · ${c.chapter.location}`),
          h('span', { class: 'tile-title' }, c.chapter.title),
          h(
            'p',
            { class: 'journal-summary' },
            c.summary ??
              (c.chapter.status === 'draft'
                ? 'In progress. (This chapter’s story is in development.)'
                : 'In progress.'),
          ),
          h(
            'span',
            { class: 'tile-meta' },
            badge(c.state === 'completed' ? 'Solved' : 'Open', c.state === 'completed' ? 'badge-done' : 'badge-soft'),
            h('small', null, `${c.cluesFound} / ${c.cluesTotal} clues`),
            h('span', { class: 'journal-read', 'aria-hidden': 'true' }, 'Read', icon('chevronRight')),
          ),
        ),
    });

  const scenesPanel = () => {
    const scenes = replayableScenes(store.state.profile);
    if (!scenes.length) return h('p', { class: 'journal-empty' }, 'Scenes you have seen can be replayed here.');
    return paginatorPanel({
      items: scenes,
      minTileWidth: 220,
      minTileHeight: 64,
      maxTileHeight: 84,
      gap: 8,
      label: 'Scenes',
      render: (s) =>
        h(
          'button',
          { type: 'button', class: 'tile scene-tile', 'data-replay': s.id, onclick: () => onReplay(s) },
          icon('play'),
          h(
            'span',
            { class: 'tile-body' },
            h('span', { class: 'tile-title' }, s.title),
            h('span', { class: 'tile-sub' }, `Chapter ${s.chapter.index} · ${s.chapter.location}`),
          ),
        ),
    });
  };

  const t = tabs([
    { id: 'clues', label: 'Clues', render: cluesPanel },
    { id: 'chapters', label: 'Chapters', render: chaptersPanel },
    { id: 'scenes', label: 'Scenes', render: scenesPanel },
  ]);

  const el = h(
    'div',
    { class: 'journal', 'data-journal': '' },
    deco('parlor-ui/open-book', 'journal-book-art', false),
    h('div', { class: 'journal-page stack' }, objective, t.el),
  );
  return { el, destroy: t.destroy };
}

/** A clue up close: its artwork large, with its description as text. */
/** A chapter's whole summary, which its journal card can only begin. */
function readSummary(c: JournalChapter): Promise<void> {
  return openDialog<void>({
    title: `Chapter ${c.chapter.index}: ${c.chapter.title}`,
    class: 'dialog-summary',
    body: h(
      'div',
      { class: 'summary-detail', 'data-summary-detail': c.chapter.id },
      h('p', { class: 'tile-kicker' }, c.chapter.location),
      h(
        'p',
        null,
        c.summary ??
          (c.chapter.status === 'draft' ? 'In progress. (This chapter’s story is in development.)' : 'In progress.'),
      ),
      h('p', { class: 'story-hint' }, `${c.cluesFound} of ${c.cluesTotal} clues found.`),
    ),
    dismissValue: undefined,
    actions: [{ label: 'Close', value: undefined }],
  });
}

/**
 * A clue up close: its artwork, what you see (its description), what it
 * suggests, the question it leaves open (until it is answered), and links to
 * the related clues already found. Nothing not yet found is ever named.
 */
export function inspectClue(c: Evidence, profile: Profile): Promise<void> {
  const chapter = getChapter(c.chapter);
  const location = getLocation(chapter?.locationId ?? '') ?? null;
  const found = new Set(storyOf(profile).evidence ?? []);
  const related = relatedFound(profile, c);
  const open = c.question && !(c.answeredBy && found.has(c.answeredBy));
  return openDialog<void>({
    title: c.name,
    class: 'dialog-clue',
    body: h(
      'div',
      { class: 'clue-detail', 'data-clue-detail': c.id },
      h(
        'div',
        { class: 'clue-detail-art' },
        sprite(c.sprite, { alt: c.name }) ?? h('span', { class: 'clue-blank' }, icon('hint')),
      ),
      h(
        'div',
        { class: 'clue-detail-text' },
        h(
          'p',
          { class: 'clue-detail-meta' },
          badge(
            c.importance === 'key' ? 'Key clue' : 'Optional clue',
            c.importance === 'key' ? 'badge-accent' : 'badge-soft',
          ),
          h('small', null, `Found in Chapter ${chapter?.index ?? ''}${location ? ` · ${location.name}` : ''}`),
        ),
        h('p', { 'data-clue-seen': '' }, c.description),
        c.interpretation
          ? h(
              'p',
              { class: 'clue-reading', 'data-clue-reading': '' },
              h('strong', null, 'What it suggests: '),
              c.interpretation,
            )
          : null,
        open
          ? h('p', { class: 'clue-reading', 'data-clue-question': '' }, h('strong', null, 'Still open: '), c.question)
          : null,
        related.length
          ? h(
              'div',
              { class: 'clue-related', 'data-clue-related': '' },
              h('small', null, 'Connects to'),
              ...related.map((r) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'recap-link',
                    'data-related-clue': r.id,
                    onclick: () => void inspectClue(r, profile),
                  },
                  r.name,
                ),
              ),
            )
          : null,
        c.status === 'draft'
          ? h('p', { class: 'story-hint' }, 'Draft description — this chapter is still being written.')
          : null,
      ),
    ),
    dismissValue: undefined,
    actions: [{ label: 'Close', value: undefined }],
  });
}
