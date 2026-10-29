import { h } from '@/utils/dom';
import type { Store } from '@/core/store';
import type { GameId } from '@/core/types';
import { cardRenderer } from '@/decks';
import type { DeckTheme } from '@/decks/DeckThemeManager';
import type { Card, Pile } from '@/engine';
import { audio, gameSound } from '@/audio';
import { victoryShower } from '@/components/celebration';
import { button } from '@/components/ui';
import { moreItem, setTool, toolButton, type GameToolbar } from '@/components/gameToolbar';
import { confirmDialog, openDialog } from '@/components/Dialog';
import { celebrate as announceUnlock, notify } from '@/components/Notifications';
import { ACHIEVEMENTS } from '@/achievements/registry';
import { recordGameResult } from '@/progression/results';
import { saves, sleep } from '../session';
import type { BoardMove, SolitaireGame } from './SolitaireGame';
import type { KlondikeGame } from './KlondikeGame';
import type { SpiderGame } from './SpiderGame';
import type { FreeCellGame } from './FreeCellGame';

export interface SolitaireViewContext {
  store: Store;
  surface: HTMLElement;
  hud: HTMLElement;
  tools: GameToolbar;
  theme: DeckTheme;
  game: SolitaireGame;
  onNewGame: () => void;
  onRestart: () => void;
  onExit: () => void;
  /** Result-dialog buttons (Story Mode: "Play again" / "Story map"). */
  labels?: { again: string; exit: string };
}

interface Pos {
  x: number;
  y: number;
}
interface Metrics {
  cardW: number;
  cardH: number;
  gap: number;
  originX: number;
  tableauY: number;
  height: number;
  cols: number;
  top: Map<string, number>; // pile id → column in the top row
}

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** Top-row arrangement for each game; tableau columns fill the row below. */
function topRow(gameId: string): [string, number][] {
  switch (gameId) {
    case 'klondike':
      return [
        ['stock', 0],
        ['waste', 1],
        ...Array.from({ length: 4 }, (_, i) => [`foundation:${i}`, 3 + i] as [string, number]),
      ];
    case 'spider':
      return [...Array.from({ length: 8 }, (_, i) => [`foundation:${i}`, i] as [string, number]), ['stock', 9]];
    default:
      return [
        ...Array.from({ length: 4 }, (_, i) => [`cell:${i}`, i] as [string, number]),
        ...Array.from({ length: 4 }, (_, i) => [`foundation:${i}`, 4 + i] as [string, number]),
      ];
  }
}

/**
 * Board for Klondike, Spider and FreeCell. Cards are keyed elements positioned
 * with transforms, so every move animates by itself; layout and overlap are
 * recomputed from the space available. Drag-and-drop, tap-to-select,
 * double-tap and keyboard all go through the same engine calls.
 */
