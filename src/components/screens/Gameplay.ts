import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { goBack, navigate } from '@/core/store';
import type { GameId, Settings } from '@/core/types';
import { getBoard } from '@/boards/registry';
import { deckThemes, getDeck } from '@/decks';
import { getGame } from '@/games/registry';
import { CHAPTERS } from '@/story/chapters';
import { getLevel, type StoryLevel } from '@/story/campaign';
import { setActiveStoryLevel, setLastStoryOutcome } from '@/story/session';
import { goFishPlayers } from '@/story/players';
import { RULES } from '@/games/rules';
import { nextSeed, saves, setTableInfo, useStorySlot } from '@/games/session';
import { setPlayInProgress } from '@/progression/announcer';
import { PERSONALITIES, getPersonality } from '@/games/cpu/personalities';
import { WarGame } from '@/games/war/WarGame';
import { mountWar } from '@/games/war/WarView';
import { GoFishGame } from '@/games/goFish/GoFishGame';
import { mountGoFish } from '@/games/goFish/GoFishView';
import type { Table } from '@/engine';
import { KlondikeGame } from '@/games/solitaire/KlondikeGame';
import { SpiderGame } from '@/games/solitaire/SpiderGame';
import { FreeCellGame } from '@/games/solitaire/FreeCellGame';
import { mountSolitaire } from '@/games/solitaire/SolitaireView';
import type { SolitaireData } from '@/games/solitaire/SolitaireGame';
import { recordGameResult } from '@/progression/results';
import { fmtTime, winRate } from './GameSelection';
import { confirmDialog, openDialog } from '../Dialog';
import { segmented } from '../controls';
import { avatar } from '../Avatar';
import { iconButton } from '../ui';
import { gameToolbar } from '../gameToolbar';
import { Disposer } from '../Screen';
import { applyBoard } from '@/boards/BoardRenderer';
import { tableCustomizer } from '../customize';
import type { ScreenFactory } from '../Screen';

const PLAYABLE: GameId[] = ['klondike', 'spider', 'freecell', 'war', 'go-fish'];
const SOLITAIRE: GameId[] = ['klondike', 'spider', 'freecell'];

/**
 * Table screen for every game: board surface, HUD, and the shared Rules,
 * Settings and Statistics buttons. Each game mounts its own view; games are
 * saved as they go and offer to resume.
 */
