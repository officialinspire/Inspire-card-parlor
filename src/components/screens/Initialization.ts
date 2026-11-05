import { h } from '@/utils/dom';
import { APP } from '@/core/config';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { deckThemes, getDeck } from '@/decks';
import { audio, startMusicFromGesture } from '@/audio';
import { track } from '@/analytics/analytics';
import { introPlan, introTimeline, readLaunchHistory, recordIntroPlayed, type IntroStage } from '@/core/intro';
import { prefersReducedMotion } from '@/utils/device';
import { Timeline } from '@/utils/timeline';
import { cardBack } from '../Card';
import { brandLogo } from '../illustrations';
import { environment } from '../environment';
import { requestMenuReveal } from '../menuReveal';
import { cssUrl } from '@/boards/BoardRenderer';
import { Disposer, type ScreenFactory } from '../Screen';

/**
 * The opening sequence (Prompt 29):
 *
 *   BLACK → OFFICIAL INSPIRE presents → INSPIRE CARD PARLOR: THE THIRTEENTH HAND
 *   (with the shuffle and the real loading progress) → TOUCH TO START →
 *   fade to black → the menu rises from black.
 *
 *  · Loading runs from the first frame and is never padded; Touch to Start
 *    appears only once it has really finished.
 *  · Any tap, Enter, Space or Escape — or the Skip button — jumps to the
 *    title. The start itself needs its own tap or key, so a skip never starts
 *    the game by accident, and a second tap never starts it twice.
 *  · The start gesture unlocks Web Audio, plays a soft chime and starts the
 *    menu music (if it isn't paused).
 *  · Reduced motion (the setting or the system preference) and Low effects
 *    keep only short fades. The sequence pauses with the tab and every timer
 *    and listener is released when the screen goes.
 */
