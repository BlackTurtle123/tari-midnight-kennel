import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mainGameFarmPower,
  mainGameIncubationPrice,
  rarityGroup,
  integerSqrt,
  childGeneration,
  breedingBlock,
  MAIN_GAME_REBIRTH_TABLE,
} from "../shared/canine-rules.ts";
import { breedingInstructions } from "../shared/breeding.ts";
import { parseBredCanine } from "./nft.ts";
import { readBreeding } from "./external-chain.ts";
const account = "component_" + "01".repeat(32),
  resource = "resource_" + "02".repeat(32);
const config = {
  network: "esmeralda" as const,
  component: "component_" + "03".repeat(32),
  resource: "resource_" + "04".repeat(32),
  current: resource,
  legacy: resource,
  fee: 1_000_000,
  template: "template_" + "05".repeat(32),
  operator: account,
  publicationTx: "",
  creationTx: "",
  createdAt: "",
};
const canine = {
  id: "ab".repeat(16),
  resource,
  variant: 0,
  name: "Canine",
  genes: "EEEEFFFF",
  generation: 0,
};
test("main-game gene rarity ignores ordering but includes generation", () => {
  assert.equal(rarityGroup("EEEEFFFF", 0), "4E4F-G");
  assert.equal(rarityGroup("EFEFEFEF", 0), "4E4F-G");
  assert.equal(rarityGroup("EFEFEFEF", 1), "4E4F-H");
  assert.equal(
    childGeneration(canine, { ...canine, id: "bc".repeat(16), generation: 2 }),
    "K",
  );
  assert.throws(() => childGeneration(canine, canine));
  assert.equal(
    breedingBlock({ ...canine, generation: 7 }, {}),
    "Generation O cannot breed",
  );
  assert.equal(
    MAIN_GAME_REBIRTH_TABLE.reduce((n, [, p]) => n + p, 0),
    1000,
  );
});
test("reference price and FP use Ride's floor order and cached first-stake power", () => {
  assert.equal(mainGameIncubationPrice(0n), 232_500_000n);
  assert.equal(mainGameIncubationPrice(6132n), 777_000_000n);
  assert.equal(
    mainGameFarmPower({
      genes: "ABCDEFGH",
      groupQuantity: 1n,
      multiplier: 100n,
    }).fp,
    2562n,
  );
  assert.equal(
    mainGameFarmPower({
      genes: "EEEEEEEE",
      groupQuantity: 4n,
      multiplier: 100n,
    }).fp,
    75n,
  );
  const p = mainGameFarmPower({
    genes: "EEEEFFFF",
    groupQuantity: 3n,
    multiplier: 999n,
    cachedBase: 225n,
    itemBoost: 10n,
    wearableBoost: 150n,
  });
  assert.deepEqual(p, {
    genePower: 225n,
    basePower: 225n,
    rarity: 57n,
    fp: 159n,
  });
  assert.equal(
    mainGameFarmPower({
      genes: "EEEEEEEE",
      groupQuantity: 10001n,
      multiplier: 100n,
    }).rarity,
    2n,
  );
  assert.throws(() =>
    mainGameFarmPower({
      genes: "EEEEEEEE",
      groupQuantity: 0n,
      multiplier: 100n,
    }),
  );
  for (const n of [0n, 1n, 2n, 99n, 100n, 101n, 2n ** 200n]) {
    const s = integerSqrt(n);
    assert.ok(s * s <= n && (s + 1n) * (s + 1n) > n);
  }
});
test("breeding instructions reject forged resources, duplicate parents and invalid fees; preserve both NFT buckets", () => {
  const a = { resource, id: "ab".repeat(16) },
    b = { resource: config.resource, id: "cd".repeat(32) };
  const instructions = breedingInstructions(config, account, {
    kind: "breed",
    first: a,
    second: b,
  });
  assert.equal(instructions.length, 7);
  assert.deepEqual(
    (instructions[6] as any).CallMethod.args.slice(0, 3),
    [0, 1, 2].map((id) => ({ Workspace: { id, offset: null } })),
  );
  assert.throws(() =>
    breedingInstructions(config, account, {
      kind: "breed",
      first: a,
      second: a,
    }),
  );
  assert.throws(() =>
    breedingInstructions(config, account, {
      kind: "breed",
      first: a,
      second: { ...b, resource: "resource_" + "ff".repeat(32) },
    }),
  );
  assert.throws(() =>
    breedingInstructions({ ...config, fee: NaN }, account, {
      kind: "breed",
      first: a,
      second: b,
    }),
  );
});
test("mixed offspring metadata validates generation, colour, genome and origin id", () => {
  const data = {
    name: "Arkimals Canine",
    genes: "EFEFEFEF",
    generation: "1",
    color: "B",
    genotype: "CANI-EFEFEFEF-HB",
    art_version: "waves-canines-v1",
    breeding_id: "cd".repeat(32),
  };
  assert.equal(parseBredCanine(data, config.resource)?.genes, "EFEFEFEF");
  assert.equal(
    parseBredCanine({ ...data, genotype: "CANI-EEEEEEEE-GB" }, config.resource),
    null,
  );
  assert.equal(
    parseBredCanine({ ...data, generation: "8" }, config.resource),
    null,
  );
});
test("breeding reader binds verified component schema to resource, fee, template and recipient", () => {
  const addr = (tag: number, value: string) => ({
    "@cbor": "tag",
    tag,
    value: { "@cbor": "bytes", hex: value.split("_")[1] },
  });
  const parent = [addr(131, resource), [1, ["ab".repeat(16)]], "EEEEEEEE", 0];
  const id = "cd".repeat(32);
  const raw = {
    header: { template_address: config.template.slice(9) },
    body: {
      state: [
        addr(131, config.resource),
        {},
        addr(128, account),
        1_000_000,
        {},
        {
          [id]: [
            { "@cbor": "bytes", hex: "ab".repeat(32) },
            addr(128, account),
            parent,
            parent,
            12,
            0,
          ],
        },
        {},
        { "12": "hash" },
        0,
      ],
    },
  };
  const state = readBreeding(raw, config, 13, account);
  assert.equal(state.requests[0].captured, true);
  assert.equal(state.requests[0].targetEpoch, 12);
  assert.equal(
    readBreeding(raw, config, 13, config.component).requests.length,
    0,
  );
  assert.throws(() => readBreeding(raw, { ...config, fee: 999 }, 13));
  assert.throws(() => readBreeding(raw, { ...config, resource }, 13));
});
