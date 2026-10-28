import { h } from '@/utils/dom';
import { MATURE_MIN_AGE } from '@/core/config';
import { openDialog } from './Dialog';

/**
 * Conservative age check from a birth year alone: assumes the birthday has
 * not happened yet this year, so anyone who might be under age is refused.
 */
export function isAdult(birthYear: number, now = new Date(), minAge = MATURE_MIN_AGE): boolean {
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > now.getFullYear()) return false;
  return now.getFullYear() - birthYear - 1 >= minAge;
}

const FAILED_KEY = 'icp:age-gate-failed';

/** True if the age gate was failed earlier in this browser session. */
export function ageGateLocked(): boolean {
  try {
    return sessionStorage.getItem(FAILED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Asks for year of birth and an explicit confirmation. Only the pass/fail
 * result is kept (never the year). A failed check blocks retries this session.
 */
export async function ageGate(): Promise<boolean> {
  if (ageGateLocked()) return false;
  const now = new Date();
  const year = h(
    'select',
    { class: 'gallery-select', 'aria-label': 'Year of birth', 'data-age-year': '' },
    h('option', { value: '' }, 'Year of birth…'),
    ...Array.from({ length: 100 }, (_, i) => now.getFullYear() - i).map((y) =>
      h('option', { value: String(y) }, String(y)),
    ),
  );
  const confirm = h('input', { type: 'checkbox', 'data-age-confirm': '' });
  const choice = await openDialog<'ok' | 'cancel'>({
    title: 'Age check',
    icon: 'warning',
    alert: true,
    body: h(
      'div',
      { class: 'options-body age-gate' },
      h(
        'p',
        null,
        `Some collectible decks contain adult themes and are only for players aged ${MATURE_MIN_AGE} or over.`,
      ),
      h('label', { class: 'gallery-head' }, 'Year of birth', year),
      h(
        'label',
        { class: 'age-confirm' },
        confirm,
        h('span', null, `I confirm I am ${MATURE_MIN_AGE} or older and want to see adult-themed artwork.`),
      ),
      h('p', { class: 'ask-hint' }, 'Only the result of this check is saved on this device.'),
    ),
    dismissValue: 'cancel',
    actions: [
      { label: 'Cancel', value: 'cancel', variant: 'ghost' },
      { label: 'Continue', value: 'ok' },
    ],
  });
  if (choice !== 'ok') return false;
  const passed = confirm.checked && isAdult(Number(year.value), now);
  if (!passed && year.value) {
    try {
      sessionStorage.setItem(FAILED_KEY, '1');
    } catch {
      /* ignore */
    }
  }
  return passed;
}
