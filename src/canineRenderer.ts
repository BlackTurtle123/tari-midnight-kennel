import { renderCanine } from "../shared/canine-renderer";
// Same gene indices and painter order as the main game's AnimalImageGenerator.
const parts = import.meta.glob("./assets/canines/*/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const styles = import.meta.glob("./assets/canines/*.css", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const relative = (entries: Record<string,string>) => Object.fromEntries(Object.entries(entries).map(([key,value]) => [key.replace("./assets/canines/", ""),value]));
const layers = relative(parts), palettes = relative(styles);
export const canineSvg = (genes: string) => renderCanine(genes, layers, palettes);
