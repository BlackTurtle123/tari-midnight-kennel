import type { Canine } from "./game.ts";
export const GENERATIONS = ["G", "H", "I", "K", "L", "M", "N", "O"] as const;
export function parentKey(c: Pick<Canine, "resource" | "id">) {
  return `${c.resource}|str_${c.id}`;
}
export function breedingBlock(c: Canine, used: Record<string, string>) {
  if (!/^[A-H]{8}$/.test(c.genes)) return "Unsupported genes";
  if (!Number.isInteger(c.generation) || c.generation < 0 || c.generation >= 7)
    return "Generation O cannot breed";
  if (used[parentKey(c)]) return "Already bred or reserved";
  return undefined;
}
export function childGeneration(a: Canine, b: Canine) {
  if (parentKey(a) === parentKey(b))
    throw new Error("Choose two different canines");
  if (breedingBlock(a, {}) || breedingBlock(b, {}))
    throw new Error("Parents cannot breed");
  return GENERATIONS[Math.max(a.generation, b.generation) + 1];
}
export function rarityGroup(genes: string, generation: number) {
  if (
    !/^[A-H]{8}$/.test(genes) ||
    !Number.isInteger(generation) ||
    !GENERATIONS[generation]
  )
    throw new Error("Invalid canine genotype");
  return (
    "ABCDEFGH"
      .split("")
      .map((g) => {
        const n = [...genes].filter((v) => v === g).length;
        return n ? `${n}${g}` : "";
      })
      .join("") +
    "-" +
    GENERATIONS[generation]
  );
}
export function integerSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("Negative square root");
  if (n < 2n) return n;
  let x = n,
    y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
// Exact Ride integer rounding; wavelets are reference-game units, not a Tari quote.
export function mainGameIncubationPrice(count: bigint, coefficient = 10n) {
  if (count < 0n || coefficient < 0n)
    throw new Error("Invalid supply or coefficient");
  return (
    (integerSqrt((100n + (count * coefficient) / 30n) * 100n) + 55n) *
    1_500_000n
  );
}
export function mainGameFarmPower(input: {
  genes: string;
  groupQuantity: bigint;
  multiplier: bigint;
  cachedBase?: bigint;
  itemBoost?: bigint;
  wearableBoost?: bigint;
  jackpot?: boolean;
}) {
  const {
    genes,
    groupQuantity,
    multiplier,
    cachedBase,
    itemBoost = 0n,
    wearableBoost = 0n,
    jackpot = false,
  } = input;
  if (
    !/^[A-H]{8}$/.test(genes) ||
    groupQuantity <= 0n ||
    multiplier < 0n ||
    itemBoost < 0n ||
    wearableBoost < 0n ||
    (cachedBase ?? 0n) < 0n
  )
    throw new Error("Invalid farming inputs");
  const unique = BigInt(jackpot ? 8 : new Set(genes).size);
  const genePower = (100n * 3n ** unique) / 2n ** unique;
  const basePower =
    cachedBase && cachedBase > 0n
      ? cachedBase
      : (genePower * multiplier) / 100n;
  const rarity = jackpot ? 100n : integerSqrt(10_000n / groupQuantity) || 2n;
  const rarePower = (basePower * rarity) / 100n;
  return {
    genePower,
    basePower,
    rarity,
    fp:
      rarePower +
      (rarePower * itemBoost) / 100n +
      (rarePower * wearableBoost) / 1000n,
  };
}
export const MAIN_GAME_REBIRTH_TABLE = [
  ["Red perch", 100],
  ["Purple perch", 100],
  ["Green perch", 100],
  ["Blue perch", 100],
  ["Duck incubator", 50],
  ["40 ducklings", 40],
  ["20 ducklings", 50],
  ["Feed 5", 100],
  ["Feed 10", 70],
  ["Feed 15", 30],
  ["Feed 20", 30],
  ["Feed 25", 20],
  ["Feed 50", 20],
  ["Feed 100", 20],
  ["Green mutarium", 30],
  ["Dark mutarium", 30],
  ["Free gene", 20],
  ["Fix gene", 20],
  ["Turtle incubator", 50],
  ["Potion", 20],
] as const;