export const GameplayScreen: ScreenFactory = ({ store }) => {
  const { deckId, boardId, storyChapterId, storyLevelId } = store.state.selection;
  // A story challenge brings its own game, deck, board and deal.
  const story = storyLevelId ? getLevel(storyLevelId) : undefined;
  const gameId = story ? story.game : store.state.selection.gameId;
  const game = getGame(gameId);
  const deckIdOf = () => story?.setup.deckId ?? store.state.selection.deckId;
  const boardIdOf = () => story?.setup.boardId ?? store.state.selection.boardId;
  let deck = getDeck(story ? story.setup.deckId : deckThemes.safeDeckId(deckId));
  let theme = deckThemes.resolve(deck.id);
  let board = getBoard(story ? story.setup.boardId : boardId);
  const d = new Disposer();
  const chapter = CHAPTERS.find((c) => c.id === storyChapterId);
  if (story) {
    useStorySlot(true);
    setActiveStoryLevel(story.id);
    d.add(() => {
      useStorySlot(false);
      setActiveStoryLevel(null);
      // Leaving the table ends the challenge; Quick Play never inherits it.
      store.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: null, chapterId: null });
    });
  }
  const playable = !!gameId && PLAYABLE.includes(gameId);
  let view: { destroy(): void } | null = null;

  function subtitle(): string {
    if (story) return `${chapter ? `Ch. ${chapter.index} · ` : ''}${story.title} — ${story.objectiveText}`;
    return `${deck.name} · ${board.name}`;
  }

  // Progress is saved after every round/turn, so leaving never loses it.
  const leave = (then: () => void) => then();

  const hud = h('span', { class: 'hud-stats', 'data-hud': '' });
  const rules = gameId ? RULES[gameId] : undefined;
  const toolbar = gameToolbar(store, {
    onSettings: () => void showSettings(),
    onRules: rules ? () => void showRules() : undefined,
    onStats: playable ? () => void showStats() : undefined,
    onHome: () => void leave(() => navigate(AppState.MAIN_MENU)),
  });
  d.add(toolbar.destroy);

  const surface = h('div', { class: 'table-surface' });
  const stage = h('div', { class: 'table-stage' }, surface);
  const el = h(
    'section',
    { class: 'table' },
    h(
      'header',
      { class: 'table-hud' },
      iconButton('back', 'Back', () => void leave(goBack), {
        sfx: 'back',
        class: 'btn-back',
        attrs: { 'data-nav': 'back' },
      }),
      h(
        'div',
        { class: 'table-titles' },
        h('h1', { class: 'screen-title', tabindex: '-1' }, game?.name ?? 'Table'),
        h('p', { class: 'screen-subtitle' }, subtitle()),
      ),
      hud,
    ),
    stage,
    toolbar.el,
  );

  // ----- Board & deck customisation (live, never touching game state) -----
  const paintBoard = () => {
    const st = store.state.settings;
    board = getBoard(boardIdOf());
    applyBoard(el, stage, board, {
      ambient: st.ambientAnimations && !st.reducedMotion,
      highContrast: st.highContrastTable,
    });
    const sub = el.querySelector('.screen-subtitle');
    if (sub) sub.textContent = subtitle();
  };
  paintBoard();
  d.add(store.select((st) => st.selection.boardId, paintBoard));
  d.add(
    store.select(
      (st) => `${st.settings.ambientAnimations}|${st.settings.highContrastTable}|${st.settings.reducedMotion}`,
      paintBoard,
    ),
  );
  // A new deck, card back or artwork redraws the cards of the same game.
  d.add(
    store.select(
      (st) =>
        `${st.selection.deckId}|${st.selection.cardBack}|${JSON.stringify(st.selection.artVariants)}|${st.profile.ownedVariants.length}`,
      () => {
        deck = getDeck(story ? deckIdOf() : deckThemes.safeDeckId(deckIdOf()));
        theme = deckThemes.resolve(deck.id);
        paintBoard();
        if (currentTable) mount(currentTable);
      },
    ),
  );

  async function showRules(): Promise<void> {
    if (!rules) return;
    store.dispatch({ type: 'JOURNAL', update: { add: { 'rules.opened': 1 } } });
    await openDialog({
      title: rules.title,
      icon: 'info',
      class: 'dialog-wide dialog-rules',
      body: h('dl', { class: 'rules' }, ...rules.sections.flatMap(([t, d]) => [h('dt', null, t), h('dd', null, d)])),
      dismissValue: undefined,
      actions: [{ label: 'Got it', value: undefined }],
    });
  }

  // ----- Playable games -----
  const set = (patch: Partial<Settings>) => store.dispatch({ type: 'UPDATE_SETTINGS', patch });

  /** Option controls for the current game (shared by the new-game and settings dialogs). */
  function optionControls(): { body: HTMLElement; hasOptions: boolean } {
    const s = store.state.settings;
    if (story) return { hasOptions: false, body: h('p', { class: 'story-objective' }, story.objectiveText) };
    if (gameId === 'klondike') {
      return {
        hasOptions: true,
        body: h(
          'div',
          { class: 'options-body', 'data-options': gameId },
          segmented(
            'Draw',
            [
              { value: '1', label: 'Draw 1' },
              { value: '3', label: 'Draw 3' },
            ],
            String(s.klondikeDraw),
            (v) => set({ klondikeDraw: Number(v) as 1 | 3 }),
          ),
        ),
      };
    }
    if (gameId === 'spider') {
      return {
        hasOptions: true,
        body: h(
          'div',
          { class: 'options-body', 'data-options': gameId },
          segmented(
            'Suits',
            [
              { value: '1', label: '1 suit' },
              { value: '2', label: '2 suits' },
              { value: '4', label: '4 suits' },
            ],
            String(s.spiderSuits),
            (v) => set({ spiderSuits: Number(v) as 1 | 2 | 4 }),
          ),
        ),
      };
    }
    if (gameId === 'freecell')
      return { hasOptions: false, body: h('p', null, 'FreeCell has no options: every deal starts the same way.') };
    return { hasOptions: true, body: versusOptions() };
  }

  async function chooseOptions(): Promise<boolean> {
    if (gameId === 'freecell') return true;
    const choice = await openDialog<'deal' | 'cancel'>({
      title: `New game of ${game!.name}`,
      class: 'dialog-wide dialog-options',
      body: optionControls().body,
      dismissValue: 'cancel',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'ghost' },
        { label: 'Deal', value: 'deal', icon: 'play' },
      ],
    });
    return choice === 'deal';
  }

  async function showSettings(): Promise<void> {
    const { body, hasOptions } = optionControls();
    const choice = await openDialog<'new' | 'close'>({
      title: `${game!.name} settings`,
      icon: 'settings',
      class: 'dialog-wide dialog-options',
      body: h(
        'div',
        { class: 'options-body' },
        body,
        hasOptions ? h('p', { class: 'ask-hint' }, 'Game options apply to your next game.') : null,
        ...(story
          ? [h('p', { class: 'ask-hint' }, 'Story challenges use their own deck and table.')]
          : [
              h('h3', { class: 'options-heading' }, 'Table'),
              tableCustomizer(store),
              h('p', { class: 'ask-hint' }, 'Deck, card back and table change right away; your game is untouched.'),
            ]),
      ),
      dismissValue: 'close',
      actions: hasOptions
        ? [
            { label: 'Close', value: 'close', variant: 'ghost' },
            { label: 'New game with these', value: 'new', icon: 'play' },
          ]
        : [{ label: 'Close', value: 'close', variant: 'ghost' }],
    });
    if (choice === 'new') {
      if (await abandonCurrent()) await newGame(false);
    }
  }

  async function showStats(): Promise<void> {
    const st = store.state.profile.stats[gameId!];
    const item = (label: string, value: string | number) =>
      h(
        'div',
        { class: 'stat-item' },
        h('span', { class: 'stat-value' }, String(value)),
        h('span', { class: 'stat-label' }, label),
      );
    await openDialog({
      title: `${game!.name} statistics`,
      icon: 'stats',
      class: 'dialog-wide',
      body: h(
        'div',
        { class: 'result-stats stats-dialog', 'data-stats': gameId! },
        item('Played', st.played),
        item('Won', st.won),
        item('Win rate', winRate(st)),
        item('Best time', fmtTime(st.bestTimeMs)),
        item('Best score', st.bestScore ?? '—'),
        item('Streak', `${st.currentStreak} · best ${st.longestStreak}`),
      ),
      dismissValue: undefined,
      actions: [{ label: 'Close', value: undefined }],
    });
  }

  /** Solitaire: replacing a started, unfinished game counts as a loss. */
  async function abandonCurrent(): Promise<boolean> {
    const current = currentTable?.data as SolitaireData | undefined;
    if (!SOLITAIRE.includes(gameId!) || !current || current.won || !current.moves) return true;
    const ok = await confirmDialog({
      title: 'Leave this game?',
      message: 'It will count as a loss in your statistics.',
      confirmLabel: 'Yes, deal again',
      cancelLabel: 'Keep playing',
    });
    if (ok)
      recordGameResult(store, {
        gameId: gameId!,
        outcome: 'loss',
        score: current.score,
        durationMs: current.elapsedMs,
      });
    return ok;
  }

  /** War opponent / Go Fish table options. */
  function versusOptions(): HTMLElement {
    const s = store.state.settings;
    const lineup = h('div', { class: 'lineup' });
    const drawLineup = () => {
      const ids =
        gameId === 'war'
          ? [store.state.settings.warOpponent]
          : PERSONALITIES.slice(0, store.state.settings.goFishOpponents).map((p) => p.id);
      lineup.replaceChildren(
        ...ids.map((id) => {
          const p = getPersonality(id);
          return h('div', { class: 'lineup-item' }, avatar(p), h('strong', null, p.name), h('small', null, p.title));
        }),
      );
    };
    drawLineup();
    const controls =
      gameId === 'war'
        ? [
            segmented(
              'Opponent',
              PERSONALITIES.map((p) => ({ value: p.id, label: p.name })),
              s.warOpponent,
              (v) => {
                set({ warOpponent: v });
                drawLineup();
              },
            ),
          ]
        : [
            segmented(
              'Opponents',
              [
                { value: '1', label: '1 CPU' },
                { value: '2', label: '2 CPUs' },
                { value: '3', label: '3 CPUs' },
              ],
              String(s.goFishOpponents),
              (v) => {
                set({ goFishOpponents: Number(v) as 1 | 2 | 3 });
                drawLineup();
              },
            ),
            segmented(
              'Difficulty',
              [
                { value: 'easy', label: 'Easy' },
                { value: 'normal', label: 'Normal' },
                { value: 'hard', label: 'Hard' },
              ],
              s.cpuDifficulty,
              (v) => set({ cpuDifficulty: v }),
            ),
          ];
    return h('div', { class: 'options-body', 'data-options': gameId! }, lineup, ...controls);
  }

  /** A story challenge: always its own verified deal and options. */
  function createStoryGame(level: StoryLevel): Table {
    const o = level.setup.options ?? {};
    const seed = level.setup.seed !== undefined ? { seed: level.setup.seed } : {};
    let table: Table;
    if (level.game === 'klondike') table = KlondikeGame.create({ ...seed, draw: o.draw ?? 1 }).table;
    else if (level.game === 'spider') table = SpiderGame.create({ ...seed, suits: o.suits ?? 1 }).table;
    else if (level.game === 'freecell') table = FreeCellGame.create(seed).table;
    else if (level.game === 'war') table = WarGame.create({ opponentId: o.opponent ?? 'jak_gold', ...seed }).table;
    else
      table = GoFishGame.create({
        players: goFishPlayers(o.opponents ?? ['friendly_local']),
        difficulty: o.difficulty ?? 'easy',
        ...seed,
      }).table;
    table.data.storyLevel = level.id;
    setLastStoryOutcome(null);
    return table;
  }

  function createGame(sameDealAs?: Table): Table {
    if (story) return createStoryGame(story);
    const s = store.state.settings;
    const seed = sameDealAs ? (sameDealAs.data as SolitaireData).seed : nextSeed();
    const seedOpt = seed !== undefined ? { seed } : {};
    if (gameId === 'klondike') {
      const draw = sameDealAs ? (Number(sameDealAs.data.draw) as 1 | 3) : s.klondikeDraw;
      return KlondikeGame.create({ ...seedOpt, draw }).table;
    }
    if (gameId === 'spider') {
      const suits = sameDealAs ? (Number(sameDealAs.data.suits) as 1 | 2 | 4) : s.spiderSuits;
      return SpiderGame.create({ ...seedOpt, suits }).table;
    }
    if (gameId === 'freecell') return FreeCellGame.create(seedOpt).table;
    if (gameId === 'war') {
      return WarGame.create({ opponentId: s.warOpponent, ...(seed !== undefined ? { seed } : {}) }).table;
    }
    const players = [
      { id: 'you', name: 'You' },
      ...PERSONALITIES.slice(0, s.goFishOpponents).map((p) => ({ id: p.id, name: p.name, cpu: p.id })),
    ];
    return GoFishGame.create({ players, difficulty: s.cpuDifficulty, ...(seed !== undefined ? { seed } : {}) }).table;
  }

  let currentTable: Table | null = null;

  function mount(table: Table): void {
    view?.destroy();
    currentTable = table;
    setTableInfo({ deckId: deck.id, boardId: board.id });
    // Achievement toasts wait until this hand is over.
    setPlayInProgress(true);
    surface.className = 'table-surface';
    toolbar.primary.replaceChildren();
    toolbar.more.replaceChildren();
    toolbar.closeMore();
    const common = {
      store,
      surface,
      hud,
      tools: toolbar,
      theme,
      onNewGame: () => void newGame(false),
      onExit: () => {
        navigate(story ? AppState.STORY_MODE : AppState.MAIN_MENU);
      },
      labels: story ? { again: 'Play again', exit: 'Story map' } : undefined,
    };
    if (gameId === 'war') view = mountWar({ ...common, game: WarGame.restore(table) });
    else if (gameId === 'go-fish') view = mountGoFish({ ...common, game: GoFishGame.restore(table) });
    else {
      const solitaire =
        gameId === 'klondike'
          ? KlondikeGame.restore(table)
          : gameId === 'spider'
            ? SpiderGame.restore(table)
            : FreeCellGame.restore(table);
      view = mountSolitaire({ ...common, game: solitaire, onRestart: () => void restartDeal() });
    }
  }

  /** Same deal, same options, from the beginning. */
  async function restartDeal(): Promise<void> {
    if (!currentTable) return;
    const table = createGame(currentTable);
    await saves.save(table);
    mount(table);
  }

  async function newGame(askOptions: boolean): Promise<void> {
    if (askOptions && !story && !(await chooseOptions())) {
      goBack();
      return;
    }
    const table = createGame();
    await saves.save(table);
    mount(table);
  }

  async function start(): Promise<void> {
    let saved = await saves.load(gameId!);
    // The story slot only resumes the same challenge.
    if (saved && story && saved.data.storyLevel !== story.id) {
      await saves.delete(gameId!);
      saved = null;
    }
    if (saved) {
      const sd = saved.data as SolitaireData;
      const detail =
        gameId === 'war'
          ? `Round ${String(saved.data.round ?? 0)} against ${getPersonality(String(saved.data.opponentId)).name}.`
          : gameId === 'go-fish'
            ? `${(saved.data.players as unknown[]).length - 1} opponent(s), ${saved.pile('books:you').size / 4} of your books down.`
            : `${sd.moves} moves, ${fmtTime(sd.elapsedMs)} played.`;
      const choice = await openDialog<'resume' | 'new'>({
        title: 'Resume your game?',
        icon: 'info',
        body: `You have a ${game!.name} game in progress. ${detail}`,
        dismissValue: 'resume',
        actions: [
          { label: 'New game', value: 'new', variant: 'ghost' },
          { label: 'Resume', value: 'resume', icon: 'play' },
        ],
      });
      if (choice === 'resume') return mount(saved);
      if (SOLITAIRE.includes(gameId!) && sd.moves > 0 && !sd.won) {
        recordGameResult(store, { gameId: gameId!, outcome: 'loss', score: sd.score, durationMs: sd.elapsedMs });
      }
      await saves.delete(gameId!);
    }
    await newGame(true);
  }

  return {
    el,
    mount() {
      if (playable) void start();
      else goBack();
    },
    unmount() {
      view?.destroy();
      setPlayInProgress(false);
      setTableInfo(null);
      d.dispose();
    },
  };
};
