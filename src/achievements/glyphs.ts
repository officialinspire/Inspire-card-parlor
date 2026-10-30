/**
 * Drawn glyphs for achievement medals (24×24, filled with currentColor
 * unless a path sets its own stroke). No emoji: every icon is vector art.
 */
export const GLYPHS = {
  spade: '<path d="M12 3c3 4 7 6.5 7 10a3.6 3.6 0 0 1-6.2 2.5L14 20H10l1.2-4.5A3.6 3.6 0 0 1 5 13c0-3.5 4-6 7-10z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4 4 0 0 1 12 7.7a4 4 0 0 1 7.5 2.3c0 5.4-7.5 10-7.5 10z"/>',
  diamond: '<path d="M12 3l6.5 9-6.5 9-6.5-9z"/>',
  club: '<circle cx="12" cy="7.5" r="3.4"/><circle cx="7.6" cy="13" r="3.4"/><circle cx="16.4" cy="13" r="3.4"/><path d="M11 13h2l1.2 7H9.8z"/>',
  crown: '<path d="M4 8l4.5 3.5L12 5l3.5 6.5L20 8l-1.6 9H5.6z"/><rect x="5.6" y="18" width="12.8" height="2" rx=".6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  flame:
    '<path d="M12 3c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4 2.6-5.2.1 1.6.8 2.7 1.9 3.2C11 8.8 11 6 12 3z"/>',
  moon: '<path d="M18.5 15.5A7.5 7.5 0 0 1 8.5 5.5a7.5 7.5 0 1 0 10 10z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  key: '<circle cx="8" cy="12" r="4.2"/><circle cx="8" cy="12" r="1.6" fill="var(--medal-bg)"/><path d="M11.5 11h9v2.6h-2v2.2h-2.4v-2.2h-4.6z"/>',
  book: '<path d="M4 5.5c3-.6 6 0 7.2 1.3V19c-1.2-1.3-4.2-1.9-7.2-1.3zM20 5.5c-3-.6-6 0-7.2 1.3V19c1.2-1.3 4.2-1.9 7.2-1.3z"/>',
  compass:
    '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  music:
    '<path d="M9.5 17.5V6.3l9-1.8v11" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="17.5" r="2.6"/><circle cx="16" cy="15.5" r="2.6"/>',
  cards:
    '<rect x="4" y="6" width="9" height="13" rx="1.5" transform="rotate(-12 8.5 12.5)"/><rect x="11" y="4.5" width="9" height="13" rx="1.5" transform="rotate(10 15.5 11)" opacity=".75"/>',
  trophy:
    '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H5a3 3 0 0 0 3 4M16.5 6H19a3 3 0 0 1-3 4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 13h2v4h-2z"/><rect x="8" y="17" width="8" height="2.6" rx=".8"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z"/>',
  swords:
    '<path d="M5 4l9.5 9.5-1.5 1.5L3.5 5.5zM19 4L9.5 13.5l1.5 1.5L20.5 5.5z"/><path d="M6 15l3 3-2 2-3-3zM18 15l-3 3 2 2 3-3z"/>',
  fish: '<path d="M3 12c3-4.5 9-5.5 13.5-2L21 7v10l-4.5-3C12 17.5 6 16.5 3 12z"/><circle cx="8" cy="11.3" r="1" fill="var(--medal-bg)"/>',
  hook: '<path d="M14 3v10a4.5 4.5 0 0 1-9 0v-1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5 9l-2 3h4z"/><circle cx="14" cy="3.5" r="1.6"/>',
  web: '<g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="8.7"/></g>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c-.5 9.5-5.5 15-14 15z"/><path d="M5 19l8-8" stroke="var(--medal-bg)" stroke-width="1.4"/>',
  clock:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.5l3.5 2" stroke="var(--medal-bg)" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  bolt: '<path d="M13.5 2.5L5.5 13h5l-1 8.5 8-10.5h-5z"/>',
  gem: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 16M15 4l-3 16" stroke="var(--medal-bg)" stroke-width="1" fill="none"/>',
  feather:
    '<path d="M19.5 4.5C11 4 6 9.5 6 17l-2 2.5 1 1 2.4-2c7.6 0 12.6-5.4 12.1-14z"/><path d="M7 17l8.5-8.5" stroke="var(--medal-bg)" stroke-width="1.3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2" fill="var(--medal-bg)"/><circle cx="12" cy="12" r="1.5"/>',
  stamp:
    '<path d="M9.5 3.5h5v5l3 2.5v3h-11v-3l3-2.5z"/><rect x="4" y="15" width="16" height="2.4" rx=".6"/><rect x="5.5" y="18.5" width="13" height="2" rx=".6" opacity=".7"/>',
  palette:
    '<path d="M12 3.5c5 0 9 3.4 9 7.6 0 2.4-2 3.6-4 3.6h-1.6a1.7 1.7 0 0 0-1.2 2.9 1.8 1.8 0 0 1-1.3 3C7.3 20.6 3 16.7 3 12c0-4.7 4-8.5 9-8.5z"/><circle cx="7.5" cy="11" r="1.4" fill="var(--medal-bg)"/><circle cx="10.5" cy="7.3" r="1.4" fill="var(--medal-bg)"/><circle cx="15" cy="7.5" r="1.4" fill="var(--medal-bg)"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="6" fill="none" stroke="var(--medal-bg)" stroke-width="1.2"/><path d="M12 8v8M9.8 10.2c.4-.8 1.2-1.2 2.2-1.2 1.3 0 2.2.7 2.2 1.6 0 2.1-4.4 1.2-4.4 3.3 0 .9.9 1.6 2.2 1.6 1 0 1.8-.4 2.2-1.2" stroke="var(--medal-bg)" stroke-width="1.3" fill="none"/>',
  medal:
    '<path d="M7.5 3h3l1.5 5-3 1.5zM16.5 3h-3L12 8l3 1.5z"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12l.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2z" fill="var(--medal-bg)"/>',
  hourglass:
    '<path d="M6 3h12v2.5c0 3-3.5 4.5-3.5 6.5s3.5 3.5 3.5 6.5V21H6v-2.5c0-3 3.5-4.5 3.5-6.5S6 8.5 6 5.5z"/><path d="M8.5 19h7c-.5-2-3.5-3-3.5-4.5 0 1.5-3 2.5-3.5 4.5z" fill="var(--medal-bg)"/>',
  map: '<path d="M3 6l6-2.5 6 2.5 6-2.5v14.5L15 20.5 9 18l-6 2.5z"/><path d="M9 3.5V18M15 6v14.5" stroke="var(--medal-bg)" stroke-width="1.2"/>',
  binoculars:
    '<circle cx="7" cy="15" r="4"/><circle cx="17" cy="15" r="4"/><path d="M5 11l2-6h3v6M19 11l-2-6h-3v6M10 9h4v3h-4z"/>',
  rook: '<path d="M6 4h2.5v2h2V4h3v2h2V4H18v4.5l-2 1.5v6.5l2 1.5V21H6v-3.5l2-1.5V10L6 8.5z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><g fill="var(--medal-bg)"><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/></g>',
  mountain: '<path d="M2.5 20l7-12 3.5 6 2.5-4 6 10z"/><path d="M8 10.5l1.5-2.5 1.6 2.7z" fill="var(--medal-bg)"/>',
  river:
    '<path d="M3 8c3-2 6 2 9 0s6-2 9 0v3c-3-2-6 2-9 0s-6-2-9 0zM3 14c3-2 6 2 9 0s6-2 9 0v3c-3-2-6 2-9 0s-6-2-9 0z"/>',
  lantern:
    '<path d="M9 3h6v2H9z"/><path d="M7 7h10l-1 11H8z"/><path d="M8 20h8v1.5H8z"/><path d="M12 9.5c1.5 1.5 1.8 3 0 5.5-1.8-2.5-1.5-4 0-5.5z" fill="var(--medal-bg)"/>',
  hand: '<path d="M8 21v-4L4.5 12a1.5 1.5 0 0 1 2.4-1.8L9 12.5V5a1.5 1.5 0 0 1 3 0v5-6.5a1.5 1.5 0 0 1 3 0V10 5a1.5 1.5 0 0 1 3 0v9c0 3.5-2 5-3.5 7z"/>',
  door: '<path d="M6 3.5h12V21H6z"/><circle cx="15" cy="12.5" r="1.2" fill="var(--medal-bg)"/>',
} as const;

export type Glyph = keyof typeof GLYPHS;
