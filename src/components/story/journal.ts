import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { journalOf, replayableScenes, type JournalClue, type ReplayableScene } from '@/story/world';
import { getLocation } from '@/story/locations';
import { getChapter } from '@/story/campaign';
import { openDialog } from '../Dialog';
import { icon } from '../icons';
import { paginatorPanel } from '../Paginator';
import { tabs } from '../Tabs';
import { badge } from '../ui';
import { deco, sprite } from './sprites';

/**
 * The quest journal: an antique notebook of clues, chapter summaries and
 * replayable scenes. All text is real HTML — the artwork is only the frame.
 * Clues come from the save (`story.evidence`), so they persist with it.
 */
export function journalView(store: Store, onReplay: (scene: ReplayableScene) => void) {
  const j = journalOf(store.state.profile);

  const objective = h(
    'div',
    { class: 'journal-objective', 'data-journal-objective': '' },
    deco('map-icons/quest-scroll-alert', 'journal-objective-icon'),
    j.objective
      ? h(
          'p',
          null,
          h('small', null, 'Current objective'),
          h(
            'strong',
            null,
            `Chapter ${j.objective.chapter.index} · ${j.objective.level.title}: ${j.objective.level.objectiveText}`,
          ),
        )
      : h(
          'p',
          null,
          h('small', null, 'Current objective'),
          h(
            'strong',
            null,
            j.preview
              ? `The adventure continues: Chapter ${j.preview.index}, ${j.preview.location}, is still being written.`
              : 'The thirteenth hand is finished.',
          ),
        ),
  );

  const clueTile = (c: JournalClue) =>
    h(
      'button',
      {
        type: 'button',
        class: `tile clue-tile ${c.importance}`,
        'data-clue': c.id,
        'aria-label': `${c.name}. ${c.importance === 'key' ? 'Key clue' : 'Optional clue'}, chapter ${c.chapterIndex}. Inspect.`,
        onclick: () => void inspect(c),
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
      minTileHeight: 120,
      maxTileHeight: 190,
      gap: 10,
      label: 'Chapter summaries',
      render: (c) =>
        h(
          'article',
          { class: `tile journal-chapter ${c.state}`, 'data-journal-chapter': c.chapter.id },
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
function inspect(c: JournalClue): Promise<void> {
  const location = getLocation(getChapter(c.chapter)?.locationId ?? '') ?? null;
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
          h('small', null, `Found in Chapter ${c.chapterIndex}${location ? ` · ${location.name}` : ''}`),
        ),
        h('p', null, c.description),
        c.status === 'draft'
          ? h('p', { class: 'story-hint' }, 'Draft description — this chapter is still being written.')
          : null,
      ),
    ),
    dismissValue: undefined,
    actions: [{ label: 'Close', value: undefined }],
  });
}
