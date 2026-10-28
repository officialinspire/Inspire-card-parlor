import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import { cardRenderer } from '@/decks';
import type { DeckTheme } from '@/decks/DeckThemeManager';
import { CardAnimator } from '@/engine/CardAnimator';
import type { Card } from '@/engine';
import { audio } from '@/audio';
import { getPersonality, pickLine } from '../cpu/personalities';
import { saves, sleep } from '../session';
import { recordGameResult } from '@/progression/results';
import { avatar } from '@/components/Avatar';
import { say } from '@/components/SpeechBubble';
import { button } from '@/components/ui';
import { confirmDialog, openDialog } from '@/components/Dialog';
import { notify } from '@/components/Notifications';
import { ACHIEVEMENTS } from '@/achievements/registry';
import { WarGame, type WarRound, type WarSide } from './WarGame';

export type WarSpeed = 'slow' | 'normal' | 'fast' | 'instant';
const SPEEDS: WarSpeed[] = ['slow', 'normal', 'fast', 'instant'];
const SPEED_LABEL: Record<WarSpeed, string> = { slow: '½×', normal: '1×', fast: '2×', instant: 'Max' };
const SPEED_FACTOR: Record<WarSpeed, number> = { slow: 1.6, normal: 1, fast: 0.45, instant: 0 };

export interface WarViewContext {
  store: Store;
  surface: HTMLElement;
  hud: HTMLElement;
  theme: DeckTheme;
  game: WarGame;
  onNewGame: () => void;
  onExit: () => void;
}

