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
import { cardBack, cardFace } from '../Card';
import { confirmDialog, openDialog } from '../Dialog';
import { segmented } from '../controls';
import { avatar } from '../Avatar';
import { button, iconButton, navHeader } from '../ui';
import type { ScreenFactory } from '../Screen';

const PLAYABLE: GameId[] = ['war', 'go-fish'];

/**
 * Table screen for every game: board surface and HUD. War and Go Fish mount
 * their full game views; the solitaire games show their table until their
 * rules engines arrive.
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
    if (!playable) {
      const ok = await confirmDialog({
        title: 'Leave the table?',
        message: 'This deal will be set aside. You can start a fresh one any time.',
        confirmLabel: 'Leave',
        cancelLabel: 'Keep playing',
      });
      if (!ok) return;
    }
    then();
  };

  const hud = h('span', { class: 'hud-stats', 'data-hud': '' });
  const rules = gameId ? RULES[gameId] : undefined;
  const rulesBtn = rules
    ? iconButton('info', 'How to play', () => void showRules(), { attrs: { 'data-action': 'rules' } })
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
        actions: [rulesBtn],
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

  async function chooseOptions(): Promise<boolean> {
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
    const choice = await openDialog<'deal' | 'cancel'>({
      title: `New game of ${game!.name}`,
      class: 'dialog-wide dialog-options',
      body: h('div', { class: 'options-body', 'data-options': gameId! }, lineup, ...controls),
      dismissValue: 'cancel',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'ghost' },
        { label: 'Deal', value: 'deal', icon: 'play' },
      ],
    });
    return choice === 'deal';
  }

  function createGame(): Table {
    const s = store.state.settings;
    const seed = nextSeed();
    if (gameId === 'war') {
      return WarGame.create({ opponentId: s.warOpponent, ...(seed !== undefined ? { seed } : {}) }).table;
    }
    const players = [
      { id: 'you', name: 'You' },
      ...PERSONALITIES.slice(0, s.goFishOpponents).map((p) => ({ id: p.id, name: p.name, cpu: p.id })),
    ];
    return GoFishGame.create({ players, difficulty: s.cpuDifficulty, ...(seed !== undefined ? { seed } : {}) }).table;
  }

  function mount(table: Table): void {
    view?.destroy();
    finished = false;
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
    view =
      gameId === 'war'
        ? mountWar({ ...common, game: WarGame.restore(table) })
        : mountGoFish({ ...common, game: GoFishGame.restore(table) });
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
      const detail =
        gameId === 'war'
          ? `Round ${String(saved.data.round ?? 0)} against ${getPersonality(String(saved.data.opponentId)).name}.`
          : `${(saved.data.players as unknown[]).length - 1} opponent(s), ${saved.pile('books:you').size / 4} of your books down.`;
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
      await saves.delete(gameId!);
    }
    await newGame(true);
  }

  // ----- Not yet playable: show the table -----
  function placeholder(): void {
    const stock = h(
      'div',
      { class: 'table-stock' },
      ...Array.from({ length: 4 }, () => cardBack(deck, 'stacked', 'explicit')),
    );
    const fan = h(
      'div',
      { class: 'table-fan' },
      ...(['A', 'K', 'Q', 'J', '10'] as const).map((r, i) =>
        cardFace(deck, r, (['♠', '♥', '♣', '♦', '♠'] as const)[i]!, 'fanned', 'explicit'),
      ),
    );
    hud.replaceChildren(h('span', null, '0:00'), h('span', null, '0 pts'));
    surface.replaceChildren(
      stock,
      fan,
      h(
        'div',
        { class: 'table-placard' },
        h('h2', null, 'The table is set'),
        h(
          'p',
          null,
          `${game?.name ?? 'This game'} rules are on their way. Your deck and board are ready for the dealer.`,
        ),
        h(
          'div',
          { class: 'placard-actions' },
          button('Change board', () => navigate(AppState.BOARD_SELECTION), {
            variant: 'ghost',
            attrs: { 'data-nav': AppState.BOARD_SELECTION },
          }),
          button('Main menu', () => navigate(AppState.MAIN_MENU), { attrs: { 'data-nav': AppState.MAIN_MENU } }),
        ),
      ),
    );
  }

  return {
    el,
    mount() {
      if (playable) void start();
      else placeholder();
    },
    unmount() {
      view?.destroy();
    },
  };
};
