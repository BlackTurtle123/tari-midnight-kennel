import { VARIANTS, type Canine } from "../shared/game.ts";
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
    !/^[0-5]$/.test(data.variant) ||
    typeof data.incubation_id !== "string" ||
    !/^[a-f0-9]{32}$/.test(data.incubation_id)
  )
    return null;
  const variant = Number(data.variant);
  if (
    typeof data.name !== "string" ||
    data.name !== VARIANTS[variant].name ||
    typeof data.genes !== "string" ||
    !/^[A-F]{8}$/.test(data.genes) ||
    data.generation !== "0"
  )
    return null;
  return {
    id: data.incubation_id,
    variant,
    name: data.name,
    genes: data.genes,
    generation: 0,
    resource,
  };
}
