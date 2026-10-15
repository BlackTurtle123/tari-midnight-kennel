import { VARIANTS, genotypeFor, COLOR_NAMES, type Canine } from "../shared/game.ts";
// tari_bor Value JSON preserves CBOR tags with this envelope; typed metadata can be bare.
export function parseCanine(raw: unknown, resource: string): Canine | null {
  if (!raw || typeof raw !== "object") return null;
  let data = raw as Record<string, unknown>;
  if (data["@cbor"] === "tag") {
    if (!data.value || typeof data.value !== "object") return null;
    data = data.value as Record<string, unknown>;
  }
  if (
    typeof data.variant !== "string" ||
    !/^[0-3]$/.test(data.variant) ||
    typeof data.incubation_id !== "string" ||
    !/^[a-f0-9]{32}$/.test(data.incubation_id)
  )
    return null;
  const variant = Number(data.variant);
  if (
    typeof data.name !== "string" ||
    data.name !== VARIANTS[variant].name ||
    typeof data.genes !== "string" ||
    data.genes !== VARIANTS[variant].genes ||
    typeof data.color !== "string" || !/^[A-D]$/.test(data.color) ||
    data.genotype !== genotypeFor(data.genes, data.color) ||
    data.art_version !== "waves-canines-v1" ||
    data.generation !== "0"
  )
    return null;
  return {
    id: data.incubation_id,
    variant,
    name: data.name,
    genes: data.genes,
    color: data.color as keyof typeof COLOR_NAMES,
    genotype: data.genotype as string,
    generation: 0,
    resource,
  };
}

// The initial public collection is immutable. Retain its actual genes and names.
export function parseLegacyCanine(raw: unknown, resource: string): Canine | null {
  if (!raw || typeof raw !== "object") return null;
  let data = raw as Record<string, unknown>;
  if (data["@cbor"] === "tag") { if (!data.value || typeof data.value !== "object") return null; data=data.value as Record<string,unknown>; }
  const names=["Pumpkin Pup","Moonlight Howler","Candy Corn Corgi","Boo Beagle","Mummy Mutt","Bat-Eared Bandit"];
  const genes=["AAAABBBB","BBBBAAAA","CCCCAAAA","DDDDBBBB","EEEECCCC","FFFFDDDD"];
  if (typeof data.variant!=="string" || !/^[0-5]$/.test(data.variant)) return null;
  const variant=Number(data.variant);
  if (data.name!==names[variant] || data.genes!==genes[variant] || data.generation!=="0" || typeof data.incubation_id!=="string" || !/^[a-f0-9]{32}$/.test(data.incubation_id)) return null;
  return {id:data.incubation_id,variant,name:names[variant],genes:genes[variant],generation:0,resource,legacy:true};
}
