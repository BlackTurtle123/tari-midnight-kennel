import {
  VARIANTS,
  genotypeFor,
  COLOR_NAMES,
  type Canine,
} from "../shared/game.ts";
import { HALLOWEEN_REWARDS, type HalloweenNFT } from "../shared/rebirth.ts";
export function parseHalloween(
  raw: unknown,
  resource: string,
): HalloweenNFT | null {
  if (!raw || typeof raw !== "object") return null;
  let data = raw as Record<string, unknown>;
  if (data["@cbor"] === "tag") {
    if (!data.value || typeof data.value !== "object") return null;
    data = data.value as Record<string, unknown>;
  }
  if (typeof data.reward !== "string" || !/^[0-5]$/.test(data.reward))
    return null;
  const reward = Number(data.reward),
    spec = HALLOWEEN_REWARDS[reward];
  if (
    data.name !== spec.name ||
    data.original !== spec.original ||
    data.edition !== "tari-halloween-2026" ||
    data.art_version !== "arkimals-halloween-v1" ||
    typeof data.rebirth_id !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.rebirth_id) ||
    typeof data.source_resource !== "string" ||
    !/^resource_[a-f0-9]{64}$/.test(data.source_resource) ||
    typeof data.source_id !== "string" ||
    !/^str_[a-f0-9]{32}(?:[a-f0-9]{32})?$/.test(data.source_id)
  )
    return null;
  return {
    id: data.rebirth_id,
    resource,
    reward,
    name: spec.name,
    original: spec.original,
    sourceResource: data.source_resource,
    sourceId: data.source_id.slice(4),
  };
}
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
    typeof data.color !== "string" ||
    !/^[A-D]$/.test(data.color) ||
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
export function parseLegacyCanine(
  raw: unknown,
  resource: string,
): Canine | null {
  if (!raw || typeof raw !== "object") return null;
  let data = raw as Record<string, unknown>;
  if (data["@cbor"] === "tag") {
    if (!data.value || typeof data.value !== "object") return null;
    data = data.value as Record<string, unknown>;
  }
  const names = [
    "Pumpkin Pup",
    "Moonlight Howler",
    "Candy Corn Corgi",
    "Boo Beagle",
    "Mummy Mutt",
    "Bat-Eared Bandit",
  ];
  const genes = [
    "AAAABBBB",
    "BBBBAAAA",
    "CCCCAAAA",
    "DDDDBBBB",
    "EEEECCCC",
    "FFFFDDDD",
  ];
  if (typeof data.variant !== "string" || !/^[0-5]$/.test(data.variant))
    return null;
  const variant = Number(data.variant);
  if (
    data.name !== names[variant] ||
    data.genes !== genes[variant] ||
    data.generation !== "0" ||
    typeof data.incubation_id !== "string" ||
    !/^[a-f0-9]{32}$/.test(data.incubation_id)
  )
    return null;
  return {
    id: data.incubation_id,
    variant,
    name: names[variant],
    genes: genes[variant],
    generation: 0,
    resource,
    legacy: true,
  };
}

export function parseBredCanine(raw: unknown, resource: string): Canine | null {
  if (!raw || typeof raw !== "object") return null;
  let d = raw as Record<string, unknown>;
  if (d["@cbor"] === "tag") d = d.value as Record<string, unknown>;
  if (
    !d ||
    typeof d.genes !== "string" ||
    !/^[A-H]{8}$/.test(d.genes) ||
    typeof d.generation !== "string" ||
    !/^[1-7]$/.test(d.generation) ||
    typeof d.color !== "string" ||
    !/^[A-D]$/.test(d.color) ||
    typeof d.breeding_id !== "string" ||
    !/^[a-f0-9]{64}$/.test(d.breeding_id) ||
    d.art_version !== "waves-canines-v1" ||
    d.name !== "Arkimals Canine" ||
    d.genotype !==
      `CANI-${d.genes}-${"GHIKLMNO"[Number(d.generation)]}${d.color}`
  )
    return null;
  return {
    id: d.breeding_id,
    resource,
    variant: 0,
    name: d.name,
    genes: d.genes,
    generation: Number(d.generation),
    color: d.color as keyof typeof COLOR_NAMES,
    genotype: d.genotype as string,
  };
}
