import { simulateWar } from '../../src/story/verify';
const out: string[] = [];
for (let seed = 2001; seed < 2400 && out.length < 12; seed++) {
  const r = simulateWar(seed);
  if (r.status === 'won' && r.rounds < 260) out.push(`${seed}:${r.rounds}`);
}
console.log(out.join(' '));
