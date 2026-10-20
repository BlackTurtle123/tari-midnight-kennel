import { IndexerProvider } from "@tari-project/ootle-indexer";
import { Network, getVaultIdsForAccount } from "@tari-project/ootle";
import { parseOotleAddress } from "@tari-project/ootle-wasm";
import { z } from "zod";
import {
  deployment,
  legacyResource,
  rebirthDeployment,
  breedingDeployment,
  TARI_RESOURCE,
} from "./config.ts";
import {
  parseCanine,
  parseLegacyCanine,
  parseHalloween,
  parseBredCanine,
} from "./nft.ts";
import type { HalloweenNFT } from "../shared/rebirth.ts";
import type { Canine } from "../shared/game.ts";

const hex = z.string().regex(/^[a-f0-9]{64}$/);
const bytes = z.object({ "@cbor": z.literal("bytes"), hex });
const address = (tag: number) =>
  z.object({ "@cbor": z.literal("tag"), tag: z.literal(tag), value: bytes });
const entry = z.tuple([
  bytes,
  address(128),
  z.number().int().min(0).max(2),
  z.string().regex(/^(?:[a-f0-9]{64})?$/),
  z.boolean(),
]);
export interface ChainIncubation {
  id: string;
  signer: string;
  owner: string;
  door: number;
  commitment: string;
  hatched: boolean;
}
export function readGame(
  raw: unknown,
  template: string,
  resource: string,
): ChainIncubation[] {
  const c = z
    .object({
      header: z.object({
        template_address: z.literal(template.replace(/^template_/, "")),
      }),
      body: z.object({
        state: z.tuple([
          address(131),
          bytes,
          z.record(entry),
          z.unknown(),
          z.number(),
          z.number(),
        ]),
      }),
    })
    .parse(raw);
  if ("resource_" + c.body.state[0].value.hex !== resource)
    throw new Error("Unexpected game resource");
  return Object.entries(c.body.state[2]).map(([id, r]) => ({
    id,
    signer: r[0].hex,
    owner: "component_" + r[1].value.hex,
    door: r[2],
    commitment: r[3],
    hatched: r[4],
  }));
}
export function addressOwner(paymentAddress: string) {
  const parsed = parseOotleAddress(paymentAddress);
  try {
    if (parsed.network !== 0x26 || !parsed.view_key)
      throw new Error("Use an Esmeralda wallet with a private view key");
    return Buffer.from(parsed.owner_key).toString("hex");
  } finally {
    parsed.free();
  }
}
export function checkAccount(raw: unknown, expectedOwner: string) {
  z.object({
    header: z.object({
      template_address: z.literal("0".repeat(64)),
      owner_rule: z.object({ ByPublicKey: z.literal(expectedOwner) }),
    }),
  }).parse(raw);
}
export function liveSubstate(
  r: import("@tari-project/ootle-ts-bindings").IndexerGetSubstateResponse,
) {
  if (!r.verified || !("up" in r.state))
    throw new Error(
      "A verified live substate is not available yet. Try again after the network confirms it.",
    );
  return { substate: r.state.up.substate };
}
let provider: Promise<IndexerProvider> | undefined;
async function indexer() {
  return (provider ??= IndexerProvider.connect({
    url: "https://ootle-indexer-a.tari.com",
    network: Network.Esmeralda,
  }).catch((e) => {
    provider = undefined;
    throw e;
  }));
}
export async function chainIncubations() {
  const d = deployment();
  const r = liveSubstate(await (await indexer()).getSubstate(d.component));
  if (!("Component" in r.substate))
    throw new Error("Game component unavailable");
  return readGame(r.substate.Component, d.template, d.resource);
}
export async function validateExternalAccount(
  account: string,
  paymentAddress: string,
) {
  const owner = addressOwner(paymentAddress);
  let r;
  try {
    r = liveSubstate(await (await indexer()).getSubstate(account));
  } catch {
    throw new Error(
      "Your account is not available on Esmeralda yet. Fund and activate it in Sapient first (receive test Tari, then unshield a small fee reserve in the wallet).",
    );
  }
  if (!("Component" in r.substate))
    throw new Error("Wallet account is not a component");
  checkAccount(r.substate.Component, owner);
  return owner;
}
export async function publicInventory(
  account: string,
): Promise<{ canines: Canine[]; halloween: HalloweenNFT[]; balance: string }> {
  const p = await indexer(),
    d = deployment();
  const r = liveSubstate(await p.getSubstate(account));
  if (!("Component" in r.substate))
    throw new Error("Wallet account unavailable");
  const vaults = await getVaultIdsForAccount(
    p,
    account as `component_${string}`,
  );
  if (vaults.length > 100)
    throw new Error("This wallet has too many vaults for the PoC reader");
  const canines: Canine[] = [];
  const halloween: HalloweenNFT[] = [],
    rebirth = rebirthDeployment();
  let balance = 0n;
  for (const id of vaults) {
    const v = liveSubstate(await p.getSubstate(id));
    if (!("Vault" in v.substate)) throw new Error("Wallet vault unavailable");
    const c = v.substate.Vault.resource_container;
    if ("Stealth" in c && c.Stealth.address === TARI_RESOURCE)
      balance += BigInt(c.Stealth.revealed_amount);
    if (
      !("NonFungible" in c) ||
      ![
        d.resource,
        legacyResource(),
        rebirth?.resource,
        breedingDeployment()?.resource,
      ].includes(c.NonFungible.address)
    )
      continue;
    if (c.NonFungible.token_ids.length > 100)
      throw new Error("Unexpected canine supply");
    for (const token of c.NonFungible.token_ids) {
      if (
        !("String" in token) ||
        !/^[a-f0-9]{32}(?:[a-f0-9]{32})?$/.test(token.String)
      )
        continue;
      const resource = c.NonFungible.address;
      const nft = liveSubstate(
        await p.getSubstate(`nft_${resource.slice(9)}_str_${token.String}`),
      );
      if (!("NonFungible" in nft.substate) || !nft.substate.NonFungible)
        continue;
      if (resource === rebirth?.resource) {
        const reward = parseHalloween(nft.substate.NonFungible.data, resource);
        if (reward && reward.id === token.String) halloween.push(reward);
        continue;
      }
      const canine =
        resource === breedingDeployment()?.resource
          ? parseBredCanine(nft.substate.NonFungible.data, resource)
          : resource === d.resource
            ? parseCanine(nft.substate.NonFungible.data, resource)
            : parseLegacyCanine(nft.substate.NonFungible.data, resource);
      if (canine && canine.id === token.String) canines.push(canine);
    }
  }
  return {
    canines,
    halloween,
    balance: (Number(balance) / 1_000_000).toFixed(3),
  };
}

