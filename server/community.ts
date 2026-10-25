import { IndexerProvider } from "@tari-project/ootle-indexer";
import { Network, iterVaultIdsInState } from "@tari-project/ootle";
import { z } from "zod";
import {
  deployment, legacyDeployment, breedingDeployment,
  rebirthDeployment, offspringRebirthDeployment, unifiedRebirthDeployment,
} from "./config.ts";
import { liveSubstate } from "./external-chain.ts";
import { parseCanine, parseLegacyCanine, parseBredCanine, parseHalloween } from "./nft.ts";
import type { Farm, FarmNFT, FarmView, Ranking } from "../shared/community.ts";
import type { SubstateValue } from "@tari-project/ootle-ts-bindings";

const accountId = z.string().regex(/^component_[a-f0-9]{64}$/);
const tokenId = z.string().regex(/^[a-f0-9]{32}(?:[a-f0-9]{32})?$/);
const bytes = z.object({ "@cbor": z.literal("bytes"), hex: z.string().regex(/^[a-f0-9]{64}$/) });
const address = (tag: number) => z.object({ "@cbor": z.literal("tag"), tag: z.literal(tag), value: bytes });
const token = z.tuple([z.literal(1), z.tuple([tokenId])]);
const recipient = (v: unknown) => "component_" + address(128).parse(v).value.hex;
const resource = (v: unknown) => "resource_" + address(131).parse(v).value.hex;
const key = (r: string, id: string) => `${r}/${id}`;

type Contract = { component: string; template: string; kind: "incubator" | "staking" | "rebirth" | "breeding" };
export interface CommunityConfig {
  collections: { resource: string; kind: "canine" | "legacy" | "bred" | "halloween" }[];
  contracts: Contract[];
}
export function communityConfig(): CommunityConfig {
  const current = deployment(), legacy = legacyDeployment(), bred = breedingDeployment();
  const economies = [rebirthDeployment(), offspringRebirthDeployment(), unifiedRebirthDeployment()].filter(c => !!c);
  return {
    collections: [
      { resource: current.resource, kind: "canine" },
      ...(legacy ? [{ resource: legacy.resource, kind: "legacy" as const }] : []),
      ...(bred ? [{ resource: bred.resource, kind: "bred" as const }] : []),
      ...economies.map(c => ({ resource: c.resource, kind: "halloween" as const })),
    ],
    contracts: [
      { ...current, kind: "incubator" },
      ...(legacy ? [{ ...legacy, kind: "incubator" as const }] : []),
      ...(bred ? [{ ...bred, kind: "breeding" as const }] : []),
      ...economies.flatMap(c => [
        { component: c.component, template: c.template, kind: "rebirth" as const },
        // Staking addresses are pinned in the validated deployment descriptor.
        { component: c.staking, template: "", kind: "staking" as const },
      ]),
    ],
  };
}
export type ReadSubstate = (id: string) => Promise<SubstateValue>;
type Escrow = { account: string; resource: string; id: string; status: "staked" | "breeding" | "rebirth"; component: string };
export interface CommunitySnapshot { updatedAt: string; farms: Farm[] }

/** Enumerate participants from public contract records, never hosted-wallet journals.
 * Ownership comes from current vaults; a mint record is only a discovery hint.
 */
