import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import type { GameId, Profile } from '@/core/types';
import { GAMES } from '@/games/registry';
import { getDeck, hasDeck } from '@/decks/registry';
import { levelProgress } from '@/progression/levels';
import { STORY_CHAPTERS } from '@/story/campaign';
import { isChapterComplete } from '@/story/progress';
import { ACHIEVEMENTS, RARITY_LABEL, type AchievementRarity } from '@/achievements/registry';
import { audio } from '@/audio';
import { medal } from '../medal';
import { passportStamps } from '../passportStamps';
import { button, progressBar, screenFrame, statItem } from '../ui';
import { winRate } from './GameSelection';
import type { ScreenFactory } from '../Screen';

const RARITIES: AchievementRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** The most-played game, or null before the first game. */
export function favoriteGame(p: Profile): GameId | null {
  let best: GameId | null = null;
  for (const g of GAMES) if ((p.stats[g.id]?.played ?? 0) > (best ? p.stats[best].played : 0)) best = g.id;
  return best;
}

/** The deck played most (from the journal); a starred deck if nothing has been played yet. */
export function favoriteDeck(p: Profile): string | null {
  let best: string | null = null;
  let most = 0;
  for (const [key, n] of Object.entries(p.journal?.counters ?? {})) {
    if (!key.startsWith('deck.') || n <= most) continue;
    const id = key.slice(5);
    if (!hasDeck(id) || getDeck(id).contentRating === 'mature') continue;
    best = id;
    most = n;
  }
  return best ?? p.favoriteDecks.find((id) => hasDeck(id) && getDeck(id).contentRating !== 'mature') ?? null;
}

export const fmtDate = (ms: number | undefined) =>
  ms ? new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Earlier';

export const PassportScreen: ScreenFactory = ({ store }) => {
  const p = store.state.profile;
  const stats = Object.values(p.stats);
  const played = stats.reduce((n, s) => n + s.played, 0);
  const won = stats.reduce((n, s) => n + s.won, 0);
  const lp = levelProgress(p);
  const fg = favoriteGame(p);
  const fd = favoriteDeck(p);
  const chapters = STORY_CHAPTERS.filter((c) => isChapterComplete(p, c)).length;
  const unlocked = new Set(p.unlockedAchievements);
  const earned = ACHIEVEMENTS.filter((a) => unlocked.has(a.id));
  const latest = [...earned]
    .sort((a, b) => (p.achievementDates[b.id] ?? 0) - (p.achievementDates[a.id] ?? 0))
    .slice(0, 6);

  const identity = h(
    'section',
    { class: 'passport-page', 'data-passport-page': '1', 'aria-label': 'Passport details' },
    h(
      'div',
      { class: 'passport-id' },
      h(
        'span',
        { class: 'passport-seal', 'aria-hidden': 'true' },
        h('strong', null, String(lp.level)),
        h('small', null, 'Level'),
      ),
      h(
        'div',
        { class: 'passport-name' },
        h('small', null, 'Card Parlor Passport'),
        h('strong', { 'data-value': 'player' }, p.playerName),
        progressBar(lp.ratio, 'Experience to the next level'),
        h('small', { 'data-value': 'xp' }, `${lp.current.toLocaleString()} / ${lp.needed.toLocaleString()} XP`),
      ),
    ),
    h(
      'div',
      { class: 'stat-grid passport-stats' },
      statItem('Credits', p.credits.toLocaleString()),
      statItem('Games played', played),
      statItem('Games won', won),
      statItem('Win rate', played ? winRate({ ...stats[0]!, played, won }) : '—'),
      statItem('Favorite game', fg ? GAMES.find((g) => g.id === fg)!.name : '—'),
      statItem('Favorite deck', fd ? getDeck(fd).name : '—'),
      statItem('Chapters', `${chapters} / ${STORY_CHAPTERS.length}`),
      statItem('Member since', fmtDate(p.createdAt)),
    ),
  );
  identity.querySelectorAll('.stat-item').forEach((el, i) => {
    (el as HTMLElement).dataset.stat = [
      'credits',
      'played',
      'won',
      'win-rate',
      'favorite-game',
      'favorite-deck',
      'chapters',
      'since',
    ][i]!;
  });

  const byRarity = h(
    'div',
    { class: 'rarity-row' },
    ...RARITIES.map((r) => {
      const all = ACHIEVEMENTS.filter((a) => a.rarity === r);
      const got = all.filter((a) => unlocked.has(a.id)).length;
      return h(
        'span',
        { class: `rarity-chip rarity-${r}`, 'data-rarity': r, title: RARITY_LABEL[r] },
        h('i', { 'aria-hidden': 'true' }),
        `${got}/${all.length}`,
      );
    }),
  );

  const travels = h(
    'section',
    { class: 'passport-page', 'data-passport-page': '2', 'aria-label': 'Stamps and achievements' },
    h('h3', { class: 'passport-heading' }, 'Stamps'),
    passportStamps(store),
    h(
      'div',
      { class: 'passport-achievements' },
      h(
        'h3',
        { class: 'passport-heading' },
        'Achievements',
        h('span', { 'data-value': 'achievements' }, `${earned.length} / ${ACHIEVEMENTS.length}`),
      ),
      progressBar(earned.length / ACHIEVEMENTS.length, 'Achievements earned'),
      byRarity,
      latest.length
        ? h(
            'ul',
            { class: 'passport-latest', 'aria-label': 'Latest achievements' },
            ...latest.map((a) =>
              h(
                'li',
                { 'data-achievement': a.id },
                medal(a, { earned: true, size: 34 }),
                h('span', null, h('strong', null, a.name), h('small', null, fmtDate(p.achievementDates[a.id]))),
              ),
            ),
          )
        : h('p', { class: 'ask-hint' }, 'Your first achievements will be listed here.'),
      button('All achievements', () => navigate(AppState.ACHIEVEMENTS), {
        variant: 'gold',
        size: 'sm',
        icon: 'trophy',
        attrs: { 'data-nav': AppState.ACHIEVEMENTS },
      }),
    ),
  );

  // On narrow screens the passport opens one page at a time; wider screens show the spread.
  const book = h('div', { class: 'passport-book', 'data-page': '1' }, identity, travels);
  const turn = (page: '1' | '2') => {
    audio.play('flip');
    book.dataset.page = page;
    for (const b of tabsEl.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.turn === page));
  };
  const tabsEl = h(
    'div',
    { class: 'passport-turn', role: 'tablist', 'aria-label': 'Passport pages' },
    h(
      'button',
      { type: 'button', role: 'tab', 'aria-selected': 'true', 'data-turn': '1', onclick: () => turn('1') },
      'Details',
    ),
    h(
      'button',
      { type: 'button', role: 'tab', 'aria-selected': 'false', 'data-turn': '2', onclick: () => turn('2') },
      'Stamps & trophies',
    ),
  );

  return {
    el: screenFrame({
      title: 'Passport',
      subtitle: 'The Card Parlor Passport',
      class: 'passport-screen',
      body: h('div', { class: 'passport-wrap' }, tabsEl, book),
    }),
  };
};
