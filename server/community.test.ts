import { test } from "node:test";
import assert from "node:assert/strict";
import { CommunityService, rankFarms, readCommunity, type CommunityConfig, type ReadSubstate } from "./community.ts";
import type { SubstateValue } from "@tari-project/ootle-ts-bindings";
import { VARIANTS, genotypeFor } from "../shared/game.ts";
import { HALLOWEEN_REWARDS } from "../shared/rebirth.ts";

const hex = (n: number) => n.toString(16).padStart(64, "0");
const account = (n: number) => "component_" + hex(n);
const resource = (n: number) => "resource_" + hex(n);
const id = (n: number) => n.toString(16).padStart(32, "0");
const tag = (tag: number, n: number) => ({ "@cbor": "tag", tag, value: { "@cbor": "bytes", hex: hex(n) } });
const token = (n: number) => [1, [id(n)]];
function fixture() {
  const states = new Map<string, unknown>();
  const component = (n: number, state: unknown, template = hex(0)) => states.set(account(n), {
    Component: { header: { template_address: template }, body: { state } },
  });
  const vault = (n: number, r: number, ids: number[]) => states.set("vault_" + hex(n), {
    Vault: { resource_container: { NonFungible: { address: resource(r), token_ids: ids.map(n => ({ String: id(n) })), locked_token_ids: [] } } },
  });
  const canine = (n: number, r = 20) => states.set(`nft_${hex(r)}_str_${id(n)}`, {
    NonFungible: { data: { variant: "0", incubation_id: id(n), name: VARIANTS[0].name, genes: VARIANTS[0].genes, color: "A", genotype: genotypeFor(VARIANTS[0].genes, "A"), art_version: "waves-canines-v1", generation: "0" } },
  });
  const config: CommunityConfig = {
    collections: [{ resource: resource(20), kind: "canine" }, { resource: resource(21), kind: "halloween" }],
    contracts: [{ component: account(10), template: hex(9), kind: "incubator" }],
  };
  // Alice minted both, but the first now belongs to Bob. Both participated.
  component(10, [null, null, { one: [null, tag(128, 1)], two: [null, tag(128, 2)], empty: [null, tag(128, 3)] }], hex(9));
  component(1, [tag(132, 101), tag(132, 102)]);
  component(2, [tag(132, 103)]);
  component(3, []);
  vault(101, 20, [2]);
  vault(102, 999, [1, 2, 3]); // unrelated NFTs must not count
  vault(103, 20, [1]);
  canine(1); canine(2);
  const read: ReadSubstate = async key => {
    assert.ok(states.has(key), `Unexpected read: ${key}`);
    return states.get(key) as SubstateValue;
  };
  return { states, component, vault, canine, config, read };
}

test("ranking counts current holdings, ignores mint ownership/unrelated NFTs, shares ties and keeps empty farms visitable", async () => {
  const f = fixture();
  const snapshot = await readCommunity(f.config, f.read);
  const ranking = rankFarms(snapshot);
  assert.deepEqual(ranking.farms.map(f => [f.account, f.total, f.rank]), [[account(1), 1, 1], [account(2), 1, 1]]);
  assert.equal(ranking.totalNFTs, 2);
  assert.equal(snapshot.farms.find(f => f.account === account(2))!.nfts[0].nft.id, id(1));
  assert.equal(snapshot.farms.find(f => f.account === account(3))!.total, 0);
  assert.ok(!JSON.stringify(ranking).includes("balance"));
});