function cborInteger(v: unknown): bigint {
  if (typeof v === "number" && Number.isSafeInteger(v)) return BigInt(v);
  if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v);
  const x = v as any;
  if (x?.["@cbor"] === "tag" && x.tag === 2 && x.value?.["@cbor"] === "bytes")
    return BigInt("0x" + x.value.hex);
  throw new Error("Unsupported on-chain integer");
}
export async function economySnapshot(
  account?: string,
): Promise<import("../shared/rebirth.ts").EconomyState | undefined> {
  const config = rebirthDeployment();
  if (!config) return undefined;
  const p = await indexer();
  const [r, s, epoch] = await Promise.all([
    p.getSubstate(config.component),
    p.getSubstate(config.staking),
    p.getCurrentEpoch(),
  ]);
  const rb = liveSubstate(r).substate,
    st = liveSubstate(s).substate;
  if (!("Component" in rb) || !("Component" in st))
    throw new Error("Economy components unavailable");
  const a = (rb.Component.body as any).state,
    b = (st.Component.body as any).state;
  if (
    !Array.isArray(a) ||
    a.length !== 9 ||
    !Array.isArray(b) ||
    b.length !== 8 ||
    "resource_" + a[0]?.value?.hex !== config.resource ||
    "component_" + a[2]?.value?.hex !== config.staking ||
    Number(a[4]) !== config.fee
  )
    throw new Error("Unexpected economy deployment state");
  const recipient = (v: any) => "component_" + v?.value?.hex;
  const idText = (v: any) => {
    if (!Array.isArray(v) || v[0] !== 1 || typeof v[1]?.[0] !== "string")
      throw new Error("Unexpected NFT id");
    return v[1][0];
  };
  const requests = Object.entries(a[6])
    .filter(([, v]: any) => !account || recipient(v[1]) === account)
    .map(([id, v]: any) => ({
      id,
      resource: "resource_" + v[2].value.hex,
      token: idText(v[3]),
      targetEpoch: Number(v[4]),
      status: Number(v[5]),
      reward: Number(v[6]),
      captured: Object.prototype.hasOwnProperty.call(a[7], String(v[4])),
    }));
  const index = cborInteger(b[4]);
  const stakes = Object.entries(b[3])
    .filter(([, v]: any) => !account || recipient(v[1]) === account)
    .map(([id, v]: any) => ({
      id,
      resource: "resource_" + v[2].value.hex,
      token: idText(v[3]),
      claimable: (
        (index - cborInteger(v[4]) + cborInteger(v[5])) /
        1_000_000_000_000n
      ).toString(),
    }));
  return {
    epoch,
    requests,
    stakes,
    totalStaked: Object.keys(b[3]).length,
    distributed: String(b[5]),
    claimed: String(b[6]),
    emptyPoolFees: String(b[7]),
  };
}

