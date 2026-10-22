import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stringLiteral,
  intLiteral,
  componentAddressLiteral,
} from "@tari-project/ootle";
import { callInstructions } from "./wallet.ts";
import {
  intentId,
  playerInstructions,
  type WalletIntent,
} from "../shared/external-wallet.ts";
import { verifyAuthorizedIntent } from "./external-service.ts";
import { checkAccount, readGame } from "./external-chain.ts";
import { publicRecord } from "./journal.ts";
import {
  ExternalWallet,
  readSaved,
  type TariProvider,
} from "../src/external-wallet.ts";
import { commitmentFor } from "./crypto.ts";
import type { GameState } from "../shared/game.ts";

const component = "component_" + "ab".repeat(32),
  account = "component_" + "cd".repeat(32);
const intent: WalletIntent = {
  component,
  account,
  paymentAddress: "otl_esm_testaddress",
  door: 1,
  nonce: "ef".repeat(32),
};
test("signed incubation ID binds the full address, account, door, deployment and nonce", async () => {
  const id = await intentId(intent),
    signer = "12".repeat(32);
  const chain = {
    id,
    signer,
    owner: account,
    door: 1,
    commitment: "",
    hatched: false,
  };
  verifyAuthorizedIntent(intent, id, signer, chain);
  for (const altered of [
    { ...intent, paymentAddress: "otl_esm_attacker_view_key" },
    { ...intent, account: component },
    { ...intent, door: 2 },
    { ...intent, component: account },
    { ...intent, nonce: "00".repeat(32) },
  ])
    assert.throws(() => verifyAuthorizedIntent(altered, id, signer, chain));
  assert.throws(() =>
    verifyAuthorizedIntent(intent, id, "34".repeat(32), chain),
  );
  assert.throws(() => verifyAuthorizedIntent(intent, id, signer));
});
test("browser begin and hatch encodings exactly match the official SDK", () => {
  const id = "01".repeat(16),
    salt = "fe".repeat(32);
  for (let door = 0; door < 3; door++)
    assert.deepEqual(
      playerInstructions(component, id, { kind: "begin", account, door }),
      callInstructions(component, "begin_incubation", [
        stringLiteral(id),
        componentAddressLiteral(account),
        intLiteral(BigInt(door)),
      ]),
    );
  for (let variant = 0; variant < 4; variant++)
    assert.deepEqual(
      playerInstructions(component, id, { kind: "hatch", variant, salt }),
      callInstructions(component, "hatch", [
        stringLiteral(id),
        intLiteral(BigInt(variant)),
        stringLiteral(salt),
      ]),
    );
});
test("account proof requires built-in account and its public owner; public records omit address and opening", () => {
  const signer = "ab".repeat(32),
    raw = {
      header: {
        template_address: "0".repeat(64),
        owner_rule: { ByPublicKey: signer },
      },
    };
  checkAccount(raw, signer);
  assert.throws(() => checkAccount(raw, "00".repeat(32)));
  assert.throws(() =>
    checkAccount(
      { header: { ...raw.header, template_address: signer } },
      signer,
    ),
  );
  const view = publicRecord({
    id: "01".repeat(16),
    door: 0,
    owner: account,
    externalAddress: intent.paymentAddress,
    stage: "ready",
    commitment: signer,
    createdAt: "now",
    opening: { id: "01".repeat(16), variant: 0, salt: "ee".repeat(32) },
  });
  assert.equal("opening" in view, false);
  assert.equal("externalAddress" in view, false);
  assert.equal("owner" in view, false);
  assert.throws(() =>
    readGame(
      { header: { template_address: signer }, body: { state: [] } },
      signer,
      "resource_" + signer,
    ),
  );
});

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}
function fixture(failure: "none" | "create" | "submit" = "none") {
  const storage = new MemoryStorage();
  let network = "esmeralda",
    creates = 0,
    submits = 0,
    registered = false,
    requestStatus = "approved";
  const requests = new Map<
    string,
    { method: string; args: { Literal: string }[] }
  >();
  let chain: GameState = {
    connected: true,
    network: "Esmeralda",
    account,
    incubations: [],
    canines: [],
  };
  const calls: string[] = [];
  const p: TariProvider = {
    isTariWallet: true,
    async request<T>({
      method,
      params,
    }: {
      method: string;
      params?: any;
    }): Promise<T> {
      calls.push(method);
      let value: unknown;
      switch (method) {
        case "tari_requestAccounts":
        case "tari_getAccounts":
          value = [account];
          break;
        case "tari_getNetwork":
          value = network;
          break;
        case "tari_getWalletAddress":
          value = intent.paymentAddress;
          break;
        case "tari_getCapabilities":
          value = {
            transactionRequests: true,
            walletAddress: true,
            privateScan: true,
          };
          break;
        case "tari_createTransactionRequest": {
          creates++;
          if (failure === "create") throw new Error("Lost acknowledgement");
          requests.set(
            String(creates),
            params.instructions[params.instructions.length - 1].CallMethod,
          );
          requestStatus = "approved";
          value = { requestId: String(creates) };
          break;
        }
        case "tari_getTransactionRequest":
          value = { status: requestStatus };
          break;
        case "tari_submitTransactionRequest": {
          submits++;
          requestStatus = "submitted";
          const op = requests.get(params.requestId)!;
          if (op.method === "begin_incubation") {
            const id = Buffer.from(
              op.args[0].Literal.slice(4),
              "hex",
            ).toString();
            chain.incubations = [
              {
                id,
                door: 1,
                stage: "started",
                createdAt: "now",
                commitment: "",
              },
            ];
          } else if (
            op.method === "begin_rebirth" ||
            op.method === "begin_breeding"
          ) {
            chain.canines = [];
          } else chain.incubations[0].stage = "hatched";
          if (failure === "submit") throw new Error("Lost submission response");
          value = { transactionId: "11".repeat(32) };
          break;
        }
        case "tari_requestViewAccess":
          value = { granted: true };
          break;
        case "tari_getShieldedOutputs":
          value = [];
          break;
        case "tari_scanForResourceUtxos":
          value = {
            found: [
              {
                transactionId: "22".repeat(32),
                memo: `MK2:${chain.incubations[0].id}:2:${"ad".repeat(32)}`,
              },
            ],
          };
          break;
        default:
          throw new Error("Unexpected method " + method);
      }
      return value as T;
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { tari: p, addEventListener() {}, removeEventListener() {} },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (
          _name: string,
          _options: unknown,
          fn: (lock: {}) => unknown,
        ) => fn({}),
      },
    },
  });
  const api = async <T>(path: string, body?: any): Promise<T> => {
    let result: unknown;
    if (path === "/external/config")
      result = { component, network: "esmeralda", incubationFee: chain.incubationFee };
    else if (path.startsWith("/external/state"))
      result = structuredClone(chain);
    else if (path === "/external/prepare") result = { ok: true };
    else if (path === "/external/register") {
      registered = true;
      assert.equal(body.id, chain.incubations[0].id);
      result = {};
    } else throw new Error("Unexpected server call " + path);
    return result as T;
  };
  return {
    storage,
    api,
    calls,
    p,
    chain,
    get creates() {
      return creates;
    },
    get submits() {
      return submits;
    },
    get registered() {
      return registered;
    },
    setNetwork(n: string) {
      network = n;
    },
  };
}
test("external flow signs twice in wallet, reads memo only on request, stores no opening, and never provisions hosted wallet", async () => {
  const f = fixture(),
    w = await ExternalWallet.connect(f.api, () => {});
  await w.begin(1);
  assert.equal(f.creates, 1);
  assert.equal(f.submits, 1);
  assert.equal(f.registered, true);
  assert.equal(f.calls.includes("tari_requestViewAccess"), false);
  const c = f.chain.incubations[0];
  c.stage = "ready";
  c.deliveryTx = "22".repeat(32);
  c.commitment = commitmentFor({ id: c.id, variant: 2, salt: "ad".repeat(32) });
  const opening = await w.open(c);
  assert.equal(opening.variant, 2);
  await w.hatch(opening);
  await w.hatch(opening);
  assert.equal(f.creates, 2);
  assert.equal(f.submits, 2);
  assert.equal(
    JSON.stringify([...f.storage.data.values()]).includes(opening.salt),
    false,
  );
  assert.equal(readSaved(f.storage, account, component).length, 1);
});
test("lost creation acknowledgement cannot create a duplicate after reconnect", async () => {
  const f = fixture("create"),
    w = await ExternalWallet.connect(f.api, () => {});
  await assert.rejects(w.begin(1), /Lost acknowledgement/);
  const id = readSaved(f.storage, account, component)[0].id;
  w.stop();
  const restored = await ExternalWallet.connect(f.api, () => {});
  await assert.rejects(restored.resume(id), /acknowledgement was lost/);
  assert.equal(f.creates, 1);
  assert.equal(f.submits, 0);
});
test("lost submission response recovers from on-chain receipt without submitting twice", async () => {
  const f = fixture("submit"),
    w = await ExternalWallet.connect(f.api, () => {});
  await assert.rejects(w.begin(1), /Lost submission/);
  w.stop();
  const restored = await ExternalWallet.connect(f.api, () => {});
  await restored.resume(f.chain.incubations[0].id);
  assert.equal(f.creates, 1);
  assert.equal(f.submits, 1);
  assert.equal(f.registered, true);
});
test("network switch invalidates the connection before any signature or private read", async () => {
  const f = fixture();
  let invalidated = false;
  const w = await ExternalWallet.connect(f.api, () => {
    invalidated = true;
  });
  f.setNetwork("igor");
  await assert.rejects(w.begin(1), /changed/);
  assert.equal(invalidated, true);
  assert.equal(f.creates, 0);
  assert.equal(f.calls.includes("tari_requestViewAccess"), false);
});

