import { h } from '@/utils/dom';
import { button } from './ui';

const mb = (bytes: number) => Math.max(1, Math.round(bytes / 1048576));

/**
 * Explicit download of the whole offline pack — every visual, every music
 * track and the studio intro video. Ordinary play only saves what it uses,
 * respecting mobile data.
 */
export function offlineVisuals(): HTMLElement {
  const status = h(
    'p',
    { class: 'ask-hint', role: 'status', 'data-offline-visual-status': '' },
    'Installing the app automatically saves all visuals, music and the intro video for offline play. Use this button to download or retry anytime.',
  );
  const download = button(
    'Download visuals & music for offline play',
    async () => {
      download.disabled = true;
      status.textContent = 'Preparing download…';
      let port: MessagePort | undefined;
      let timer: ReturnType<typeof setTimeout>;
      const finish = (message: string) => {
        clearTimeout(timer);
        port?.close();
        status.textContent = message;
        download.disabled = false;
      };
      const armTimeout = () => {
        clearTimeout(timer);
        timer = setTimeout(() => finish('Download paused. Reconnect and try again; saved files are kept.'), 35000);
      };
      armTimeout();
      try {
        if (!('serviceWorker' in navigator)) throw new Error('Offline storage is unavailable in this browser.');
        const registration = await navigator.serviceWorker.getRegistration();
        const worker = registration?.active;
        if (!worker) throw new Error('Offline files are still preparing. Try again in a moment.');
        const channel = new MessageChannel();
        port = channel.port1;
        port.onmessage = ({ data }) => {
          armTimeout();
          if (data.error) return finish(data.error);
          const { completed, total, failed, bytes, saved, done } = data;
          if (done)
            finish(
              failed
                ? `${completed} of ${total} files saved. Retry to download ${failed} missing files.`
                : 'All visuals and music saved for offline play on this device. Installed apps refresh them automatically after updates.',
            );
          else
            status.textContent =
              typeof saved === 'number'
                ? `Saving visuals & music: ${mb(saved)} of ${mb(bytes)} MB (${completed} of ${total} files)…`
                : `Saving visuals & music: ${completed} of ${total} (${mb(bytes)} MB total)…`;
        };
        worker.postMessage('cache-visuals', [channel.port2]);
      } catch (error) {
        finish(error instanceof Error ? error.message : 'Unable to download. Please try again.');
      }
    },
    { variant: 'secondary', attrs: { 'data-action': 'download-visuals' } },
  ) as HTMLButtonElement;
  return h('div', { class: 'control', style: { flexDirection: 'column', alignItems: 'stretch' } }, download, status);
}
