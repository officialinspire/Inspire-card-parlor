import { notify } from '@/components/Notifications';

/**
 * Last-resort error handling. Every uncaught error and rejected promise is
 * logged (never swallowed) and counted for diagnostics. If the page is left
 * without a screen, the recovery panel from index.html takes over; otherwise
 * the player gets one quiet notice per session that something went wrong,
 * with their progress safe, rather than a frozen or blank game.
 */
export interface ErrorLog {
  errors: number;
  rejections: number;
  last: string | null;
}
export const errorLog: ErrorLog = { errors: 0, rejections: 0, last: null };

/** Noise that is not an app failure (browser layout warnings, media autoplay refusals). */
const BENIGN = [/ResizeObserver loop/i, /play\(\) request was interrupted/i, /NotAllowedError/i, /AbortError/i];
const benign = (msg: string) => BENIGN.some((r) => r.test(msg));

export function attachErrorHandling(stage: HTMLElement): void {
  let told = false;
  const check = (msg: string) => {
    errorLog.last = msg.slice(0, 300);
    if (benign(msg)) return;
    // A screen must always be showing; if the failure took it away, offer recovery.
    queueMicrotask(() => {
      const hasScreen = !!stage.querySelector('.screen');
      const w = window as Window & { __icpRecover?: (reason: string) => void };
      if (!hasScreen && document.documentElement.hasAttribute('data-booted')) w.__icpRecover?.('no-screen');
      else if (!told) {
        told = true;
        notify('Something went wrong, but your progress is safe. If anything looks stuck, go back to the menu.', {
          kind: 'warning',
          sound: false,
          duration: 6000,
        });
      }
    });
  };
  addEventListener('error', (e) => {
    // Resource load failures (images, audio) arrive here only in the capture phase: not handled here.
    if (!(e instanceof ErrorEvent)) return;
    errorLog.errors++;
    console.error('[error]', e.error ?? e.message);
    check(String(e.message || e.error));
  });
  addEventListener('unhandledrejection', (e) => {
    errorLog.rejections++;
    const msg = e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : String(e.reason);
    console.warn('[unhandled rejection]', e.reason);
    // Rejections are logged; only real failures (not media refusals) reach the player.
    if (!benign(msg)) errorLog.last = msg.slice(0, 300);
  });
}
