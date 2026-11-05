import type { Store } from '@/core/store';
import { deckThemes, visibleBoards } from '@/decks';
import { isUnlocked } from '@/progression/levels';
import { h } from '@/utils/dom';
import { button } from './ui';
import { openDialog, confirmDialog } from './Dialog';
import { notify } from './Notifications';

/** Purchasable items are advertised here; unreached story rewards remain hidden. */
export async function openShop(store: Store, onPurchase: () => void): Promise<void> {
  const body = h('div', { class: 'stack', 'data-shop': '' });
  const draw = () => {
    const p = store.state.profile;
    const items = [
      ...deckThemes.list().map((item) => ({ item, kind: 'deck' as const })),
      ...visibleBoards().map((item) => ({ item, kind: 'board' as const })),
    ].filter(({ item }) => item.unlock.type === 'credits');
    body.replaceChildren(
      h(
        'p',
        { 'data-shop-balance': '', 'aria-live': 'polite' },
        `${p.credits} credits · Earn credits by playing and completing achievements.`,
      ),
      ...items.map(({ item, kind }) => {
        const price = Number(item.unlock.type === 'credits' ? item.unlock.value : 0);
        const owned = isUnlocked(item, p, kind === 'deck' ? p.unlockedDecks : p.unlockedBoards);
        return h(
          'div',
          { class: 'shop-item', 'data-shop-item': item.id },
          h(
            'div',
            null,
            h('strong', null, item.name),
            h('p', null, `${kind === 'deck' ? 'Deck' : 'Gameboard'} · ${price} credits`),
          ),
          button(
            owned ? 'Owned' : `Buy · ${price}`,
            async () => {
              if (
                !(await confirmDialog({
                  title: 'Buy collectible?',
                  message: `Spend ${price} credits on ${item.name}?`,
                  confirmLabel: 'Buy',
                }))
              )
                return;
              const before = store.state.profile;
              store.dispatch({ type: 'BUY_COLLECTIBLE', kind, id: item.id });
              if (store.state.profile !== before) {
                notify(`${item.name} added to your collection.`, { kind: 'success' });
                onPurchase();
              }
              draw();
            },
            { disabled: owned || p.credits < price, attrs: { 'data-buy': item.id } },
          ),
        );
      }),
    );
  };
  draw();
  await openDialog({
    title: 'Parlor Shop',
    body,
    dismissValue: 'close',
    actions: [{ label: 'Close', value: 'close' }],
  });
}
