import type { Canine, GameState } from '../shared/game';
import { fertility } from '../shared/pack';
export function CanineTraits({ canine, breeding }: { canine: Canine; breeding: GameState['breeding'] }) {
  return <div className="canine-traits"><span className="canine-genes"><small>Genes</small><strong>{canine.genes}</strong></span><span className="pill">{fertility(canine, breeding)}</span></div>;
}