test("Sapient rebirth retains its approval after a lost submission response and never duplicates the exchange", async () => {
  const f = fixture("submit"),
    resource = "resource_" + "12".repeat(32);
  f.chain.rebirth = {
    component: "component_" + "34".repeat(32),
    resource: "resource_" + "56".repeat(32),
    current: resource,
    legacy: resource,
    staking: "component_" + "ab".repeat(32),
    fee: 8_000_000,
  };
  f.chain.canines = [
    {
      id: "78".repeat(16),
      resource,
      name: "Beaglebyte Prime",
      genes: "EEEEEEEE",
      variant: 0,
      generation: 0,
    },
  ];
  const input = { id: f.chain.canines[0].id, resource, reward: 0 };
  const w = await ExternalWallet.connect(f.api, () => {});
  await assert.rejects(w.rebirth(input), /Lost submission response/);
  assert.equal(w.pendingEconomy(f.chain.rebirth!).length, 1);
  const restored = await ExternalWallet.connect(f.api, () => {});
  await restored.rebirth(input);
  await restored.rebirth(input);
  assert.equal(f.creates, 1);
  assert.equal(f.submits, 1);
  assert.equal(restored.pendingEconomy(f.chain.rebirth!).length, 0);
  assert.equal((await restored.state()).incubations.length, 0);
});