export function mountSolitaire(ctx: SolitaireViewContext) {
  const { store, theme } = ctx;
  const game = ctx.game;
  const gameId = game.gameId as GameId;
  const klondike = gameId === 'klondike' ? (game as KlondikeGame) : null;
  const spider = gameId === 'spider' ? (game as SpiderGame) : null;
  const freecell = gameId === 'freecell' ? (game as FreeCellGame) : null;
  let destroyed = false;
  let paused = false;
  let busy = false;
  let finished = false;
  let selection: { pile: string; index: number } | null = null;
  /** True while the opening deal plays (visual only; the deal is already in the game state). */
  let dealing = false;
  let metrics: Metrics | null = null;

  // ----- DOM -----
  const board = h('div', { class: 'sol-board', 'data-game': gameId, role: 'application', 'aria-label': 'Card table' });
  const slots = new Map<string, HTMLElement>();
  for (const p of game.table.piles.values()) {
    const slot = h('div', { class: `sol-slot sol-slot-${p.kind}`, 'data-pile': p.id, 'aria-hidden': 'true' });
    if (p.kind === 'foundation' && !spider) slot.textContent = 'A';
    if (p.kind === 'stock') slot.append(h('span', { class: 'sol-stock-count', 'data-count': 'stock' }));
    slots.set(p.id, slot);
    board.appendChild(slot);
  }
  const pauseOverlay = h(
    'div',
    { class: 'sol-pause', hidden: true },
    h('p', null, 'Paused'),
    button('Resume', () => setPaused(false), { icon: 'play', attrs: { 'data-action': 'resume' } }),
  );
  board.appendChild(pauseOverlay);

  // Primary actions live in the table toolbar; Restart sits in its More panel.
  const undoBtn = toolButton('undo', 'Undo', () => doUndo(), { action: 'undo', sfx: null });
  const hintBtn = toolButton('hint', 'Hint', () => showHint(), { action: 'hint', sfx: null });
  const pauseBtn = toolButton('pause', 'Pause', () => setPaused(!paused), { action: 'pause' });
  const newBtn = toolButton('deal', 'New Game', () => void newGame(), { action: 'new-game' });
  const finishBtn = toolButton('play', 'Finish', () => void autoFinish(), { action: 'auto-finish' });
  finishBtn.classList.add('tool-accent');
  finishBtn.hidden = true;
  ctx.tools.primary.append(pauseBtn, undoBtn, hintBtn, newBtn, finishBtn);
  ctx.tools.more.append(moreItem('restart', 'Restart this deal', () => void restart(), 'restart'));

  const el = h('div', { class: 'solitaire' }, board);
  ctx.surface.replaceChildren(el);
  ctx.surface.classList.add('table-surface-game');

  const hudMoves = h('span', { 'data-hud': 'moves' });
  const hudTime = h('span', { 'data-hud': 'time' });
  const hudScore = h('span', { 'data-hud': 'score' });
  const hudExtra = h('span', { 'data-hud': 'extra' });
  ctx.hud.replaceChildren(hudMoves, hudTime, hudScore, hudExtra);

  // ----- Layout -----
  function measure(): void {
    const W = board.clientWidth;
    const H = board.clientHeight;
    if (!W || !H) return;
    const cols = game.tableau.length;
    // Ten Spider columns on a phone need every pixel: tighter gutters there.
    const gap = cols > 8 ? Math.max(2.5, Math.min(10, W * 0.008)) : Math.max(4, Math.min(12, W * 0.012));
    const byWidth = (W - gap * (cols + 1)) / cols;
    // Leave room for the top row plus a reasonable column below it.
    const byHeight = (H - gap * 3) / (1.4 * 2 + 1.5);
    const cardW = Math.max(28, Math.min(byWidth, byHeight, 132));
    const cardH = cardW * 1.4;
    const used = cols * cardW + (cols + 1) * gap;
    metrics = {
      cardW,
      cardH,
      gap,
      originX: Math.max(0, (W - used) / 2),
      tableauY: gap * 2 + cardH + cardH * 0.08,
      height: H,
      cols,
      top: new Map(topRow(gameId)),
    };
    board.style.setProperty('--card-w', `${cardW}px`);
    render();
  }

  const colX = (col: number) => metrics!.originX + metrics!.gap + col * (metrics!.cardW + metrics!.gap);

  /** Base position of a pile. */
  function pileOrigin(p: Pile): Pos {
    const m = metrics!;
    if (p.kind === 'tableau') return { x: colX(Number(p.id.split(':')[1])), y: m.tableauY };
    return { x: colX(m.top.get(p.id) ?? 0), y: m.gap };
  }

  /** Card positions in a pile, compressing column overlap to fit the board. */
  function cardPositions(p: Pile): Pos[] {
    const m = metrics!;
    const o = pileOrigin(p);
    if (p.kind === 'tableau') {
      const fd = m.cardH * 0.12;
      const fu = m.cardH * 0.28;
      const offsets = p.all.slice(0, -1).map((c) => (c.faceUp ? fu : fd));
      const total = offsets.reduce((a, b) => a + b, 0);
      const avail = m.height - m.tableauY - m.cardH - m.gap;
      // Shrink overlap to fit; on tall screens spread out (up to 2.5×, showing
      // about 70% of each face-up card) so columns use the room and read clearly.
      const scale = total > 0 ? Math.min(2.5, avail / total) : 1;
      let y = o.y;
      return p.all.map((_, i) => {
        const pos = { x: o.x, y };
        y += (offsets[i] ?? 0) * scale;
        return pos;
      });
    }
    if (p.kind === 'waste' && klondike?.draw === 3) {
      const n = p.size;
      return p.all.map((_, i) => ({ x: o.x + Math.max(0, i - (n - 3)) * m.cardW * 0.3, y: o.y }));
    }
    return p.all.map(() => ({ ...o }));
  }

  // ----- Rendering -----
  // Cards are keyed by opaque ids: hidden cards never expose who they are.
  const keys = new Map<string, string>();
  let keySeq = 0;
  const els = new Map<string, { el: HTMLElement; faceUp: boolean }>();
  const where = new Map<string, { pile: string; index: number }>(); // DOM key → location

  function keyOf(card: Card): string {
    let k = keys.get(card.id);
    if (!k) keys.set(card.id, (k = `k${++keySeq}`));
    return k;
  }

  // Where each card was last drawn, to tell moves and flips apart.
  const lastPile = new Map<string, string>();
  const foundationSize = new Map<string, number>();

  function render(): void {
    if (!metrics) return;
    const seen = new Set<string>();
    const motion = !store.state.settings.reducedMotion;
    let flipped = false;
    where.clear();
    let z = 1;
    for (const p of game.table.piles.values()) {
      const o = pileOrigin(p);
      const slot = slots.get(p.id)!;
      slot.style.transform = `translate(${o.x}px, ${o.y}px)`;
      slot.classList.toggle('recycle', p.kind === 'stock' && p.isEmpty && !!klondike && !klondike.waste.isEmpty);
      const positions = cardPositions(p);
      p.all.forEach((card, i) => {
        const key = keyOf(card);
        seen.add(key);
        where.set(key, { pile: p.id, index: i });
        let entry = els.get(key);
        if (!entry || entry.faceUp !== card.faceUp) {
          const next = card.faceUp
            ? cardRenderer.renderFace(theme, card.code, { className: 'sol-card' })
            : cardRenderer.renderBack(theme, { className: 'sol-card' });
          next.dataset.key = key;
          if (entry) {
            next.style.transform = entry.el.style.transform;
            if (card.faceUp) {
              if (motion) next.classList.add('sol-flip');
              flipped = true;
            }
            entry.el.replaceWith(next);
          } else board.insertBefore(next, pauseOverlay);
          entry = { el: next, faceUp: card.faceUp };
          els.set(key, entry);
        }
        const pos = positions[i]!;
        const e = entry.el;
        // A card that changed piles lifts while it travels and settles where it lands.
        const prev = lastPile.get(key);
        if (motion && prev && prev !== p.id && !dealing) {
          e.classList.remove('sol-land');
          void e.offsetWidth;
          e.classList.add('sol-land');
        }
        lastPile.set(key, p.id);
        e.dataset.pile = p.id;
        e.dataset.index = String(i);
        e.style.zIndex = String(z++);
        e.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        e.classList.toggle('selected', !!selection && selection.pile === p.id && i >= selection.index);
        e.classList.toggle('pickable', card.faceUp && game.canPick(p, i));
      });
    }
    for (const [key, entry] of els) {
      if (!seen.has(key)) {
        entry.el.remove();
        els.delete(key);
        lastPile.delete(key);
      }
    }
    // A foundation that has just been completed (Ace to King) glows.
    for (const p of game.table.piles.values()) {
      if (p.kind !== 'foundation') continue;
      const before = foundationSize.get(p.id);
      foundationSize.set(p.id, p.size);
      if (before !== undefined && before < 13 && p.size === 13 && motion) {
        const slot = slots.get(p.id)!;
        slot.classList.remove('sol-complete');
        void slot.offsetWidth;
        slot.classList.add('sol-complete');
        const top = p.top && els.get(keyOf(p.top))?.el;
        top?.classList.add('sol-crown');
      }
    }
    if (flipped && !dealing) gameSound('card_flip');
    renderHud();
  }

  function renderHud(): void {
    const d = game.data;
    hudMoves.textContent = `Moves ${d.moves}`;
    hudTime.textContent = fmt(d.elapsedMs);
    hudScore.textContent = `Score ${d.score}`;
    if (spider) hudExtra.textContent = `Runs ${spider.completedRuns}/8`;
    else if (klondike) hudExtra.textContent = `Draw ${klondike.draw}`;
    else hudExtra.textContent = '';
    const stockCount = slots.get('stock')?.querySelector('[data-count]');
    if (stockCount) {
      const n = game.pile('stock').size;
      stockCount.textContent = spider ? (n ? `${n / 10} deals` : '') : n ? String(n) : '';
    }
    undoBtn.disabled = !game.canUndo || paused || busy;
    hintBtn.disabled = paused || game.data.won;
    if (pauseBtn.getAttribute('aria-pressed') !== String(paused)) {
      setTool(pauseBtn, paused ? 'play' : 'pause', paused ? 'Resume' : 'Pause');
      pauseBtn.setAttribute('aria-pressed', String(paused));
    }
    finishBtn.hidden = !klondike?.canAutoFinish;
    // Once the game can finish itself, Finish takes Hint's place on the toolbar.
    hintBtn.hidden = !finishBtn.hidden;
  }

  // ----- Actions -----
  async function afterAction(ok: boolean, rejectEl?: Element | null): Promise<void> {
    selection = null;
    if (ok) {
      gameSound('card_move');
      gameSound('valid_move');
      render();
      if (game.data.won) await finish();
      else void saves.save(game.table);
    } else {
      render();
      if (rejectEl) shake(rejectEl);
      gameSound('invalid_move');
    }
  }

  function shake(target: Element): void {
    target.classList.remove('sol-shake');
    void (target as HTMLElement).offsetWidth;
    target.classList.add('sol-shake');
  }

  function tryMove(m: BoardMove, rejectEl?: Element | null): boolean {
    const ok = game.move(m);
    void afterAction(ok, rejectEl);
    return ok;
  }

  function stockTap(): void {
    if (freecell) return;
    const ok = game.stockAction();
    if (ok && spider) dealSounds(10, 45);
    if (!ok && spider?.lastDealBlock === 'empty-column')
      notify('Fill every column before dealing.', { kind: 'warning' });
    else if (!ok && spider?.lastDealBlock === 'empty-stock') notify('No deals left.', { kind: 'info' });
    void afterAction(ok, ok ? null : slots.get('stock'));
  }

  function doUndo(): void {
    if (paused || busy) return;
    selection = null;
    if (game.undo()) {
      gameSound('card_move');
      render();
      void saves.save(game.table);
    }
  }

  function clearHints(): void {
    for (const e of board.querySelectorAll('[data-hint]')) e.removeAttribute('data-hint');
  }

  function showHint(): void {
    if (paused || game.data.won) return;
    clearHints();
    const hnt = game.hint();
    if (!hnt) {
      notify('No moves found — try Undo or a new game.', { kind: 'info' });
      return;
    }
    audio.play('tap');
    if (hnt.kind === 'stock') {
      slots.get('stock')!.dataset.hint = 'target';
      for (const e of board.querySelectorAll<HTMLElement>('.sol-card[data-pile="stock"]')) e.dataset.hint = 'target';
    } else {
      for (const e of board.querySelectorAll<HTMLElement>(`.sol-card[data-pile="${hnt.from}"]`)) {
        if (Number(e.dataset.index) >= hnt.index) e.dataset.hint = 'source';
      }
      const to = game.pile(hnt.to);
      const topEl = to.isEmpty ? slots.get(hnt.to)! : els.get(keyOf(to.top!))!.el;
      topEl.dataset.hint = 'target';
      slots.get(hnt.to)!.dataset.hint = 'target';
    }
    setTimeout(clearHints, 2200);
  }

  function setPaused(p: boolean): void {
    if (game.data.won) return;
    paused = p;
    selection = null;
    board.classList.toggle('paused', p);
    pauseOverlay.hidden = !p;
    if (p) void saves.save(game.table);
    render();
  }

  async function autoFinish(): Promise<void> {
    if (!klondike || busy) return;
    busy = true;
    render();
    while (!destroyed && klondike.autoFinishStep()) {
      gameSound('card_move');
      render();
      await sleep(store.state.settings.reducedMotion ? 0 : 90);
    }
    busy = false;
    if (game.data.won) await finish();
    else render();
  }

  /** Counts an unfinished, started game as a loss before replacing it. */
  async function abandon(): Promise<boolean> {
    if (game.data.won || game.data.moves === 0) return true;
    const ok = await confirmDialog({
      title: 'Leave this game?',
      message: 'It will count as a loss in your statistics.',
      confirmLabel: 'Yes, deal again',
      cancelLabel: 'Keep playing',
    });
    if (!ok) return false;
    recordGameResult(store, { gameId, outcome: 'loss', score: game.data.score, durationMs: game.data.elapsedMs });
    await saves.delete(gameId);
    return true;
  }

  async function newGame(): Promise<void> {
    if (await abandon()) ctx.onNewGame();
  }

  async function restart(): Promise<void> {
    if (await abandon()) ctx.onRestart();
  }

  async function finish(): Promise<void> {
    if (finished) return;
    finished = true;
    render();
    await saves.delete(gameId);
    const summary = recordGameResult(store, {
      gameId,
      outcome: 'win',
      score: game.data.score,
      durationMs: game.data.elapsedMs,
      details: { ...(spider ? { suits: spider.suits } : {}), ...(freecell ? { usedCell: !!game.data.usedCell } : {}) },
    });
    for (const id of summary.achievements) {
      announceUnlock('Achievement unlocked', ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id);
    }
    celebrate();
    gameSound('victory');
    await sleep(store.state.settings.reducedMotion ? 100 : 1000);
    if (destroyed) return;
    const stat = (label: string, value: string | number) =>
      h(
        'div',
        { class: 'stat-item' },
        h('span', { class: 'stat-value' }, String(value)),
        h('span', { class: 'stat-label' }, label),
      );
    const choice = await openDialog<'again' | 'menu'>({
      title: 'You won!',
      icon: 'trophy',
      class: 'dialog-result result-win',
      body: h(
        'div',
        { class: 'result-body', 'data-result': 'win' },
        h(
          'div',
          { class: 'result-stats' },
          stat('Time', fmt(game.data.elapsedMs)),
          stat('Moves', game.data.moves),
          stat('Score', game.data.score),
          stat('XP', `+${summary.xp}`),
        ),
      ),
      dismissValue: 'menu',
      actions: [
        { label: ctx.labels?.exit ?? 'Main menu', value: 'menu', variant: 'ghost' },
        { label: ctx.labels?.again ?? 'New game', value: 'again', icon: 'play' },
      ],
    });
    if (choice === 'again') ctx.onNewGame();
    else ctx.onExit();
  }

  /** Victory: the foundations bounce in a wave and a shower of gold suits falls over the table. */
  function celebrate(): void {
    if (store.state.settings.reducedMotion) return;
    for (const [i, entry] of [...els.values()].entries()) {
      entry.el.style.setProperty('--i', String(i % 26));
      entry.el.classList.add('sol-dance');
    }
    board.appendChild(victoryShower());
  }

  // ----- Input: drag-and-drop, tap-to-select, double-tap -----
  interface Press {
    id: number;
    pile: string;
    index: number;
    x: number;
    y: number;
    drag: { els: HTMLElement[]; origins: string[] } | null;
  }
  let press: Press | null = null;
  let lastTap: { key: string; at: number } | null = null;

  /** The pile under a board point, generous for columns so drops are forgiving. */
  function pileAt(clientX: number, clientY: number): string | null {
    if (!metrics) return null;
    const r = board.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    const m = metrics;
    const col = Math.floor((x - m.originX - m.gap / 2) / (m.cardW + m.gap));
    if (y >= m.tableauY - m.gap) {
      return col >= 0 && col < m.cols ? `tableau:${col}` : null;
    }
    for (const [id, c] of m.top) if (c === col) return id;
    // Klondike Draw 3: the fanned waste reaches into the next column.
    if (klondike && col === 2 && klondike.draw === 3) return 'waste';
    return null;
  }

  function locate(target: EventTarget | null): { pile: string; index: number; el: HTMLElement } | null {
    const node = (target as HTMLElement)?.closest?.('.sol-card, .sol-slot') as HTMLElement | null;
    if (!node || !board.contains(node)) return null;
    if (node.classList.contains('sol-slot')) return { pile: node.dataset.pile!, index: -1, el: node };
    const loc = where.get(node.dataset.key!);
    return loc ? { ...loc, el: node } : null;
  }

  board.addEventListener('pointerdown', (e) => {
    if (dealing) endDeal(true);
    if (paused || busy || game.data.won || !e.isPrimary) return;
    const loc = locate(e.target);
    if (!loc) return;
    press = { id: e.pointerId, pile: loc.pile, index: loc.index, x: e.clientX, y: e.clientY, drag: null };
    board.setPointerCapture(e.pointerId);
  });

  board.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.drag) {
      if (Math.hypot(dx, dy) < 6 || press.index < 0) return;
      const pile = game.pile(press.pile);
      if (!game.canPick(pile, press.index)) return;
      const dragEls = pile.all.slice(press.index).map((c) => els.get(keyOf(c))!.el);
      press.drag = { els: dragEls, origins: dragEls.map((x) => x.style.transform) };
      dragEls.forEach((x, i) => {
        x.classList.add('dragging');
        x.style.zIndex = String(1000 + i);
      });
      selection = null;
      clearHints();
    }
    press.drag.els.forEach((x, i) => (x.style.transform = `${press!.drag!.origins[i]} translate(${dx}px, ${dy}px)`));
  });

  const endPress = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    if (p.drag) {
      for (const x of p.drag.els) x.classList.remove('dragging');
      const to = pileAt(e.clientX, e.clientY);
      if (to && to !== p.pile) tryMove({ from: p.pile, index: p.index, to }, p.drag.els[0]);
      else render(); // snap back
      return;
    }
    if (e.type === 'pointerup') tap(p.pile, p.index, e);
  };
  board.addEventListener('pointerup', endPress);
  board.addEventListener('pointercancel', endPress);

  function tap(pileId: string, index: number, e: PointerEvent): void {
    clearHints();
    const pile = game.pile(pileId);
    if (pile.kind === 'stock') {
      selection = null;
      stockTap();
      return;
    }
    // Double tap: send the card where it fits best.
    const key = index >= 0 ? keyOf(pile.at(index)!) : '';
    const now = e.timeStamp;
    if (key && lastTap?.key === key && now - lastTap.at < 350 && game.canPick(pile, index)) {
      lastTap = null;
      const to = game.autoTarget(pileId, index);
      if (to) tryMove({ from: pileId, index, to });
      else void afterAction(false, els.get(key)?.el);
      return;
    }
    lastTap = key ? { key, at: now } : null;

    if (selection) {
      const sel = selection;
      if (sel.pile === pileId && sel.index === index) {
        selection = null;
        render();
        return;
      }
      if (sel.pile !== pileId) {
        if (game.move({ from: sel.pile, index: sel.index, to: pileId })) {
          void afterAction(true);
          return;
        }
      }
      if (index >= 0 && game.canPick(pile, index)) {
        selection = { pile: pileId, index };
        audio.play('tap');
        render();
        return;
      }
      void afterAction(false, index >= 0 ? els.get(key)?.el : slots.get(pileId));
      return;
    }
    if (index >= 0 && game.canPick(pile, index)) {
      selection = { pile: pileId, index };
      audio.play('tap');
      render();
    }
  }

  // Keyboard
  const onKey = (e: KeyboardEvent) => {
    if (store.state.modals.length || e.altKey) return;
    const k = e.key.toLowerCase();
    if ((k === 'z' && (e.ctrlKey || e.metaKey)) || (k === 'u' && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      doUndo();
    } else if (e.ctrlKey || e.metaKey) return;
    else if (k === 'h') showHint();
    else if (k === 'p') setPaused(!paused);
    else if ((k === 'd' || k === ' ') && !(e.target as HTMLElement)?.closest?.('button') && !paused) {
      e.preventDefault();
      stockTap();
    }
  };
  addEventListener('keydown', onKey);

  // Timer: counts while visible and not paused; auto-pauses when the page is hidden.
  const timer = setInterval(() => {
    if (paused || game.data.won || document.hidden || destroyed) return;
    game.tick(1000);
    renderHud();
    if (Math.floor(game.data.elapsedMs / 1000) % 10 === 0) void saves.save(game.table);
  }, 1000);
  const onVisibility = () => {
    if (document.hidden && !paused && !game.data.won) setPaused(true);
  };
  document.addEventListener('visibilitychange', onVisibility);

  // ----- Opening: shuffle, then deal the layout out from the stock -----
  function dealSounds(n: number, every: number): void {
    for (let i = 0; i < n; i++) setTimeout(() => !destroyed && gameSound('card_deal'), i * every);
  }

  function dealIntro(): void {
    const fresh = game.data.moves === 0 && game.data.elapsedMs < 2000 && !game.data.won;
    if (!fresh || store.state.settings.reducedMotion || !metrics) return;
    const source = game.table.piles.has('stock')
      ? pileOrigin(game.pile('stock'))
      : { x: board.clientWidth / 2 - metrics.cardW / 2, y: -metrics.cardH };
    const dealt = [...els.values()].map((e) => e.el).filter((e) => e.dataset.pile !== 'stock');
    const step = Math.max(12, Math.min(34, 900 / Math.max(1, dealt.length)));
    dealing = true;
    busy = true;
    // Everything starts stacked on the stock, face down in feel (a quick riffle first).
    for (const e of dealt) {
      e.style.transition = 'none';
      e.dataset.final = e.style.transform;
      e.style.transform = `translate(${source.x}px, ${source.y}px)`;
      e.style.opacity = '0';
    }
    slots.get('stock')?.classList.add('sol-shuffling');
    gameSound('card_shuffle');
    void board.offsetWidth;
    const start = 360;
    dealt.forEach((e, i) => {
      e.style.transition = '';
      e.style.transitionDelay = `${start + i * step}ms`;
      e.style.transitionProperty = 'transform, opacity';
      e.style.transitionDuration = '380ms';
      e.style.transform = e.dataset.final!;
      e.style.opacity = '';
      delete e.dataset.final;
    });
    setTimeout(() => dealSounds(Math.min(dealt.length, 30), step * (dealt.length / Math.min(dealt.length, 30))), start);
    // Ends once the last card has landed: its delay plus the full flight (380ms) and a margin.
    const done = setTimeout(() => endDeal(), start + (dealt.length - 1) * step + 380 + 80);
    // A tap during the deal skips straight to the dealt table.
    endDeal = (skip = false) => {
      clearTimeout(done);
      for (const e of dealt) {
        if (skip) e.style.transition = 'none';
        e.style.transitionDelay = '';
        e.style.transitionProperty = '';
        e.style.transitionDuration = '';
      }
      slots.get('stock')?.classList.remove('sol-shuffling');
      dealing = false;
      busy = false;
      board.removeAttribute('data-dealing');
      if (!destroyed) render();
      if (skip) {
        void board.offsetWidth;
        for (const e of dealt) e.style.transition = '';
      }
      endDeal = () => undefined;
    };
    board.dataset.dealing = '';
  }
  let endDeal: (skip?: boolean) => void = () => undefined;

  const ro = new ResizeObserver(() => measure());
  ro.observe(board);
  measure();
  dealIntro();

  return {
    get game() {
      return game;
    },
    destroy(): void {
      destroyed = true;
      clearInterval(timer);
      ro.disconnect();
      removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      if (!game.data.won) void saves.save(game.table);
    },
  };
}
