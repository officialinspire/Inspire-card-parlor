import { isStandalone } from './device';
import { notify } from '@/components/Notifications';

/**
 * "Install the app": browsers that support it fire `beforeinstallprompt`;
 * we keep the event so Settings can offer an Install button.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
let downloading = false;
let downloadAttempt = 0;
let checkAgain = false;

/** Install may happen before registration finishes; ready waits for the app worker. */
function saveInstalledVisuals(): void {
  if (!('serviceWorker' in navigator)) return;
  if (downloading) {
    checkAgain = true;
    return;
  }
  downloading = true;
  const attempt = ++downloadAttempt;
  let port: MessagePort | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let announced = false;
  const finish = () => {
    clearTimeout(timer);
    port?.close();
    if (attempt === downloadAttempt) {
      downloading = false;
      if (checkAgain) {
        checkAgain = false;
        saveInstalledVisuals();
      }
    }
  };
  const armTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(finish, 35000);
  };
  armTimeout();
  void navigator.serviceWorker.ready
    .then((registration) => {
      // A timeout or an offline launch may have abandoned this attempt.
      if (!downloading || attempt !== downloadAttempt || !registration.active) return;
      const channel = new MessageChannel();
      port = channel.port1;
      port.onmessage = ({ data }) => {
        armTimeout();
        if (data.alreadySaved) return finish();
        if (data.error || (data.done && data.failed)) {
          notify('Some visuals couldn’t be saved. Reconnect or use Settings → Data to retry.', { sound: false });
          finish();
        } else if (data.done) {
          notify('Visuals saved. The parlor is ready for offline play.', { kind: 'success', sound: false });
          finish();
        } else if (!announced) {
          announced = true;
          notify('Downloading game visuals for offline play (about 30 MB)…', { sound: false, duration: 5000 });
        }
      };
      registration.active.postMessage('cache-installed-visuals', [channel.port2]);
    })
    .catch(finish);
}

export function attachInstallPrompt(): void {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    saveInstalledVisuals();
  });
  installed = isStandalone();
  if (installed) saveInstalledVisuals();
  addEventListener('online', () => {
    if (installed) saveInstalledVisuals();
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (installed) saveInstalledVisuals();
    });
  }
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