export function readBreeding(
  raw: unknown,
  config: ReturnType<typeof breedingDeployment> & {},
  epoch: number,
  account?: string,
): import("../shared/breeding.ts").BreedingState {
  const c = z
    .object({
      header: z.object({
        template_address: z.literal(config.template.replace(/^template_/, "")),
      }),
      body: z.object({
        state: z.tuple([
          address(131),
          z.unknown(),
          address(128),
          z.literal(config.fee),
          z.unknown(),
          z.record(
            z.tuple([
              bytes,
              address(128),
              z.tuple([
                address(131),
                z.tuple([
                  z.literal(1),
                  z.tuple([
                    z.string().regex(/^[a-f0-9]{32}(?:[a-f0-9]{32})?$/),
                  ]),
                ]),
                z.string().regex(/^[A-H]{8}$/),
                z.number().int().min(0).max(6),
              ]),
              z.tuple([
                address(131),
                z.tuple([
                  z.literal(1),
                  z.tuple([
                    z.string().regex(/^[a-f0-9]{32}(?:[a-f0-9]{32})?$/),
                  ]),
                ]),
                z.string().regex(/^[A-H]{8}$/),
                z.number().int().min(0).max(6),
              ]),
              z.number().int().nonnegative(),
              z.number().int().min(0).max(2),
            ]),
          ),
          z.record(z.string().regex(/^[a-f0-9]{64}$/)),
          z.record(z.string()),
          z.number().int().nonnegative(),
        ]),
      }),
    })
    .parse(raw);
  const a = c.body.state;
  if ("resource_" + a[0].value.hex !== config.resource)
    throw new Error("Unexpected breeding resource");
  return {
    epoch,
    parents: a[6],
    minted: a[8],
    requests: Object.entries(a[5])
      .filter(([, v]) => !account || "component_" + v[1].value.hex === account)
      .map(([id, v]) => ({
        id,
        first: { resource: "resource_" + v[2][0].value.hex, id: v[2][1][1][0] },
        second: {
          resource: "resource_" + v[3][0].value.hex,
          id: v[3][1][1][0],
        },
        targetEpoch: v[4],
        status: v[5],
        captured: Object.hasOwn(a[7], String(v[4])),
      })),
  };
}
export async function breedingSnapshot(account?: string) {
  const d = breedingDeployment();
  if (!d) return undefined;
  const p = await indexer();
  const [r, epoch] = await Promise.all([
    p.getSubstate(d.component),
    p.getCurrentEpoch(),
  ]);
  const s = liveSubstate(r).substate;
  if (!("Component" in s)) throw new Error("Breeding component unavailable");
  return readBreeding(s.Component, d, epoch, account);
}
