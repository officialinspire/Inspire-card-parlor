import { h } from '@/utils/dom';
import { button } from './ui';

/** Explicit download: ordinary play only warms nearby assets, respecting mobile data. */
export function offlineVisuals(): HTMLElement {
  const status = h(
    'p',
    { class: 'ask-hint', role: 'status', 'data-offline-visual-status': '' },
    'Save all standard decks, tables and story artwork before going offline (about 30 MB). Music is streamed separately.',
  );
  const download = button(
    'Download visuals for offline play',
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
          const { completed, total, failed, bytes, done } = data;
          if (done)
            finish(
              failed
                ? `${completed} of ${total} visuals saved. Retry to download ${failed} missing files.`
                : 'All visuals saved for offline play on this device. Download again after a game update.',
            );
          else
            status.textContent = `Saving visuals: ${completed} of ${total} (${Math.ceil(bytes / 1048576)} MB total)…`;
        };
        worker.postMessage('cache-visuals', [channel.port2]);
      } catch (error) {
        finish(error instanceof Error ? error.message : 'Unable to download. Please try again.');
      }
    },
    { variant: 'secondary', attrs: { 'data-action': 'download-visuals' } },
  ) as HTMLButtonElement;
  return h('div', { class: 'control' }, download, status);
}