test("Sapient rebirth blocks a second approval after an unknown create acknowledgement", async () => {
  const f = fixture("create"),
    resource = "resource_" + "12".repeat(32);
  f.chain.rebirth = {
    component: "component_" + "34".repeat(32),
    resource: "resource_" + "56".repeat(32),
    current: resource,
    legacy: resource,
    staking: "component_" + "ab".repeat(32),
    fee: 8_000_000,
  };
  f.chain.canines = [
    {
      id: "78".repeat(16),
      resource,
      name: "Beaglebyte Prime",
      genes: "EEEEEEEE",
      variant: 0,
      generation: 0,
    },
  ];
  const input = { id: f.chain.canines[0].id, resource, reward: 0 };
  const w = await ExternalWallet.connect(f.api, () => {});
  await assert.rejects(w.rebirth(input), /Lost acknowledgement/);
  await assert.rejects(w.rebirth(input), /acknowledgement was lost/);
  await assert.rejects(
    w.rebirth({ ...input, reward: 1 }),
    /acknowledgement was lost/,
  );
  assert.equal(f.creates, 1);
  assert.equal(f.submits, 0);
});

for (const failure of ["create", "submit"] as const)
  test(`breeding preserves ${failure} ambiguity across wallet reconnect without duplicate approval`, async () => {
    const f = fixture(failure);
    const config = {
      component: "component_" + "56".repeat(32),
      resource: "resource_" + "78".repeat(32),
      current: "resource_" + "9a".repeat(32),
      legacy: "resource_" + "bc".repeat(32),
      fee: 1_000_000,
    };
    f.chain.breedingConfig = config;
    const action = {
      kind: "breed" as const,
      first: { resource: config.current, id: "01".repeat(16) },
      second: { resource: config.current, id: "02".repeat(16) },
    };
    const nonce = "34".repeat(16);
    const w = await ExternalWallet.connect(f.api, () => {});
    await assert.rejects(w.breed(action, nonce), /Lost/);
    assert.equal(w.pendingBreeding(config).length, 1);
    w.stop();
    const restored = await ExternalWallet.connect(f.api, () => {});
    if (failure === "create") {
      await assert.rejects(
        restored.breed(action, nonce),
        /acknowledgement was lost/,
      );
      await assert.rejects(restored.breed(action, "ff".repeat(16)), /Resume/);
      assert.equal(f.submits, 0);
    } else {
      await restored.breed(action, nonce);
      await restored.breed(action, nonce);
      assert.equal(f.submits, 1);
      assert.equal(restored.pendingBreeding(config).length, 0);
    }
    assert.equal(f.creates, 1);
    assert.equal(f.calls.includes("tari_requestViewAccess"), false);
  });