export const InitializationScreen: ScreenFactory = ({ store }) => {
  const d = new Disposer();
  const settings = store.state.settings;
  const calm = settings.reducedMotion || prefersReducedMotion();
  const plan = introPlan(settings.startupIntro, readLaunchHistory());
  const times = introTimeline(plan, calm);
  const deck = getDeck(deckThemes.safeDeckId(store.state.selection.deckId));

  // ----- The title stage: logo, subtitle, shuffle and loader (as before) -----
  const shuffle = h(
    'div',
    { class: 'shuffle', 'aria-hidden': 'true' },
    ...Array.from({ length: 7 }, (_, i) => {
      const c = cardBack(deck, 'shuffle-card');
      c.style.setProperty('--i', String(i));
      return c;
    }),
  );
  // A thin gold line that fills as the parlor opens (updated in place so it glides).
  const fill = h('span', { class: 'boot-fill' });
  const pct = h('span', { class: 'boot-pct' });
  const bar = h(
    'div',
    { class: 'boot-bar', role: 'progressbar', 'aria-label': 'Loading', 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('span', { class: 'boot-track' }, fill),
    pct,
  );
  const label = h('p', { class: 'boot-label', 'aria-live': 'polite' });
  // TOUCH TO START: a large target, named for what it does ("Enter Parlor").
  const start = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-gold btn-lg btn-enter',
      'data-nav': AppState.MAIN_MENU,
      'data-start': '',
      onclick: (e: Event) => {
        e.stopPropagation();
        activate();
      },
    },
    h('span', { class: 'start-main' }, 'Touch to start'),
    h('span', { class: 'start-sub' }, 'Enter Parlor'),
  ) as HTMLButtonElement;
  start.hidden = true;

  const env = environment(store, { variant: 'splash' });
  d.add(env.destroy);

  // The gold shine that sweeps across the logo is masked by the logo itself.
  const logoUrl = `${import.meta.env.BASE_URL}assets/branding/logo.webp`;
  const shine = h('span', { class: 'logo-shine', 'aria-hidden': 'true', style: { '--logo-mask': cssUrl(logoUrl) } });

  // ----- The presents card: the studio's name in the game's display face (no separate mark exists) -----
  const presents = h(
    'div',
    { class: 'intro-presents', 'aria-hidden': 'true' },
    h('p', { class: 'intro-kicker' }, 'Inspire Software'),
    h('p', { class: 'intro-wordmark' }, h('span', { class: 'intro-wordmark-text' }, APP.developer)),
    h('p', { class: 'intro-suits' }, '♠ ♥ ♦ ♣'),
    h('p', { class: 'intro-presents-line' }, 'presents'),
  );

  const skip = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost btn-sm intro-skip',
      'data-action': 'skip-intro',
      onclick: (e: Event) => {
        e.stopPropagation();
        toTitle();
      },
    },
    'Skip intro',
  );

  const el = h(
    'section',
    { class: 'init', 'data-plan': plan, 'aria-label': `${APP.name}: The Thirteenth Hand` },
    env.el,
    h(
      'div',
      { class: 'init-dust', 'aria-hidden': 'true' },
      ...Array.from({ length: 14 }, (_, i) =>
        h('span', {
          style: { '--x': `${(i * 71) % 100}%`, '--d': `${7 + (i % 5) * 1.6}s`, '--delay': `${(i * 0.9) % 6}s` },
        }),
      ),
    ),
    h(
      'div',
      { class: 'init-content' },
      h('p', { class: 'init-presents' }, `${APP.developer} presents`),
      h(
        'div',
        { class: 'init-title' },
        h(
          'h1',
          { class: 'game-title screen-title', tabindex: '-1' },
          h('span', { class: 'logo-wrap' }, brandLogo('init-logo'), shine),
          h('span', { class: 'game-subtitle' }, 'The Thirteenth Hand'),
        ),
      ),
      h('div', { class: 'init-stage' }, shuffle),
      h('div', { class: 'init-loader' }, bar, label, start),
      h('p', { class: 'init-version' }, `Version ${APP.version}`),
    ),
    presents,
    h('div', { class: 'intro-veil', 'aria-hidden': 'true' }),
    skip,
  );
  el.classList.toggle('calm', calm);

  // ----- Stages -----
  let stage: IntroStage = plan === 'full' ? 'black' : 'title';
  const timeline = new Timeline();
  d.add(() => timeline.clear());

  const setStage = (next: IntroStage) => {
    stage = next;
    el.dataset.stage = next;
    skip.hidden = !(next === 'black' || next === 'presents');
    start.hidden = next !== 'ready';
    if (next === 'ready') requestAnimationFrame(() => start.isConnected && start.focus({ preventScroll: true }));
  };

  /** The title is on screen: Touch to Start follows as soon as loading has finished. */
  const toTitle = () => {
    if (stage !== 'black' && stage !== 'presents') return;
    timeline.clear();
    recordIntroPlayed();
    setStage(store.state.boot.ready ? 'ready' : 'title');
  };

  // Play inside the original gesture so mobile browsers permit media playback.
  let finishVideo: (() => void) | null = null;
  const playStudioIntro = () => {
    const video = h('video', {
      class: 'studio-video',
      playsinline: '',
      preload: 'auto',
      'aria-label': 'Inspire Software intro',
    }) as HTMLVideoElement;
    video.src = `${import.meta.env.BASE_URL}assets/video/inspiresoftwareintro.mp4`;
    video.muted = settings.muted;
    video.volume = Math.max(0, Math.min(1, settings.masterVolume * settings.sfxVolume));
    let finished = false;
    let watchdog: ReturnType<typeof setTimeout>;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      video.pause();
      overlay.remove();
      finishVideo = null;
      startMusicFromGesture(store);
      timeline.clear();
      timeline.at(times.leave, () => {
        requestMenuReveal(times.reveal);
        document.documentElement.dataset.booted = '';
        navigate(AppState.MAIN_MENU);
      });
      timeline.start();
    };
    const skipVideo = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost studio-skip',
        'data-action': 'skip-studio-intro',
        onclick: (event: Event) => {
          event.stopPropagation();
          finish();
        },
      },
      'Skip video',
    );
    const overlay = h('div', { class: 'studio-intro', 'data-studio-intro': '' }, video, skipVideo);
    el.append(overlay);
    skipVideo.focus();
    finishVideo = finish;
    video.addEventListener('ended', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    // A missing/offline video or stalled decode must never trap the player.
    watchdog = setTimeout(finish, 20000);
    void video.play().catch(finish);
    d.add(() => {
      finished = true;
      clearTimeout(watchdog);
      video.pause();
      video.removeAttribute('src');
      video.load();
      overlay.remove();
      finishVideo = null;
    });
  };

  let starting = false;
  const activate = () => {
    // Only once, and only when loading is really done.
    if (starting || stage !== 'ready' || !store.state.boot.ready) return;
    starting = true;
    // Inside the gesture: unlock audio first (iOS Safari requires it), then the chime and the music.
    void audio.unlock().then(() => audio.play('chime'));

    track('enter_parlor');
    store.dispatch({ type: 'JOURNAL', update: { add: { visits: 1 } } });
    setStage('leaving');
    timeline.clear();
    playStudioIntro();
  };

  // Taps anywhere: skip the intro, or (once ready) start.
  el.addEventListener('click', (e) => {
    if ((e.target as Element).closest('button')) return;
    if (stage === 'black' || stage === 'presents') toTitle();
    else if (stage === 'ready') activate();
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.repeat) return;
    if (finishVideo && e.key === 'Escape') {
      e.preventDefault();
      finishVideo();
      return;
    }
    const skipKey = e.key === 'Escape' || e.key === 'Enter' || e.key === ' ';
    if ((stage === 'black' || stage === 'presents') && skipKey) {
      e.preventDefault();
      toTitle();
    } else if (stage === 'ready' && (e.key === 'Enter' || e.key === ' ') && document.activeElement !== start) {
      e.preventDefault();
      activate();
    }
  };
  document.addEventListener('keydown', onKey);
  d.add(() => document.removeEventListener('keydown', onKey));

  // The sequence (and its CSS animations) pauses with the tab.
  const onVisibility = () => {
    el.classList.toggle('paused', document.hidden);
    const video = el.querySelector('video');
    if (video) {
      if (document.hidden) video.pause();
      else void video.play().catch(() => finishVideo?.());
    }
    if (document.hidden) timeline.pause();
    else timeline.start();
  };
  document.addEventListener('visibilitychange', onVisibility);
  d.add(() => document.removeEventListener('visibilitychange', onVisibility));

  // ----- Loading progress (unchanged) -----
  const renderBoot = () => {
    const { progress, label: text, ready } = store.state.boot;
    const value = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    fill.style.transform = `scaleX(${value / 100})`;
    pct.textContent = `${value}%`;
    bar.setAttribute('aria-valuenow', String(value));
    label.textContent = ready ? 'The parlor is open.' : text;
    el.classList.toggle('ready', ready);
    if (ready && stage === 'title') setStage('ready');
  };

  setStage(stage);
  if (plan === 'full') {
    timeline.at(times.presents, () => stage === 'black' && setStage('presents'));
    timeline.at(times.title, toTitle);
    if (!document.hidden) timeline.start();
    else el.classList.add('paused');
  } else recordIntroPlayed();
  renderBoot();
  d.add(store.select((s) => s.boot, renderBoot));

  return { el, unmount: () => d.dispose() };
};
