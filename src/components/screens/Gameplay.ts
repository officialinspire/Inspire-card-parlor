import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { goBack, navigate } from '@/core/store';
import type { GameId, Settings } from '@/core/types';
import { getBoard } from '@/boards/registry';
import { deckThemes, getDeck } from '@/decks';
import { getGame } from '@/games/registry';
import { CHAPTERS } from '@/story/chapters';
import { RULES } from '@/games/rules';
import { nextSeed, saves } from '@/games/session';
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
import { iconButton, navHeader } from '../ui';
import type { ScreenFactory } from '../Screen';

const PLAYABLE: GameId[] = ['klondike', 'spider', 'freecell', 'war', 'go-fish'];
const SOLITAIRE: GameId[] = ['klondike', 'spider', 'freecell'];

/**
 * Table screen for every game: board surface, HUD, and the shared Rules,
 * Settings and Statistics buttons. Each game mounts its own view; games are
 * saved as they go and offer to resume.
 */
export const GameplayScreen: ScreenFactory = ({ store }) => {
  const { gameId, deckId, boardId, storyChapterId } = store.state.selection;
  const game = getGame(gameId);
  const deck = getDeck(deckThemes.safeDeckId(deckId));
  const theme = deckThemes.resolve(deck.id);
  const board = getBoard(boardId);
  const chapter = CHAPTERS.find((c) => c.id === storyChapterId);
  const playable = !!gameId && PLAYABLE.includes(gameId);
  let view: { destroy(): void } | null = null;
  let finished = false;

  const leave = async (then: () => void) => {
    if (playable && !finished) {
      // Progress is saved after every round/turn, so leaving never loses it.
      then();
      return;
    }
    then();
  };

  const hud = h('span', { class: 'hud-stats', 'data-hud': '' });
  const rules = gameId ? RULES[gameId] : undefined;
  const rulesBtn = rules
    ? iconButton('info', 'How to play', () => void showRules(), { attrs: { 'data-action': 'rules' } })
    : null;
  const settingsBtn = playable
    ? iconButton('settings', 'Game settings', () => void showSettings(), { attrs: { 'data-action': 'game-settings' } })
    : null;
  const statsBtn = playable
    ? iconButton('stats', 'Statistics', () => void showStats(), { attrs: { 'data-action': 'game-stats' } })
    : null;

  const surface = h('div', { class: 'table-surface' });
  const el = h(
    'section',
    { class: 'table', style: { '--felt': board.felt, '--rim': board.rim } },
    h(
      'div',
      { class: 'table-hud' },
      navHeader({
        title: game?.name ?? 'Table',
        subtitle: chapter ? `Story · ${chapter.title}` : `${deck.name} · ${board.name}`,
        back: () => void leave(goBack),
        home: () => void leave(() => navigate(AppState.MAIN_MENU)),
        showCredits: false,
        actions: [rulesBtn, settingsBtn, statsBtn],
      }),
      hud,
    ),
    surface,
  );

  async function showRules(): Promise<void> {
    if (!rules) return;
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
        hasOptions ? h('p', { class: 'ask-hint' }, 'Changes apply to your next game.') : null,
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

  function createGame(sameDealAs?: Table): Table {
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
    finished = false;
    currentTable = table;
    surface.className = 'table-surface';
    const common = {
      store,
      surface,
      hud,
      theme,
      onNewGame: () => void newGame(false),
      onExit: () => {
        finished = true;
        navigate(AppState.MAIN_MENU);
      },
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
    if (askOptions && !(await chooseOptions())) {
      goBack();
      return;
    }
    const table = createGame();
    await saves.save(table);
    mount(table);
  }

  async function start(): Promise<void> {
    const saved = await saves.load(gameId!);
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
    },
  };
};
