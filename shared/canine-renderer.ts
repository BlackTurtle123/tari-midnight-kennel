export function renderCanine(genes: string, parts: Record<string, string>, styles: Record<string, string>): string {
  if (!/^[A-H]{8}$/.test(genes)) throw new Error("Invalid canine genome");
  const layers: [string, number][] = [["tail",7],["left-wing",5],["body",4],["head",4],["accessories",4],["eyes",2],["beak",3],["on-head",0],["right-wing",6],["eyebrows",1]];
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 510.24 595.28"><style>${[...new Set(genes)].map(g=>styles[`CANI-${g}.css`]).join("\n")}</style>${layers.map(([part,index])=>parts[`${part}/${genes[index]}.svg`]).join("\n")}</svg>`;
}
