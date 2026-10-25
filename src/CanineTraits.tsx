import type { Canine, GameState } from '../shared/game';
import { fertility } from '../shared/pack';
export function CanineTraits({ canine, breeding }: { canine: Canine; breeding: GameState['breeding'] }) {
  return <div className="canine-traits"><span className="pill canine-genes" aria-label={`Genes: ${canine.genes}`} title="Genes">{canine.genes}</span><span className="pill">{fertility(canine, breeding)}</span></div>;
}
