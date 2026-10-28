import { h } from '@/utils/dom';
import { assetManager, cardRenderer, deckThemes } from '@/decks';
import { hasDeck } from '@/decks/registry';
import type { CpuPersonality } from '@/games/cpu/personalities';

/**
 * Character avatar. Uses the character's uploaded portrait when available,
 * otherwise their deck's uploaded card back, otherwise a monogram.
 * Nothing is requested while artwork is still pending.
 */
export function avatar(p: CpuPersonality, className = ''): HTMLElement {
  const el = h(
    'span',
    { class: `avatar ${className}`.trim(), style: { '--avatar-color': p.color }, 'data-avatar': p.id, title: p.name },
    h('span', { class: 'avatar-initials', 'aria-hidden': 'true' }, p.initials),
  );

  if (p.portrait.status === 'ready') {
    void assetManager
      .loadImage('assets/characters/', { path: p.id, formats: p.portrait.formats ?? ['webp', 'png'] })
      .then((img) => {
        if (!img) return;
        el.dataset.art = 'portrait';
        el.replaceChildren(h('img', { src: img.url, alt: '', draggable: 'false' }));
      });
  } else if (p.deckId && hasDeck(p.deckId)) {
    const theme = deckThemes.resolve(p.deckId);
    if (theme.deck.id === p.deckId && theme.assets.status === 'ready' && !theme.placeholder) {
      el.dataset.art = 'deck';
      el.replaceChildren(cardRenderer.renderBack(theme, { className: 'avatar-card' }));
    }
  }
  return el;
}