export async function readCommunity(
  config: CommunityConfig,
  read: ReadSubstate,
  extraAccounts: string[] = [],
): Promise<CommunitySnapshot> {
  const memo = new Map<string, Promise<SubstateValue>>();
  const get = (id: string) => {
    let pending = memo.get(id);
    if (!pending) { pending = read(id); memo.set(id, pending); }
    return pending;
  };
  const components = new Map<string, Extract<SubstateValue, { Component: unknown }>["Component"]>();
  async function component(id: string) {
    if (components.has(id)) return components.get(id)!;
    const s = await get(id);
    if (!("Component" in s)) throw new Error("Public farm component unavailable");
    components.set(id, s.Component);
    return s.Component;
  }
  const accounts = new Set(extraAccounts.map(a => accountId.parse(a)));
  const escrow: Escrow[] = [];
  const add = (owner: unknown, r: unknown, t: unknown, status: Escrow["status"], c: string) => {
    const account = recipient(owner);
    accounts.add(account);
    escrow.push({ account, resource: resource(r), id: token.parse(t)[1][0], status, component: c });
  };
  for (const c of new Map(config.contracts.map(c => [c.component, c])).values()) {
    const value = await component(c.component);
    if (c.template && value.header.template_address !== c.template.replace(/^template_/, ""))
      throw new Error("Unexpected public game template");
    const a = z.array(z.unknown()).parse(value.body.state);
    if (c.kind === "incubator") {
      for (const v of Object.values(z.record(z.string(), z.array(z.unknown()).min(2)).parse(a[2])))
        accounts.add(recipient(v[1]));
    } else if (c.kind === "staking") {
      for (const v of Object.values(z.record(z.string(), z.array(z.unknown()).length(6)).parse(a[3])))
        add(v[1], v[2], v[3], "staked", c.component);
    } else if (c.kind === "rebirth") {
      for (const v of Object.values(z.record(z.string(), z.array(z.unknown()).length(7)).parse(a[6]))) {
        accounts.add(recipient(v[1]));
        if (z.number().int().min(0).max(2).parse(v[5]) === 0)
          add(v[1], v[2], v[3], "rebirth", c.component);
      }
    } else {
      for (const v of Object.values(z.record(z.string(), z.array(z.unknown()).length(6)).parse(a[5]))) {
        accounts.add(recipient(v[1]));
        if (z.number().int().min(0).max(2).parse(v[5]) !== 0) continue;
        for (const parent of [v[2], v[3]]) {
          const p = z.array(z.unknown()).length(4).parse(parent);
          add(v[1], p[0], p[1], "breeding", c.component);
        }
      }
    }
  }
  if (accounts.size > 1000) throw new Error("Public farm directory needs a larger index");
  const collections = new Map(config.collections.map(c => [c.resource, c.kind]));
  const holdings = new Map<string, Promise<Map<string, { resource: string; id: string }>>>();
  function inventory(id: string) {
    let pending = holdings.get(id);
    if (!pending) {
      pending = (async () => {
        const c = await component(id);
        const vaults = [...iterVaultIdsInState(c.body.state)];
        if (vaults.length > 100) throw new Error("Public farm inventory is too large");
        const held = new Map<string, { resource: string; id: string }>();
        for (const vault of vaults) {
          const v = await get(vault);
          if (!("Vault" in v)) throw new Error("Public farm vault unavailable");
          const container = v.Vault.resource_container;
          if (!("NonFungible" in container)) continue;
          const nft = container.NonFungible;
          if (!collections.has(nft.address)) continue;
          // Locked proof tokens remain owned by the same vault.
          for (const t of [...nft.token_ids, ...nft.locked_token_ids]) {
            if (!("String" in t)) throw new Error("Unexpected game NFT identifier");
            const id = tokenId.parse(t.String);
            held.set(key(nft.address, id), { resource: nft.address, id });
          }
        }
        if (held.size > 3000) throw new Error("Public farm collection is too large");
        return held;
      })();
      holdings.set(id, pending);
    }
    return pending;
  }
  const parseNFT = async (r: string, id: string, status: FarmNFT["status"]): Promise<FarmNFT> => {
    const s = await get(`nft_${r.slice(9)}_str_${id}`);
    if (!("NonFungible" in s) || !s.NonFungible) throw new Error("NFT changed while reading the farms; try again");
    const kind = collections.get(r), raw = s.NonFungible.data;
    if (kind === "halloween") {
      const nft = parseHalloween(raw, r);
      if (!nft || nft.id !== id || status !== "wallet") throw new Error("Unexpected Halloween NFT");
      return { kind: "halloween", status, nft };
    }
    const nft = kind === "bred" ? parseBredCanine(raw, r) : kind === "legacy" ? parseLegacyCanine(raw, r) : parseCanine(raw, r);
    if (!nft || nft.id !== id) throw new Error("Unexpected canine NFT");
    return { kind: "canine", status, nft };
  };
  const owners = new Map<string, string>();
  const farms: Farm[] = [];
  // Bounded concurrency avoids turning a directory refresh into an indexer burst.
  const remaining = [...accounts].sort();
  await Promise.all(Array.from({ length: Math.min(4, remaining.length) }, async () => {
    while (remaining.length) {
      const account = remaining.shift()!;
      const c = await component(account);
      if (c.header.template_address !== "0".repeat(64)) continue;
      const items = new Map<string, FarmNFT>();
      const put = (n: FarmNFT) => {
        const id = key(n.nft.resource, n.nft.id);
        const owner = owners.get(id);
        if (owner && owner !== account) throw new Error("Ownership changed during refresh; try again");
        owners.set(id, account);
        items.set(id, n);
      };
      for (const n of (await inventory(account)).values())
        put(await parseNFT(n.resource, n.id, "wallet"));
      for (const n of escrow.filter(e => e.account === account)) {
        if (!(await inventory(n.component)).has(key(n.resource, n.id)))
          throw new Error("Farm position changed during refresh; try again");
        put(await parseNFT(n.resource, n.id, n.status));
      }
      const nfts = [...items.values()].sort((a, b) =>
        a.kind.localeCompare(b.kind) || a.nft.name.localeCompare(b.nft.name) || key(a.nft.resource, a.nft.id).localeCompare(key(b.nft.resource, b.nft.id)));
      farms.push({
        account, total: nfts.length, nfts,
        canines: nfts.filter(n => n.kind === "canine").length,
        halloween: nfts.filter(n => n.kind === "halloween").length,
        staked: nfts.filter(n => n.status === "staked").length,
      });
    }
  }));
  return { updatedAt: new Date().toISOString(), farms };
}

