import type { GoFishPlayer } from '@/games/goFish/GoFishGame';
import { getPersonality } from '@/games/cpu/personalities';

/** You, plus the named opponents, for a Go Fish table. */
export function goFishPlayers(opponents: readonly string[]): GoFishPlayer[] {
  return [{ id: 'you', name: 'You' }, ...opponents.map((id) => ({ id, name: getPersonality(id).name, cpu: id }))];
}
