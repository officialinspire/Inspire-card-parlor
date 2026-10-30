/**
 * Checks every registered deck: definition, unlocks, content isolation and
 * that all required card assets (52 faces, back, preview) exist in /public.
 *
 *   npm run validate:decks            # pending decks: missing art is a warning
 *   npm run validate:decks -- --strict  # treat missing art as an error
 *   npm run validate:decks -- --json
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allDecks } from '../src/decks/registry';
import { validateDeckFiles, validateRegistry } from '../src/decks/validation';
import { checkAtlasReport, webpSize, type AtlasReport } from '../src/decks/atlasReport';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const publicDir = join(import.meta.dirname, '..', 'public');

const decks = allDecks();
const reports = await Promise.all(
  validateRegistry(decks).map((r, i) =>
    validateDeckFiles(
      decks[i]!,
      (p) => existsSync(join(publicDir, p)),
      {
        strict,
        readJson: (p) => JSON.parse(readFileSync(join(publicDir, p), 'utf8')),
      },
      r,
    ),
  ),
);

// Decks cut from uploaded sprite sheets also carry atlas.json: 52 distinct,
// correctly ordered cards, and every identity flag reviewed.
for (const r of reports) {
  const deck = decks.find((d) => d.id === r.deckId)!;
  const meta = join(publicDir, deck.assets.basePath, 'atlas.json');
  if (!existsSync(meta)) continue;
  const report = JSON.parse(readFileSync(meta, 'utf8')) as AtlasReport;
  const size = webpSize(readFileSync(join(publicDir, deck.assets.basePath, 'faces.webp')));
  for (const p of checkAtlasReport(report, size)) {
    r.issues.push({ level: 'error', code: `atlas.${p.code}`, message: p.message });
    r.ok = false;
  }
  // Backs are cut from the same sheets: each must be a whole, upright card
  // (a sliver or a half card means the cut went wrong).
  const dir = join(publicDir, deck.assets.basePath);
  for (const file of readdirSync(dir).filter((f) => /^back(_.+)?\.webp$/.test(f))) {
    const { width, height } = webpSize(readFileSync(join(dir, file)));
    const ratio = width / height;
    if (ratio < 0.55 || ratio > 0.85) {
      r.issues.push({
        level: 'error',
        code: 'atlas.back-shape',
        message: `${file} is ${width}×${height} (ratio ${ratio.toFixed(2)}); a card back should be about 5:7.`,
      });
      r.ok = false;
    }
  }
  r.atlas = {
    verifiedFaces: Object.keys(report.frames).length,
    artworkIssues: report.artworkIssues.length,
  };
}

if (args.has('--json')) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  for (const r of reports) {
    const errors = r.issues.filter((i) => i.level === 'error');
    const warnings = r.issues.filter((i) => i.level === 'warning');
    const mark = errors.length ? '✗' : warnings.length ? '•' : '✓';
    console.log(
      `${mark} ${r.deckId.padEnd(24)} ${r.status.padEnd(8)} ${r.requiredFiles.length - r.missingFiles.length}/${r.requiredFiles.length} files` +
        (r.atlas ? `  ${r.atlas.verifiedFaces}/52 faces  ${r.atlas.artworkIssues} artwork notes` : ''),
    );
    for (const i of [...errors, ...warnings])
      console.log(`    ${i.level === 'error' ? 'error  ' : 'warning'} ${i.code}: ${i.message}`);
  }
  const bad = reports.filter((r) => !r.ok).length;
  console.log(`\n${reports.length} decks, ${bad} with errors${strict ? ' (strict)' : ''}.`);
}
process.exit(reports.every((r) => r.ok) ? 0 : 1);