export function rankFarms(snapshot: CommunitySnapshot): Ranking {
  const sorted = snapshot.farms.filter(f => f.total > 0)
    .sort((a, b) => b.total - a.total || a.account.localeCompare(b.account));
  let rank = 0;
  return {
    updatedAt: snapshot.updatedAt, stale: false,
    totalNFTs: sorted.reduce((sum, f) => sum + f.total, 0),
    farms: sorted.map(({ nfts, ...f }, i) => {
      if (!i || f.total !== sorted[i - 1].total) rank = i + 1;
      return { ...f, rank, preview: nfts.slice(0, 3) };
    }),
  };
}

export class CommunityService {
  private cached?: CommunitySnapshot;
  private pending?: Promise<CommunitySnapshot>;
  private retryAfter = 0;
  private lastError?: unknown;
  constructor(private readonly load: () => Promise<CommunitySnapshot> = async () => {
    const p = await IndexerProvider.connect({ url: "https://ootle-indexer-a.tari.com", network: Network.Esmeralda });
    return readCommunity(communityConfig(), async id => liveSubstate(await p.getSubstate(id)).substate);
  }, private readonly now = () => Date.now()) {}
  private async snapshot() {
    if (this.cached && this.now() - Date.parse(this.cached.updatedAt) < 60_000)
      return { snapshot: this.cached, stale: false };
    if (!this.pending && this.now() >= this.retryAfter) {
      this.pending = this.load().then(s => {
        this.cached = s; this.lastError = undefined; return s;
      }).catch(e => { this.lastError = e; this.retryAfter = this.now() + 15_000; throw e; })
        .finally(() => { this.pending = undefined; });
    }
    try {
      if (!this.pending) throw this.lastError ?? new Error("Public farms are temporarily unavailable");
      return { snapshot: await this.pending, stale: false };
    } catch {
      if (this.cached && this.now() - Date.parse(this.cached.updatedAt) <= 15 * 60_000)
        return { snapshot: this.cached, stale: true };
      throw new Error("Public farms are temporarily unavailable. Please try again shortly.");
    }
  }
  async ranking(): Promise<Ranking> {
    const { snapshot, stale } = await this.snapshot();
    return { ...rankFarms(snapshot), stale };
  }
  async farm(account: string): Promise<FarmView | undefined> {
    accountId.parse(account);
    const { snapshot, stale } = await this.snapshot();
    const farm = snapshot.farms.find(f => f.account === account);
    if (!farm) return undefined;
    return { updatedAt: snapshot.updatedAt, stale, farm, rank: rankFarms(snapshot).farms.find(f => f.account === account)?.rank };
  }
}
