import { gameEvent } from '@/analytics/productEvents';
import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { cardRenderer } from '@/decks';
import type { DeckTheme } from '@/decks/DeckThemeManager';
import { RANK_CODE, RANKS, type Rank } from '@/engine';
import { audio, gameSound } from '@/audio';
import { victoryShower } from '@/components/celebration';
import { avatar } from '@/components/Avatar';
import { say } from '@/components/SpeechBubble';
import { button } from '@/components/ui';
import { pauseVeil, setTool, toolButton, type GameToolbar } from '@/components/gameToolbar';
import { confirmDialog, openDialog } from '@/components/Dialog';
import { recordGameResult } from '@/progression/results';
import { getPersonality, pickLine, rankPlural, rankSingular } from '../cpu/personalities';
import { saves, sleep } from '../session';
import { chooseAsk } from './cpu';
import { playerView } from './view';
import type { GoFishEvent, GoFishGame, GoFishPlayer } from './GoFishGame';

export interface GoFishViewContext {
  store: Store;
  surface: HTMLElement;
  hud: HTMLElement;
  tools: GameToolbar;
  theme: DeckTheme;
  game: GoFishGame;
  onNewGame: () => void;
  onExit: () => void;
  /** Result-dialog buttons (Story Mode: "Play again" / "Story map"). */
  labels?: { again: string; exit: string };
}

const SPEED = { slow: 1.4, normal: 1, fast: 0.55 } as const;

/** Keyboard keys for ranks in the request picker. */
const RANK_KEYS: Record<string, Rank> = {
  a: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '0': 10,
  t: 10,
  j: 11,
  q: 12,
  k: 13,
};

const NUMBER_WORDS = ['', 'one', 'two', 'three'];
const countLabel = (n: number, rank: Rank) =>
  n === 1 ? `one ${rankSingular(rank)}` : `${NUMBER_WORDS[n] ?? n} ${rankPlural(rank)}`;