/** War table: piles, battle field, controls, animations and results. */
export function mountWar(ctx: WarViewContext) {
  const { store, theme } = ctx;
  let game = ctx.game;
  const cpu = getPersonality(game.data.opponentId);
  let speed: WarSpeed = store.state.settings.warSpeed;
  let auto = false;
  let busy = false;
  let destroyed = false;

  const animator = new CardAnimator({
    speed: () => (speed === 'slow' ? 'slow' : speed === 'fast' ? 'fast' : 'normal'),
    reducedMotion: () => speed === 'instant' || store.state.settings.reducedMotion,
  });
  const factor = () => (store.state.settings.reducedMotion ? 0.1 : SPEED_FACTOR[speed]);
  const pause = (ms: number) => (factor() === 0 ? Promise.resolve() : sleep(ms * factor()));

  // ----- DOM -----
  const pileEl = (side: WarSide) =>
    h(
      'div',
      { class: `war-pile war-pile-${side}`, 'data-pile': side },
      cardRenderer.renderBack(theme, { className: 'war-pile-card' }),
    );
  const countEl = (side: WarSide) => h('span', { class: 'war-count', 'data-count': side }, '26');

  const oppPile = pileEl('cpu');
  const youPile = pileEl('player');
  const oppCount = countEl('cpu');
  const youCount = countEl('player');
  const oppSlot = h('div', { class: 'war-slot', 'data-slot': 'cpu' });
  const youSlot = h('div', { class: 'war-slot', 'data-slot': 'player' });
  const banner = h('div', { class: 'war-banner', 'aria-live': 'polite', 'data-banner': '' });
  const oppAnchor = h('div', { class: 'war-who' }, avatar(cpu), h('span', { class: 'war-name' }, cpu.name));
  const youAnchor = h('div', { class: 'war-who war-who-you' }, h('span', { class: 'war-name' }, 'You'));

  const playBtn = button('Play Round', () => void playRound(), {
    icon: 'play',
    attrs: { 'data-action': 'play-round' },
  });
  const autoBtn = button('Auto Play', () => toggleAuto(), { variant: 'secondary', attrs: { 'data-action': 'auto' } });
  const speedBtn = button('', () => cycleSpeed(), {
    variant: 'secondary',
    attrs: { 'data-action': 'speed' },
    title: 'Change speed',
  });
  const restartBtn = button('Restart', () => void restart(), { variant: 'ghost', attrs: { 'data-action': 'restart' } });

  const el = h(
    'div',
    { class: 'war' },
    h('section', { class: 'war-side war-side-cpu', 'aria-label': `${cpu.name}'s pile` }, oppAnchor, oppPile, oppCount),
    h('section', { class: 'war-field', 'aria-label': 'Battle' }, oppSlot, banner, youSlot),
    h('section', { class: 'war-side war-side-player', 'aria-label': 'Your pile' }, youAnchor, youPile, youCount),
    h(
      'div',
      { class: 'war-controls', role: 'toolbar', 'aria-label': 'War controls' },
      playBtn,
      autoBtn,
      speedBtn,
      restartBtn,
    ),
  );
  ctx.surface.replaceChildren(el);
  ctx.surface.classList.add('table-surface-game');

  const hudRound = h('span', { 'data-hud': 'round' });
  const hudWars = h('span', { 'data-hud': 'wars' });
  ctx.hud.replaceChildren(hudRound, hudWars);

  function renderStatic(): void {
    oppCount.textContent = String(game.count('cpu'));
    youCount.textContent = String(game.count('player'));
    oppPile.classList.toggle('empty', game.count('cpu') === 0);
    youPile.classList.toggle('empty', game.count('player') === 0);
    hudRound.textContent = `Round ${game.data.round}`;
    hudWars.textContent = `Wars ${game.data.wars}`;
    speedBtn.replaceChildren(h('span', { class: 'btn-label' }, `Speed ${SPEED_LABEL[speed]}`));
    speedBtn.dataset.speed = speed;
    autoBtn.replaceChildren(h('span', { class: 'btn-label' }, auto ? 'Pause' : 'Auto Play'));
    autoBtn.setAttribute('aria-pressed', String(auto));
    playBtn.disabled = game.isOver || auto;
    autoBtn.disabled = game.isOver;
  }

  // ----- Round -----
  const faceDownEl = () => cardRenderer.renderBack(theme, { className: 'war-card' });
  const faceUpEl = (card: Card) => cardRenderer.renderFace(theme, card.code, { className: 'war-card' });

  async function showBattle(round: WarRound): Promise<void> {
    oppSlot.replaceChildren();
    youSlot.replaceChildren();
    banner.textContent = '';
    banner.className = 'war-banner';
    const instant = factor() === 0;

    for (const [i, battle] of round.battles.entries()) {
      if (i > 0) {
        banner.textContent = 'WAR!';
        banner.classList.add('is-war');
        audio.play('shuffle');
        if (i === 1 && !instant) void say(oppAnchor, pickLine(cpu.lines.warStart), { duration: 1400 * factor() + 400 });
        await pause(500);
        // Face-down cards fan out behind.
        for (const side of ['cpu', 'player'] as WarSide[]) {
          const slot = side === 'cpu' ? oppSlot : youSlot;
          const downs = battle.faceDown[side].map(() => {
            const d = faceDownEl();
            d.classList.add('war-facedown');
            slot.appendChild(d);
            return d;
          });
          if (!instant) void animator.deal(downs, center(side === 'cpu' ? oppPile : youPile), { stagger: 60 });
        }
        await pause(450);
      }
      // Both turn over a card.
      const flips = (['cpu', 'player'] as WarSide[]).map(async (side) => {
        const slot = side === 'cpu' ? oppSlot : youSlot;
        const card = side === 'cpu' ? battle.cpu : battle.player;
        const back = faceDownEl();
        back.classList.add('war-faceup');
        slot.appendChild(back);
        if (instant) {
          back.replaceWith(faceUpEl(card));
          return;
        }
        await animator.deal([back], center(side === 'cpu' ? oppPile : youPile), { ms: 280, stagger: 0 });
        audio.play('flip');
        await animator.flip(back, () => {
          const face = faceUpEl(card);
          face.classList.add('war-faceup');
          back.replaceWith(face);
          return face;
        });
      });
      await Promise.all(flips);
      await pause(380);
    }

    // Result
    const winSlot = round.winner === 'player' ? youSlot : round.winner === 'cpu' ? oppSlot : null;
    winSlot?.querySelector('.war-faceup:last-of-type')?.classList.add('win');
    banner.classList.remove('is-war');
    const n = round.pot.length;
    if (round.winner === 'player')
      banner.textContent = round.outOfCards ? `${cpu.name} is out of cards!` : `You take ${n}`;
    else if (round.winner === 'cpu')
      banner.textContent = round.outOfCards ? 'You are out of cards!' : `${cpu.name} takes ${n}`;
    else banner.textContent = 'Both out of cards — a draw!';
    banner.classList.add(round.winner === 'player' ? 'is-win' : round.winner === 'cpu' ? 'is-loss' : 'is-draw');
    banner.dataset.winner = round.winner ?? 'draw';
    audio.play(round.winner === 'player' ? 'chime' : 'tap');
    if (!instant && (round.battles.length > 1 || Math.random() < 0.15)) {
      void say(oppAnchor, pickLine(round.winner === 'cpu' ? cpu.lines.roundWin : cpu.lines.roundLose), {
        duration: 1300 * factor() + 300,
      });
    }
    await pause(650);

    // Winnings slide to the winner's pile.
    if (round.winner && !instant) {
      const target = round.winner === 'player' ? youPile : oppPile;
      const cards = [...oppSlot.children, ...youSlot.children] as HTMLElement[];
      const to = target.getBoundingClientRect();
      await Promise.all(
        cards.map((c, i) => {
          const r = c.getBoundingClientRect();
          return c
            .animate(
              [
                { transform: 'none', opacity: 1 },
                { transform: `translate(${to.left - r.left}px, ${to.top - r.top}px) scale(0.9)`, opacity: 0.2 },
              ],
              { duration: 320 * factor() + 60, delay: i * 25 * factor(), easing: 'ease-in', fill: 'forwards' },
            )
            .finished.catch(() => undefined);
        }),
      );
      // The winnings now live in the pile; clear the field so no ghost cards linger.
      oppSlot.replaceChildren();
      youSlot.replaceChildren();
    }
  }

  function center(pile: HTMLElement): { x: number; y: number } {
    const r = pile.getBoundingClientRect();
    return { x: r.left, y: r.top };
  }

  async function playRound(): Promise<void> {
    if (busy || game.isOver || destroyed) return;
    busy = true;
    playBtn.disabled = true;
    try {
      const round = game.playRound();
      renderStatic();
      await showBattle(round);
      if (destroyed) return;
      if (factor() !== 0) {
        // Keep the last battle visible but dimmed so the next round reads clearly.
        oppSlot.classList.add('settled');
        youSlot.classList.add('settled');
      }
      renderStatic();
      if (game.isOver) await finish();
      else await saves.save(game.table);
    } finally {
      busy = false;
      if (!destroyed) renderStatic();
    }
  }

  async function runAuto(): Promise<void> {
    while (auto && !game.isOver && !destroyed) {
      oppSlot.classList.remove('settled');
      youSlot.classList.remove('settled');
      await playRound();
      // In instant mode, yield to the browser every round so the page stays responsive.
      await sleep(factor() === 0 ? 0 : 350 * factor());
    }
    auto = false;
    if (!destroyed) renderStatic();
  }

  function toggleAuto(): void {
    if (game.isOver) return;
    auto = !auto;
    renderStatic();
    if (auto) void runAuto();
  }

  function cycleSpeed(): void {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
    store.dispatch({ type: 'UPDATE_SETTINGS', patch: { warSpeed: speed } });
    renderStatic();
  }

  async function restart(): Promise<void> {
    const wasAuto = auto;
    auto = false;
    renderStatic();
    if (!game.isOver && game.data.round > 0) {
      const ok = await confirmDialog({
        title: 'Restart War?',
        message: 'This game will be abandoned and a fresh deck dealt.',
        confirmLabel: 'Restart',
        cancelLabel: 'Keep playing',
      });
      if (!ok) {
        if (wasAuto) toggleAuto();
        return;
      }
    }
    while (busy) await sleep(30);
    await saves.delete('war');
    ctx.onNewGame();
  }

  async function finish(): Promise<void> {
    auto = false;
    const outcome = game.status === 'won' ? 'win' : game.status === 'lost' ? 'loss' : 'draw';
    await saves.delete('war');
    const summary = recordGameResult(store, {
      gameId: 'war',
      outcome,
      durationMs: Date.now() - game.data.startedAt,
      details: { warsLost: game.data.warsLost },
    });
    for (const id of summary.achievements) {
      notify(`Achievement unlocked: ${ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id}`, {
        kind: 'success',
        icon: 'trophy',
      });
    }
    if (outcome === 'win') celebrate();
    void say(oppAnchor, pickLine(outcome === 'win' ? cpu.lines.lose : cpu.lines.win), { duration: 2600 });
    await sleep(outcome === 'win' && !store.state.settings.reducedMotion ? 900 : 200);
    if (destroyed) return;
    const title = outcome === 'win' ? 'Victory!' : outcome === 'loss' ? `${cpu.name} wins` : 'A rare draw';
    const choice = await openDialog<'again' | 'menu'>({
      title,
      icon: outcome === 'win' ? 'trophy' : 'info',
      class: `dialog-result result-${outcome}`,
      body: h(
        'div',
        { class: 'result-body', 'data-result': outcome },
        h(
          'p',
          null,
          outcome === 'win'
            ? 'You won every card in the deck.'
            : outcome === 'loss'
              ? `${cpu.name} collected all 52 cards.`
              : 'You both ran out in the same war.',
        ),
        h(
          'div',
          { class: 'result-stats' },
          stat('Rounds', game.data.round),
          stat('Wars', game.data.wars),
          stat('XP', `+${summary.xp}`),
          stat('Credits', `+${summary.credits}`),
        ),
      ),
      dismissValue: 'menu',
      actions: [
        { label: 'Main menu', value: 'menu', variant: 'ghost' },
        { label: 'Play again', value: 'again', icon: 'play' },
      ],
    });
    if (choice === 'again') ctx.onNewGame();
    else ctx.onExit();
  }

  function celebrate(): void {
    if (store.state.settings.reducedMotion) return;
    const burst = h('div', { class: 'victory-burst', 'aria-hidden': 'true' });
    for (let i = 0; i < 18; i++) {
      const c = cardRenderer.renderBack(theme, { className: 'burst-card' });
      c.style.setProperty('--a', `${(i / 18) * 360}deg`);
      c.style.setProperty('--d', `${120 + (i % 3) * 60}px`);
      c.style.setProperty('--delay', `${(i % 6) * 40}ms`);
      burst.appendChild(c);
    }
    el.appendChild(burst);
    setTimeout(() => burst.remove(), 2200);
  }

  const stat = (label: string, value: string | number) =>
    h(
      'div',
      { class: 'stat-item' },
      h('span', { class: 'stat-value' }, String(value)),
      h('span', { class: 'stat-label' }, label),
    );

  // ----- Keyboard -----
  const onKey = (e: KeyboardEvent) => {
    if (store.state.modals.length || e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = (e.target as HTMLElement)?.closest?.('button');
    if ((e.key === ' ' || e.key === 'Enter') && !onButton) {
      e.preventDefault();
      void playRound();
    } else if (e.key === 'a' || e.key === 'A') toggleAuto();
    else if (e.key === 's' || e.key === 'S') cycleSpeed();
    else if (e.key === 'r' || e.key === 'R') void restart();
  };
  addEventListener('keydown', onKey);

  renderStatic();
  if (game.data.round === 0) void say(oppAnchor, pickLine(cpu.lines.greet), { duration: 2200 });

  return {
    destroy(): void {
      destroyed = true;
      auto = false;
      removeEventListener('keydown', onKey);
    },
  };
}
