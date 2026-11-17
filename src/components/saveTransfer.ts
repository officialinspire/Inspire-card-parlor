import type { Store } from '@/core/store';
import { exportBackup, importBackup, parseBackup, MAX_BACKUP_BYTES } from '@/storage/backup';
import { h } from '@/utils/dom';
import { button } from './ui';
import { confirmDialog } from './Dialog';
import { notify } from './Notifications';

/** Available away from the table, so no CPU or timer can mutate an imported hand. */
export function saveTransfer(store: Store): HTMLElement {
  const error = (e: unknown) =>
    notify(e instanceof Error ? e.message : 'Could not transfer this save file.', { kind: 'error', duration: 6000 });
  const picker = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'data-save-file': '' });
  let working = false;
  picker.addEventListener(
    'change',
    () =>
      void (async () => {
        const file = picker.files?.[0];
        picker.value = '';
        if (!file || working) return;
        working = true;
        try {
          if (file.size > MAX_BACKUP_BYTES) throw new Error('Save file is too large (maximum 5 MB).');
          const backup = parseBackup(await file.text());
          const ok = await confirmDialog({
            title: 'Load this save file?',
            message: `Replace this device’s progress and saved games with ${backup.profile.playerName}’s save? Export your current save first if you want to keep it.`,
            confirmLabel: 'Load save',
            cancelLabel: 'Cancel',
          });
          if (!ok) return;
          await importBackup(store, backup);
          notify('Save loaded. Your badges, story progress and games are ready.', { kind: 'success', duration: 5000 });
        } catch (e) {
          error(e);
        } finally {
          working = false;
        }
      })(),
  );
  return h(
    'div',
    { class: 'save-transfer' },
    h(
      'p',
      { class: 'ask-hint' },
      'Move your progress, earned badges and active games between devices, or share a save with a friend.',
    ),
    button(
      'Export save file',
      () =>
        void (async () => {
          if (working) return;
          working = true;
          try {
            const backup = await exportBackup(store);
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = h('a', {
              href: url,
              download: `inspire-card-parlor-${new Date().toISOString().slice(0, 10)}.json`,
            });
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            notify('Save file exported. Keep it somewhere you can find it.', { kind: 'success' });
          } catch (e) {
            error(e);
          } finally {
            working = false;
          }
        })(),
      { variant: 'secondary', attrs: { 'data-action': 'export-save' } },
    ),
    button('Import save file', () => picker.click(), { variant: 'secondary', attrs: { 'data-action': 'import-save' } }),
    picker,
  );
}