test("shared farm transition resumes an old signed rebirth but rejects new deposits to recovery contracts", async () => {
  const f = fixture("submit");
  const old = {
    component: "component_" + "34".repeat(32),
    resource: "resource_" + "56".repeat(32),
    current: "resource_" + "12".repeat(32),
    legacy: "resource_" + "12".repeat(32),
    staking: "component_" + "ab".repeat(32),
    fee: 8_000_000,
  };
  f.chain.rebirth = old;
  const action = {
    kind: "begin" as const,
    resource: old.current,
    id: "78".repeat(16),
  };
  const nonce = "ef".repeat(16);
  const w = await ExternalWallet.connect(f.api, () => {});
  await assert.rejects(
    w.act(action, nonce, old.component),
    /Lost submission response/,
  );
  f.chain.rebirth = {
    ...old,
    component: "component_" + "90".repeat(32),
    staking: "component_" + "91".repeat(32),
  };
  f.chain.recoveryEconomies = [{ config: old }];
  const restored = await ExternalWallet.connect(f.api, () => {});
  await restored.act(action, nonce, old.component);
  assert.equal(restored.pendingEconomy(old).length, 0);
  assert.equal(f.creates, 1);
  assert.equal(f.submits, 1);
  for (const kind of ["begin", "stake"] as const)
    await assert.rejects(
      restored.act({ ...action, kind }, "11".repeat(16), old.component),
      /recovery-only/,
    );
  assert.equal(f.creates, 1);
});

test("refresh restores existing Sapient permission without requesting access or creating a transaction", async () => {
  const f = fixture();
  const wallet = await ExternalWallet.restore(f.api, () => {});
  assert.ok(wallet);
  assert.equal(wallet.account, account);
  await wallet.state();
  assert.equal(f.calls.includes("tari_requestAccounts"), false);
  assert.equal(f.calls.includes("tari_requestViewAccess"), false);
  assert.equal(f.creates, 0);
  assert.equal(f.submits, 0);
  wallet.stop();
});

test("refresh with revoked permission or no provider stays disconnected without prompting", async () => {
  const f = fixture();
  const request = f.p.request.bind(f.p);
  f.p.request = async <T>(r: {method: string; params?: unknown}) =>
    r.method === "tari_getAccounts" ? [] as T : request<T>(r);
  assert.equal(await ExternalWallet.restore(f.api, () => {}), null);
  assert.equal(f.calls.includes("tari_requestAccounts"), false);
  window.tari = undefined;
  assert.equal(await ExternalWallet.restore(f.api, () => {}), null);
});

test("refresh refuses the wrong network and removes listeners after failed validation", async () => {
  const f = fixture();
  f.setNetwork("igor");
  await assert.rejects(ExternalWallet.restore(f.api, () => {}), /Esmeralda/);
  assert.equal(f.calls.includes("tari_requestAccounts"), false);
  f.setNetwork("esmeralda");
  let unsubscribed = false;
  f.p.on = () => () => { unsubscribed = true; };
  const request = f.p.request.bind(f.p);
  let checks = 0;
  f.p.request = async <T>(r: {method: string; params?: unknown}) => {
    if (r.method === "tari_getAccounts" && ++checks > 1) throw new Error("Wallet locked");
    return request<T>(r);
  };
  await assert.rejects(ExternalWallet.restore(f.api, () => {}), /Wallet locked/);
  assert.equal(unsubscribed, true);
});


