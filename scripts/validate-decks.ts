/**
 * Checks every registered deck: definition, unlocks, content isolation and
 * that all required card assets (52 faces, back, preview) exist in /public.
 *
 *   npm run validate:decks            # pending decks: missing art is a warning
 *   npm run validate:decks -- --strict  # treat missing art as an error
 *   npm run validate:decks -- --json
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allDecks } from '../src/decks/registry';
import { validateDeckFiles, validateRegistry } from '../src/decks/validation';

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

if (args.has('--json')) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  for (const r of reports) {
    const errors = r.issues.filter((i) => i.level === 'error');
    const warnings = r.issues.filter((i) => i.level === 'warning');
    const mark = errors.length ? '✗' : warnings.length ? '•' : '✓';
    console.log(
      `${mark} ${r.deckId.padEnd(22)} ${r.status.padEnd(8)} ${r.requiredFiles.length - r.missingFiles.length}/${r.requiredFiles.length} files`,
    );
    for (const i of [...errors, ...warnings])
      console.log(`    ${i.level === 'error' ? 'error  ' : 'warning'} ${i.code}: ${i.message}`);
  }
  const bad = reports.filter((r) => !r.ok).length;
  console.log(`\n${reports.length} decks, ${bad} with errors${strict ? ' (strict)' : ''}.`);
}
process.exit(reports.every((r) => r.ok) ? 0 : 1);
