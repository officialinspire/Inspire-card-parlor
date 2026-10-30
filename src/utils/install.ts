/**
 * "Install the app": browsers that support it fire `beforeinstallprompt`;
 * we keep the event so Settings can offer an Install button.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;

export function attachInstallPrompt(): void {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
  addEventListener('appinstalled', () => {
    deferred = null;
  });
}

export const canInstall = () => deferred !== null;

/** Shows the browser's install prompt. Resolves true if the player installed. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}
