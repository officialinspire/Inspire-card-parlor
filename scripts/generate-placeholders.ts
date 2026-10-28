/**
 * Writes placeholder card assets and per-deck upload instructions.
 *
 *   public/assets/cards/_placeholder/faces.svg   13×5 template sheet (52 faces + back)
 *   public/assets/cards/_placeholder/faces.json  matching TexturePacker-style frames
 *   public/assets/cards/_placeholder/preview.svg
 *   public/assets/cards/<deck>/README.md         what to upload for that deck
 *
 * The template is deliberately plain and labelled PLACEHOLDER: it documents
 * the layout for artists and exercises the sprite-sheet pipeline. It is not
 * deck artwork and never replaces commissioned art.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RANKS, RANK_CODE, SUITS, SUIT_SYMBOL, cardCode } from '../src/engine/Card';
import { allDecks } from '../src/decks/registry';
import { validateDeckDefinition } from '../src/decks/validation';

const root = join(import.meta.dirname, '..', 'public');
const CELL_W = 120;
const CELL_H = 168;
const COLS = 13;
const ROWS = 5;
const W = CELL_W * COLS;
const H = CELL_H * ROWS;

const red = (s: string) => s === 'hearts' || s === 'diamonds';
const cell = (col: number, row: number, body: string) =>
  `<g transform="translate(${col * CELL_W} ${row * CELL_H})">
    <rect x="4" y="4" width="${CELL_W - 8}" height="${CELL_H - 8}" rx="10" fill="#f7f4ee" stroke="#9a948a" stroke-width="2" stroke-dasharray="6 4"/>
    ${body}
  </g>`;

const faces: string[] = [];
const frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
SUITS.forEach((suit, row) =>
  RANKS.forEach((rank, col) => {
    const ink = red(suit) ? '#b5473a' : '#3a3632';
    faces.push(
      cell(
        col,
        row,
        `<text x="16" y="34" font-family="sans-serif" font-size="22" font-weight="700" fill="${ink}">${RANK_CODE[rank]}</text>
    <text x="${CELL_W / 2}" y="${CELL_H / 2 + 14}" text-anchor="middle" font-family="sans-serif" font-size="44" fill="${ink}">${SUIT_SYMBOL[suit]}</text>
    <text x="${CELL_W / 2}" y="${CELL_H - 18}" text-anchor="middle" font-family="monospace" font-size="11" fill="#9a948a">${cardCode(rank, suit)}</text>`,
      ),
    );
    frames[cardCode(rank, suit)] = { frame: { x: col * CELL_W, y: row * CELL_H, w: CELL_W, h: CELL_H } };
  }),
);
faces.push(
  cell(
    0,
    4,
    `<rect x="14" y="14" width="${CELL_W - 28}" height="${CELL_H - 28}" rx="6" fill="#d9d4ca"/>
    <text x="${CELL_W / 2}" y="${CELL_H / 2 + 6}" text-anchor="middle" font-family="monospace" font-size="14" fill="#6d675e">BACK</text>`,
  ),
);
frames.back = { frame: { x: 0, y: 4 * CELL_H, w: CELL_W, h: CELL_H } };
// Label the spare cells so the layout is self-explanatory.
for (let c = 1; c < COLS; c++) {
  faces.push(
    cell(
      c,
      4,
      `<text x="${CELL_W / 2}" y="${CELL_H / 2}" text-anchor="middle" font-family="monospace" font-size="11" fill="#b9b3a8">unused</text>`,
    ),
  );
}

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- PLACEHOLDER template: rows ♠ ♥ ♦ ♣, columns A…K, back at row 5 column 1. Not deck artwork. -->
  <rect width="${W}" height="${H}" fill="#ebe7df"/>
  ${faces.join('\n  ')}
</svg>
`;

const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <rect width="480" height="320" fill="#ebe7df"/>
  ${[-14, -5, 5, 14]
    .map(
      (r, i) =>
        `<rect x="${150 + i * 34}" y="70" width="120" height="168" rx="10" fill="#f7f4ee" stroke="#9a948a" stroke-width="2" stroke-dasharray="6 4" transform="rotate(${r} ${210 + i * 34} 154)"/>`,
    )
    .join('\n  ')}
  <text x="240" y="290" text-anchor="middle" font-family="monospace" font-size="16" fill="#6d675e">PLACEHOLDER PREVIEW</text>
</svg>
`;

const dir = join(root, 'assets/cards/_placeholder');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'faces.svg'), sheet);
writeFileSync(join(dir, 'preview.svg'), preview);
writeFileSync(
  join(dir, 'faces.json'),
  JSON.stringify(
    { frames, meta: { image: 'faces.svg', size: { w: W, h: H }, note: 'PLACEHOLDER template' } },
    null,
    2,
  ) + '\n',
);

for (const deck of allDecks()) {
  const report = validateDeckDefinition(deck);
  const deckDir = join(root, deck.assets.basePath);
  mkdirSync(deckDir, { recursive: true });
  const faces = deck.assets.faces;
  const layout =
    faces.type === 'atlas'
      ? `One sprite sheet, \`${faces.image.path}.webp\` (PNG accepted as a fallback). ${
          faces.grid
            ? `Grid of ${faces.grid.columns} columns × ${faces.grid.rows} rows: columns A, 2 … 10, J, Q, K; rows ♠ ♥ ♦ ♣. Any cell size works; all cells must be equal.`
            : 'Frames are listed in the atlas metadata.'
        }`
      : `One image per card: \`${faces.pattern}\` where {code} is AS, 2S … 10H, JD, QC, KS.`;
  writeFileSync(
    join(deckDir, 'README.md'),
    `# ${deck.name} — artwork drop folder

Status: **${deck.assets.status}**${deck.contentRating === 'mature' ? ' · **Mature (18+)**: isolated folder, hidden unless the player opts in.' : ''}

Upload the commissioned artwork for this deck here, then set \`assets.status\` to \`'ready'\`
and fill in \`artist\` in \`src/decks/definitions/${deck.id}.ts\`.

## Card faces

${layout}

## Required files

${report.requiredFiles.map((f) => `- ${f.purpose}: ${f.candidates.map((c) => '`' + c.replace(deck.assets.basePath, '') + '`').join(' or ')}`).join('\n')}

Check with \`npm run validate:decks\`. See \`public/assets/cards/README.md\` for other layouts
(individual images, explicit frames, TexturePacker JSON) and alternate artwork.
`,
  );
}
console.log(`Wrote placeholder template (${W}×${H}) and ${allDecks().length} deck READMEs.`);
