import { startApp } from '@/core/app';

type RecoveryWindow = Window & { __icpAlive?: boolean; __icpRecover?: (reason: string) => void };
const w = window as RecoveryWindow;

// The script arrived and runs: the boot watchdog in index.html stands down.
w.__icpAlive = true;
startApp(document.getElementById('app')!).catch((err: unknown) => {
  // Never a silent black screen: log it, and offer Try again / Repair.
  console.error('[startup] the parlor failed to start:', err);
  w.__icpRecover?.('start');
});
