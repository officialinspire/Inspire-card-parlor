/** Finds solitaire seeds the solver can prove winnable. npx tsx scripts/story/find-seeds.ts */
import { KlondikeGame } from '../../src/games/solitaire/KlondikeGame';
import { FreeCellGame } from '../../src/games/solitaire/FreeCellGame';
import { SpiderGame } from '../../src/games/solitaire/SpiderGame';
import { solve, replay } from '../../src/games/solitaire/solver';

const which = process.argv[2] ?? 'all';
const tries: [string, (seed: number) => any][] = [
  ['klondike1', (s) => KlondikeGame.create({ seed: s, draw: 1 })],
  ['klondike3', (s) => KlondikeGame.create({ seed: s, draw: 3 })],
  ['freecell', (s) => FreeCellGame.create({ seed: s })],
  ['spider1', (s) => SpiderGame.create({ seed: s, suits: 1 })],
  ['spider2', (s) => SpiderGame.create({ seed: s, suits: 2 })],
];
for (const [name, make] of tries) {
  if (which !== 'all' && which !== name) continue;
  const found: string[] = [];
  let tried = 0;
  for (let seed = 1001; seed < 1001 + 40 && found.length < 8; seed++) {
    tried++;
    const t = Date.now();
    const r = solve(make(seed), 150_000);
    const ok = r.solved && replay(make(seed), r.line);
    if (ok) found.push(`${seed}(${r.line.length}st,${r.nodes}n,${Date.now() - t}ms)`);
  }
  console.log(name, `solved ${found.length}/${tried}:`, found.join(' '));
}
