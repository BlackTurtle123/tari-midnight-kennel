import { z } from "zod";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
// Integer-keyed CBOR maps use an explicit envelope once nonempty. Empty maps
// arrive as {}; accept both without confusing an envelope with its entries.
export function readEpochHashes(raw: unknown): Record<string, string> {
  const pairs: [string | number, string][] =
    raw && typeof raw === "object" && (raw as any)["@cbor"] === "map"
      ? z
          .object({
            "@cbor": z.literal("map"),
            entries: z.array(
              z.tuple([z.number().int().nonnegative().safe(), hash]),
            ),
          })
          .strict()
          .parse(raw).entries
      : Object.entries(z.record(hash).parse(raw));
  const result: Record<string, string> = Object.create(null);
  for (const [epoch, value] of pairs) {
    const key = String(epoch);
    if (
      !/^(0|[1-9]\d*)$/.test(key) ||
      !Number.isSafeInteger(Number(key)) ||
      Object.hasOwn(result, key)
    )
      throw new Error("Invalid or duplicate captured epoch");
    result[key] = value;
  }
  return result;
}