test("paid incubation strips deployment metadata from prepare, register and saved intents", async () => {
  const f = fixture();
  const fee = { component: "component_" + "11".repeat(32), treasury: "component_" + "22".repeat(32), amount: 20_000_000 };
  const descriptor = { ...fee, network: "esmeralda", template: "template_" + "33".repeat(32), game: component, operator: fee.treasury, publicationTx: "44".repeat(32), creationTx: "55".repeat(32), createdAt: "2026-10-21T17:00:57.380Z" };
  f.chain.incubationFee = descriptor;
  const requests: string[] = [];
  const api: typeof f.api = async (path, body) => {
    if (path === "/external/prepare" || path === "/external/register") {
      assert.deepEqual(path.endsWith("prepare") ? body.fee : body.intent.fee, fee);
      requests.push(path);
    }
    return f.api(path, body);
  };
  const w = await ExternalWallet.connect(api, () => {});
  await w.begin(1);
  assert.deepEqual(requests, ["/external/prepare", "/external/register"]);
  assert.deepEqual(readSaved(f.storage, account, component)[0].intent.fee, fee);
  assert.equal(f.registered, true);
  assert.equal(f.creates, 1);
  w.stop();
});

test("paid incubation preserves the original approval after a lost submission response", async () => {
  const f = fixture("submit");
  f.chain.incubationFee = { component: "component_" + "11".repeat(32), treasury: "component_" + "22".repeat(32), amount: 20_000_000 };
  const w = await ExternalWallet.connect(f.api, () => {});
  await assert.rejects(w.begin(1), /Lost submission response/);
  const saved = readSaved(f.storage, account, component)[0];
  assert.deepEqual(saved.intent.fee, f.chain.incubationFee);
  w.stop();
  const restored = await ExternalWallet.restore(f.api, () => {});
  await restored!.resume(saved.id);
  assert.equal(f.creates, 1);
  assert.equal(f.submits, 1);
  assert.equal(f.registered, true);
});


test("private reveal reads a cached memo without rescanning spent transaction outputs", async () => {
  const f = fixture();
  const request = f.p.request.bind(f.p);
  f.p.request = async (args) => {
    if (args.method === "tari_getShieldedOutputs") return [{ transactionId: "22".repeat(32), memo: `MK2:${f.chain.incubations[0].id}:2:${"ad".repeat(32)}` }] as any;
    if (args.method === "tari_scanForResourceUtxos") throw new Error("Should not rescan a cached memo");
    return request(args);
  };
  const w = await ExternalWallet.connect(f.api, () => {});
  await w.begin(1);
  const c = f.chain.incubations[0];
  c.stage = "ready";
  c.deliveryTx = "22".repeat(32);
  c.commitment = commitmentFor({ id: c.id, variant: 2, salt: "ad".repeat(32) });
  const opening = await w.open(f.chain.incubations[0]);
  assert.equal(opening.variant, 2);
  assert.equal(f.submits, 1);
  w.stop();
});

test("private reveal recovers from a down output with a bounded private scan and verifies the memo", async () => {
  const f = fixture();
  const request = f.p.request.bind(f.p);
  let fallbacks = 0;
  f.p.request = async (args) => {
    if (args.method === "tari_scanForResourceUtxos") {
      assert.equal((args.params as any).maxPages, 0);
      throw new Error(`HTTP 404: - {"error":"Input substate utxo_${"01".repeat(32)}_${"ab".repeat(32)} (v0) is down"}`);
    }
    if (args.method === "tari_scanForPrivatePayments") {
      fallbacks++;
      assert.equal((args.params as any).maxPages, 10);
      const id = f.chain.incubations[0].id;
      return { found: [
        { transactionId: "99".repeat(32), memo: `MK2:${id}:2:${"ad".repeat(32)}` },
        { transactionId: "22".repeat(32), memo: `MK2:${id}:1:${"ad".repeat(32)}` },
        { transactionId: "22".repeat(32), memo: `MK2:${id}:2:${"ad".repeat(32)}` },
      ] } as any;
    }
    return request(args);
  };
  const w = await ExternalWallet.connect(f.api, () => {});
  await w.begin(1);
  const c = f.chain.incubations[0];
  c.stage = "ready";
  c.deliveryTx = "22".repeat(32);
  c.commitment = commitmentFor({ id: c.id, variant: 2, salt: "ad".repeat(32) });
  assert.equal((await w.open(f.chain.incubations[0])).variant, 2);
  assert.equal(fallbacks, 1);
  assert.equal(f.submits, 1);
  w.stop();
});