/** Go Fish table for 2–4 players. Opponents' cards are only ever drawn face down. */
export function mountGoFish(ctx: GoFishViewContext) {
  const { store, theme } = ctx;
  const game = ctx.game;
  const human = game.players[0]!;
  let destroyed = false;
  let busy = false;
  let paused = false;

  const f = () => (store.state.settings.reducedMotion ? 0.08 : SPEED[store.state.settings.cardAnimationSpeed]);
  /** Waits between steps, and holds the table (CPU turns included) while paused. */
  const pause = async (ms: number) => {
    await sleep(ms * f());
    while (paused && !destroyed) await sleep(120);
  };
  const rand = () => game.table.random.next();

  // ----- DOM -----
  const oppEls = new Map<string, { root: HTMLElement; count: HTMLElement; fan: HTMLElement; books: HTMLElement }>();
  const opponents = h('div', { class: 'gf-opponents', 'data-count-players': String(game.players.length - 1) });
  for (const p of game.players.slice(1)) {
    const persona = getPersonality(p.cpu);
    const count = h('span', { class: 'gf-opp-count', 'data-count': p.id });
    const fan = h('div', { class: 'gf-fan', 'aria-hidden': 'true' });
    const books = h('span', { class: 'gf-opp-books', 'data-books': p.id });
    const root = h(
      'div',
      { class: 'gf-opp', 'data-player': p.id },
      avatar(persona),
      h(
        'div',
        { class: 'gf-opp-meta' },
        h('span', { class: 'gf-opp-name' }, p.name),
        h('span', { class: 'gf-opp-stats' }, count, books),
      ),
      fan,
    );
    oppEls.set(p.id, { root, count, fan, books });
    opponents.appendChild(root);
  }

  const pondCount = h('span', { class: 'gf-pond-count', 'data-count': 'pond' });
  const pond = h(
    'div',
    { class: 'gf-pond', 'aria-label': 'Pond' },
    cardRenderer.renderBack(theme, { className: 'gf-pond-card' }),
    pondCount,
  );
  const status = h('p', { class: 'gf-status', 'aria-live': 'polite', 'data-status-text': '' });
  const myBooks = h('div', { class: 'gf-books', 'aria-label': 'Your books' });
  const hand = h('div', { class: 'gf-hand', role: 'group', 'aria-label': 'Your hand' });
  const askBtn = button('Ask', () => void humanTurn(), { icon: 'play', attrs: { 'data-action': 'ask' } });
  // Table toolbar: Pause, Hint, New Game.
  const pauseBtn = toolButton('pause', 'Pause', () => setPaused(!paused), { action: 'pause' });
  const hintBtn = toolButton('hint', 'Hint', () => showHint(), { action: 'hint' });
  const newBtn = toolButton('deal', 'New Game', () => void restart(), { action: 'new-game' });
  ctx.tools.primary.append(pauseBtn, hintBtn, newBtn);
  const veil = pauseVeil(() => setPaused(false));
  const you = h(
    'section',
    { class: 'gf-you', 'data-player': human.id, 'aria-label': 'You' },
    myBooks,
    hand,
    h('div', { class: 'gf-actions' }, askBtn),
  );
  const el = h('div', { class: 'gofish' }, opponents, h('div', { class: 'gf-center' }, pond, status), you, veil);
  ctx.surface.replaceChildren(el);
  ctx.surface.classList.add('table-surface-game');

  const hudTurn = h('span', { 'data-hud': 'turn' });
  const hudBooks = h('span', { 'data-hud': 'books' });
  ctx.hud.replaceChildren(hudTurn, hudBooks);

  const anchor = (id: string) => (id === human.id ? you : oppEls.get(id)!.root);
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name ?? id;
  const personaOf = (p: GoFishPlayer) => getPersonality(p.cpu);

  // ----- Rendering -----
  function render(): void {
    for (const p of game.players.slice(1)) {
      const o = oppEls.get(p.id)!;
      const n = game.hand(p.id).size;
      o.count.textContent = `${n} card${n === 1 ? '' : 's'}`;
      o.books.textContent = `${game.books(p.id).length} books`;
      // Face-down only: no card identity reaches the page.
      o.fan.replaceChildren(
        ...Array.from({ length: Math.min(n, 8) }, () => cardRenderer.renderBack(theme, { className: 'gf-mini' })),
      );
      o.root.classList.toggle('is-turn', game.current.id === p.id && !game.isOver);
      o.root.classList.toggle('is-empty', n === 0);
    }
    pondCount.textContent = String(game.pond.size);
    pond.classList.toggle('empty', game.pond.size === 0);

    myBooks.replaceChildren(
      ...game
        .books(human.id)
        .map((r) =>
          h(
            'span',
            { class: 'gf-book', 'data-book': RANK_CODE[r], title: `Book of ${rankPlural(r)}` },
            cardRenderer.renderFace(theme, `${RANK_CODE[r]}S` as never, { className: 'gf-book-card' }),
          ),
        ),
    );

    const cards = [...game.hand(human.id).all].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit));
    const myTurn = isMyTurn();
    hand.replaceChildren(
      ...cards.map((c) =>
        h(
          'button',
          {
            type: 'button',
            class: 'gf-card',
            'data-rank': RANK_CODE[c.rank],
            'aria-label': `${c.label}${myTurn ? ` — ask for ${rankPlural(c.rank)}` : ''}`,
            disabled: !myTurn,
            onclick: () => void humanTurn(c.rank),
          },
          cardRenderer.renderFace(theme, c.code),
        ),
      ),
    );
    fitHand();
    hand.dataset.size = String(cards.length);

    askBtn.disabled = !myTurn;
    hintBtn.disabled = !myTurn;
    if (pauseBtn.getAttribute('aria-pressed') !== String(paused)) {
      setTool(pauseBtn, paused ? 'play' : 'pause', paused ? 'Resume' : 'Pause');
      pauseBtn.setAttribute('aria-pressed', String(paused));
    }
    pauseBtn.disabled = game.isOver;
    veil.hidden = !paused;
    you.classList.toggle('is-turn', myTurn);
    hudTurn.textContent = game.isOver
      ? 'Game over'
      : game.current.id === human.id
        ? 'Your turn'
        : `${game.current.name}’s turn`;
    hudBooks.textContent = `Books ${game.books(human.id).length}`;
  }

  function fitHand(): void {
    const n = hand.children.length;
    const w = hand.clientWidth;
    const cardW = (hand.firstElementChild as HTMLElement | null)?.offsetWidth ?? 60;
    const overlap = n > 1 && w ? Math.max(0, (n * cardW - w) / (n - 1)) : 0;
    hand.style.setProperty('--overlap', `${Math.min(overlap, cardW * 0.78)}px`);
  }
  const ro = new ResizeObserver(fitHand);
  ro.observe(hand);

  const isMyTurn = () => !busy && !paused && !game.isOver && game.current.id === human.id && game.awaitingAsk;

  function setPaused(p: boolean): void {
    if (game.isOver) return;
    if (p !== paused) gameEvent(p ? 'game_paused' : 'game_resumed');
    paused = p;
    render();
  }

  /** Suggests the rank you hold most of: the ask most likely to complete a book. */
  function showHint(): void {
    if (!isMyTurn()) return;
    const ranks = game.askableRanks(human.id);
    if (!ranks.length) return;
    const best = ranks.reduce((a, b) => (game.hand(human.id).countRank(b) > game.hand(human.id).countRank(a) ? b : a));
    for (const c of hand.querySelectorAll<HTMLElement>('.gf-card')) {
      if (c.dataset.rank === RANK_CODE[best]) c.dataset.hint = 'source';
      else delete c.dataset.hint;
    }
    setStatus(`Try asking for ${rankPlural(best)} — you hold ${game.hand(human.id).countRank(best)}.`);
    setTimeout(() => hand.querySelectorAll<HTMLElement>('[data-hint]').forEach((c) => delete c.dataset.hint), 2400);
  }
  const setStatus = (text: string) => (status.textContent = text);

  // ----- Animation -----
  async function fly(from: HTMLElement, to: HTMLElement, n: number): Promise<void> {
    if (f() < 0.2 || n === 0) return;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const base = el.getBoundingClientRect();
    await Promise.all(
      Array.from({ length: Math.min(n, 4) }, (_, i) => {
        const c = cardRenderer.renderBack(theme, { className: 'gf-flying' });
        c.style.left = `${a.left - base.left + a.width / 2 - 20}px`;
        c.style.top = `${a.top - base.top + a.height / 2 - 28}px`;
        el.appendChild(c);
        return c
          .animate(
            [
              { transform: 'translate(0,0)' },
              {
                transform: `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px)`,
              },
            ],
            { duration: 420 * f(), delay: i * 60 * f(), easing: 'cubic-bezier(.22,1,.36,1)' },
          )
          .finished.catch(() => undefined)
          .finally(() => c.remove());
      }),
    );
  }

  /** Restarts a short highlight animation on a player's area (visual only). */
  function spotlight(playerId: string, cls: string): void {
    if (f() < 0.2) return;
    const a = anchor(playerId);
    a.classList.remove(cls);
    void a.offsetWidth;
    a.classList.add(cls);
    setTimeout(() => a.classList.remove(cls), 1400 * f() + 400);
  }

  function ripple(target: HTMLElement): void {
    if (f() < 0.2) return;
    target.classList.remove('gf-ripple');
    void target.offsetWidth;
    target.classList.add('gf-ripple');
  }

  // ----- Playing a request -----
  async function perform(askerId: string, targetId: string, rank: Rank): Promise<void> {
    const asker = game.players.find((p) => p.id === askerId)!;
    const target = game.players.find((p) => p.id === targetId)!;
    const askText = asker.cpu
      ? personaOf(asker).lines.ask(rank, target.id === human.id ? 'You' : target.name)
      : `${target.name}, any ${rankPlural(rank)}?`;
    void say(anchor(askerId), askText, { tone: 'ask', duration: 1500 * f() + 300 });
    gameSound('go_fish_ask');
    setStatus(`${asker.name} asked ${target.id === human.id ? 'you' : target.name} for ${rankPlural(rank)}.`);
    // The request: the asker leans in and the one being asked lights up.
    spotlight(askerId, 'gf-asking');
    spotlight(targetId, 'gf-asked');
    await pause(900);

    const result = game.ask(askerId, targetId, rank);
    for (const e of result.events) await replay(e, askerId);
    if (result.privateDraw?.player === human.id) {
      const c = result.privateDraw.card;
      setStatus(`You drew ${c.shortLabel}.`);
    }
    render();
    if (!game.isOver) await saves.save(game.table);
  }

  async function replay(e: GoFishEvent, askerId: string): Promise<void> {
    switch (e.t) {
      case 'give': {
        const giver = game.players.find((p) => p.id === e.from)!;
        const line = giver.cpu
          ? `Here — ${countLabel(e.count, e.rank)}.`
          : `Here you go: ${countLabel(e.count, e.rank)}.`;
        void say(anchor(e.from), line, { duration: 1300 * f() + 300 });
        gameSound('card_move');
        await fly(anchor(e.from), anchor(e.to), e.count);
        const receiver = game.players.find((p) => p.id === e.to)!;
        if (receiver.cpu && rand() < 0.5)
          void say(anchor(e.to), pickLine(personaOf(receiver).lines.gave), { duration: 1100 * f() + 300 });
        await pause(500);
        break;
      }
      case 'fish': {
        const asked = lastAskTarget(askerId);
        const targetPlayer = asked ? game.players.find((p) => p.id === asked) : undefined;
        const line = targetPlayer?.cpu ? pickLine(personaOf(targetPlayer).lines.goFish) : 'Go fish!';
        if (targetPlayer) void say(anchor(targetPlayer.id), line, { duration: 1300 * f() + 300 });
        await pause(500);
        if (e.drew) {
          gameSound('card_deal');
          ripple(pond);
          await fly(pond, anchor(e.p), 1);
          if (e.p !== human.id) setStatus(`${nameOf(e.p)} went fishing.`);
        } else setStatus('The pond is empty.');
        await pause(300);
        break;
      }
      case 'lucky': {
        const p = game.players.find((x) => x.id === e.p)!;
        void say(anchor(e.p), p.cpu ? pickLine(personaOf(p).lines.lucky) : 'Lucky catch!', {
          duration: 1300 * f() + 300,
        });
        setStatus(`${p.id === human.id ? 'You' : p.name} drew the ${rankSingular(e.rank)} — another turn!`);
        await pause(700);
        break;
      }
      case 'book': {
        const p = game.players.find((x) => x.id === e.p)!;
        gameSound('valid_move');
        spotlight(e.p, 'gf-booked');
        if (p.cpu) void say(anchor(e.p), pickLine(personaOf(p).lines.book), { duration: 1300 * f() + 300 });
        setStatus(`${p.id === human.id ? 'You' : p.name} laid down a book of ${rankPlural(e.rank)}.`);
        render();
        await pause(700);
        break;
      }
      case 'refill':
        setStatus(e.drew ? `${nameOf(e.p)} had no cards and drew one.` : `${nameOf(e.p)} is out of cards.`);
        render();
        await pause(500);
        break;
      case 'draw-instead':
        setStatus(`No one left to ask — ${nameOf(e.p)} drew a card.`);
        await pause(500);
        break;
      case 'out':
        setStatus(`${nameOf(e.p)} is out of cards and sits out.`);
        await pause(400);
        break;
      case 'turn':
        render();
        break;
      default:
        break;
    }
  }

  function lastAskTarget(askerId: string): string | undefined {
    const log = game.data.log;
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i]!;
      if (e.t === 'ask' && e.p === askerId) return e.to;
    }
    return undefined;
  }

  // ----- Human -----
  async function pickRequest(preset?: Rank): Promise<{ rank: Rank; target: string } | null> {
    const ranks = game.askableRanks(human.id);
    const targets = game.askableOpponents(human.id);
    let rank: Rank = preset && ranks.includes(preset) ? preset : ranks[0]!;
    let target = (targets.find((t) => t.id === lastTarget) ?? targets[0]!).id;

    const rankGrid = h('div', { class: 'rank-grid', role: 'radiogroup', 'aria-label': 'Rank' });
    const oppList = h('div', { class: 'opp-pick', role: 'radiogroup', 'aria-label': 'Opponent' });
    const draw = () => {
      rankGrid.replaceChildren(
        ...RANKS.map((r) => {
          const n = game.hand(human.id).countRank(r);
          return h(
            'button',
            {
              type: 'button',
              role: 'radio',
              class: `rank-btn${r === rank ? ' active' : ''}`,
              'aria-checked': String(r === rank),
              'aria-label': n ? `${rankPlural(r)} (you hold ${n})` : `${rankPlural(r)} (you hold none)`,
              disabled: !n,
              'data-pick-rank': RANK_CODE[r],
              onclick: () => {
                rank = r;
                audio.play('tap');
                draw();
              },
            },
            h('span', { class: 'rank-label' }, RANK_CODE[r]),
            n ? h('span', { class: 'rank-count' }, `×${n}`) : null,
          );
        }),
      );
      oppList.replaceChildren(
        ...targets.map((t) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              class: `opp-btn${t.id === target ? ' active' : ''}`,
              'aria-checked': String(t.id === target),
              'data-pick-target': t.id,
              onclick: () => {
                target = t.id;
                audio.play('tap');
                draw();
              },
            },
            avatar(personaOf(t), 'avatar-sm'),
            h(
              'span',
              { class: 'opp-btn-text' },
              h('strong', null, t.name),
              h('small', null, `${game.hand(t.id).size} cards`),
            ),
          ),
        ),
      );
    };
    draw();

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in RANK_KEYS && ranks.includes(RANK_KEYS[k]!)) {
        rank = RANK_KEYS[k]!;
        draw();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = targets.findIndex((t) => t.id === target);
        target = targets[(i + (e.key === 'ArrowRight' ? 1 : targets.length - 1)) % targets.length]!.id;
        draw();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey);
    const choice = await openDialog<'ask' | 'cancel'>({
      title: 'Ask for a rank',
      class: 'dialog-ask',
      body: h(
        'div',
        { class: 'ask-body' },
        rankGrid,
        targets.length > 1 ? h('p', { class: 'ask-label' }, 'Ask whom?') : null,
        oppList,
        h('p', { class: 'ask-hint' }, 'Keys: A 2–9 0 J Q K pick a rank · ← → pick a player · Enter asks'),
      ),
      dismissValue: 'cancel',
      actions: [
        { label: 'Cancel', value: 'cancel', variant: 'ghost' },
        { label: 'Ask', value: 'ask', icon: 'play' },
      ],
    });
    document.removeEventListener('keydown', onKey);
    if (choice !== 'ask') return null;
    lastTarget = target;
    return { rank, target };
  }
  let lastTarget: string | undefined;

  async function humanTurn(preset?: Rank): Promise<void> {
    if (!isMyTurn()) return;
    const pick = await pickRequest(preset);
    if (!pick || destroyed || !isMyTurn()) return;
    busy = true;
    render();
    gameEvent('round_started', { round: game.data.turns + 1 });
    try {
      await perform(human.id, pick.target, pick.rank);
    } finally {
      busy = false;
    }
    gameEvent('round_completed', { round: game.data.turns });
    await continuePlay();
  }

  // ----- CPUs -----
  async function continuePlay(): Promise<void> {
    busy = true;
    render();
    try {
      while (!destroyed && !game.isOver && game.current.id !== human.id) {
        const cur = game.current;
        await pause(650);
        if (destroyed) return;
        const choice = chooseAsk(playerView(game, cur.id), personaOf(cur), game.data.difficulty, rand);
        await perform(cur.id, choice.target, choice.rank);
      }
    } finally {
      busy = false;
    }
    if (destroyed) return;
    render();
    if (game.isOver) await finish();
    else if (!status.textContent?.startsWith('You drew')) setStatus('Your turn — tap a card or press Ask.');
  }

  async function restart(): Promise<void> {
    const ok = await confirmDialog({
      title: 'Start a new game?',
      message: 'This game will be abandoned and new hands dealt.',
      confirmLabel: 'New game',
      cancelLabel: 'Keep playing',
    });
    if (!ok) return;
    destroyed = true;
    await saves.delete('go-fish');
    ctx.onNewGame();
  }

  async function finish(): Promise<void> {
    await saves.delete('go-fish');
    const standings = game.standings();
    const winners = game.data.winners;
    const mine = game.books(human.id).length;
    const outcome = winners.includes(human.id) ? (winners.length === 1 ? 'win' : 'draw') : 'loss';
    const summary = recordGameResult(store, {
      gameId: 'go-fish',
      outcome,
      score: mine,
      durationMs: Date.now() - game.data.startedAt,
      details: {
        books: mine,
        asksOk: game.data.log.filter((e) => e.t === 'give' && e.to === human.id).length,
        opponents: game.players.length - 1,
        difficulty: game.data.difficulty,
      },
    });
    if (outcome === 'win') {
      gameSound('victory');
      if (!store.state.settings.reducedMotion) el.appendChild(victoryShower());
    }
    for (const p of game.players.slice(1)) {
      void say(anchor(p.id), pickLine(winners.includes(p.id) ? personaOf(p).lines.win : personaOf(p).lines.lose), {
        duration: 2400,
      });
    }
    setStatus('All 13 books are down.');
    await sleep(store.state.settings.reducedMotion ? 150 : 900);
    if (destroyed) return;
    const title =
      outcome === 'win'
        ? 'You win!'
        : outcome === 'draw'
          ? 'A shared win!'
          : `${winners.map(nameOf).join(' & ')} win${winners.length === 1 ? 's' : ''}`;
    const choice = await openDialog<'again' | 'menu'>({
      title,
      icon: outcome === 'loss' ? 'info' : 'trophy',
      class: `dialog-result result-${outcome}`,
      body: h(
        'div',
        { class: 'result-body', 'data-result': outcome },
        h(
          'ol',
          { class: 'standings' },
          ...standings.map((s) =>
            h(
              'li',
              { class: winners.includes(s.player.id) ? 'winner' : '', 'data-standing': s.player.id },
              s.player.cpu
                ? avatar(personaOf(s.player), 'avatar-sm')
                : h('span', { class: 'avatar avatar-sm avatar-you' }, 'You'),
              h('span', { class: 'standing-name' }, s.player.name),
              h('strong', null, `${s.books} book${s.books === 1 ? '' : 's'}`),
            ),
          ),
        ),
        h('p', { class: 'result-rewards' }, `+${summary.xp} XP · +${summary.credits} credits`),
      ),
      dismissValue: 'menu',
      actions: [
        { label: ctx.labels?.exit ?? 'Main menu', value: 'menu', variant: 'ghost' },
        { label: ctx.labels?.again ?? 'Play again', value: 'again', icon: 'play' },
      ],
    });
    if (choice === 'again') ctx.onNewGame();
    else ctx.onExit();
  }

  // ----- Keyboard -----
  const onKey = (e: KeyboardEvent) => {
    if (store.state.modals.length || e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = (e.target as HTMLElement)?.closest?.('button');
    if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
      e.preventDefault();
      void humanTurn();
    }
  };
  addEventListener('keydown', onKey);

  // ----- Start -----
  render();
  if (game.isOver) void finish();
  else if (game.current.id === human.id) {
    setStatus('Your turn — tap a card or press Ask.');
    if (game.data.log.filter((e) => e.t === 'ask').length === 0) {
      for (const p of game.players.slice(1))
        void say(anchor(p.id), pickLine(personaOf(p).lines.greet), { duration: 2000 });
    }
  } else void continuePlay();

  return {
    destroy(): void {
      destroyed = true;
      ro.disconnect();
      removeEventListener('keydown', onKey);
    },
  };
}
