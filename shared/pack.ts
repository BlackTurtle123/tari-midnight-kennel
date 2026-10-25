import type { Canine, GameState } from './game.ts';
import { parentKey, GENERATIONS } from './canine-rules.ts';
export function packCanines(state: GameState) {
  const entries = new Map<string, { canine: Canine; staked: boolean }>();
  for (const canine of state.canines) entries.set(parentKey(canine), { canine, staked: false });
  for (const canine of state.stakedCanines ?? []) entries.set(parentKey(canine), { canine, staked: true });
  return [...entries.values()];
}
export function fertility(c: Canine, breeding: GameState['breeding']) {
  if (!/^[A-H]{8}$/.test(c.genes) || !GENERATIONS[c.generation]) return 'Breeding unavailable';
  if (c.generation === 7) return 'Sterile · generation O';
  if (!breeding) return 'Fertility unavailable';
  const request = breeding.parents[parentKey(c)];
  if (!request) return 'Fertile';
  const status = breeding.parentStatuses?.[parentKey(c)] ?? breeding.requests.find(r => r.id === request)?.status;
  return status === 0 ? 'Reserved for breeding' : status === 1 ? 'Sterile · already bred' : 'Already bred or reserved';
}