test("active and recovery stakes plus pending breeding/rebirth belong to the recorded recipient; completed burns do not count", async () => {
  const f = fixture();
  for (const [n, status] of [[11, "staking"], [12, "staking"], [13, "rebirth"], [14, "breeding"]] as const)
    f.config.contracts.push({ component: account(n), template: hex(9), kind: status });
  for (let n = 3; n <= 8; n++) f.canine(n);
  const stake = (n: number) => [null, tag(128, 1), tag(131, 20), token(n), "0", "0"];
  f.component(11, [tag(132, 111), null, null, { a: stake(3) }], hex(9));
  f.component(12, [tag(132, 112), null, null, { a: stake(4) }], hex(9));
  f.vault(111, 20, [3]); f.vault(112, 20, [4]);
  f.component(13, [tag(132, 113), null, null, null, null, null, {
    pending: [null, tag(128, 1), tag(131, 20), token(5), 1, 0, 0],
    burned: [null, tag(128, 1), tag(131, 20), token(8), 1, 1, 0],
  }], hex(9));
  f.vault(113, 20, [5]);
  const parent = (n: number) => [tag(131, 20), token(n), "EEEEEEEE", 0];
  f.component(14, [tag(132, 114), null, null, null, null, {
    pending: [null, tag(128, 2), parent(6), parent(7), 1, 0],
  }], hex(9));
  f.vault(114, 20, [6, 7]);
  const snap = await readCommunity(f.config, f.read);
  const a = snap.farms.find(f => f.account === account(1))!;
  const b = snap.farms.find(f => f.account === account(2))!;
  assert.equal(a.total, 4);
  assert.equal(a.staked, 2);
  assert.deepEqual(a.nfts.map(n => n.status).sort(), ["rebirth", "staked", "staked", "wallet"]);
  assert.equal(b.total, 3);
  assert.equal(b.nfts.filter(n => n.status === "breeding").length, 2);
  assert.ok(!a.nfts.some(n => n.nft.id === id(8)));
});

test("Halloween NFTs count once alongside canines, including repeated token references within a vault", async () => {
  const f = fixture();
  const rewardId = hex(30), spec = HALLOWEEN_REWARDS[0];
  f.states.set("vault_" + hex(102), {
    Vault: { resource_container: { NonFungible: { address: resource(21), token_ids: [{ String: rewardId }, { String: rewardId }], locked_token_ids: [] } } },
  });
  f.states.set(`nft_${hex(21)}_str_${rewardId}`, {
    NonFungible: { data: { reward: "0", name: spec.name, original: spec.original, edition: "tari-halloween-2026", art_version: "arkimals-halloween-v1", rebirth_id: rewardId, source_resource: resource(20), source_id: "str_" + id(7) } },
  });
  const ranking = rankFarms(await readCommunity(f.config, f.read));
  assert.equal(ranking.farms[0].total, 2);
  assert.equal(ranking.farms[0].halloween, 1);
  assert.equal(ranking.farms[1].rank, 2);
});

test("inconsistent ownership or unavailable chain data cannot produce a misleading ranking", async () => {
  const f = fixture();
  f.vault(103, 20, [2]);
  await assert.rejects(readCommunity(f.config, f.read), /Ownership changed/);
  f.states.delete("vault_" + hex(101));
  await assert.rejects(readCommunity(f.config, f.read), /Unexpected read/);
});

test("public cache coalesces requests and explicitly marks stale data, then expires rather than inventing zero balances", async () => {
  let now = Date.now(), calls = 0, fail = false;
  const f = fixture();
  const svc = new CommunityService(async () => {
    calls++;
    if (fail) throw new Error("Indexer down");
    return { ...await readCommunity(f.config, f.read), updatedAt: new Date(now).toISOString() };
  }, () => now);
  const [a, b] = await Promise.all([svc.ranking(), svc.farm(account(1))]);
  assert.equal(calls, 1); assert.equal(a.stale, false); assert.equal(b?.farm.total, 1);
  assert.equal(await svc.farm(account(999)), undefined);
  fail = true; now += 61_000;
  assert.equal((await svc.ranking()).stale, true);
  assert.equal(calls, 2);
  assert.equal((await svc.ranking()).totalNFTs, 2);
  assert.equal(calls, 2);
  now += 15 * 60_000;
  await assert.rejects(svc.ranking(), /temporarily unavailable/);
  await assert.rejects(svc.farm("../secrets"), /Invalid/);
});
