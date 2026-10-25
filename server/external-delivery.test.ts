import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "kennel-delivery-test-"));
process.env.KENNEL_DATA_DIR = directory;
const component = "component_" + "ab".repeat(32);
writeFileSync(join(directory, "deployment-v2.json"), JSON.stringify({
  network: "esmeralda", component, operator: "component_" + "12".repeat(32), resource: "resource_" + "cd".repeat(32),
}));
const { ExternalService } = await import("./external-service.ts");
const { Journal } = await import("./journal.ts");
const { InsufficientFeeFunds } = await import("./account-readiness.ts");
const { PendingTransaction, RejectedTransaction } = await import("./wallet.ts");
const { NotSubmitted } = await import("./submission-errors.ts");

function fixture() {
  const id = "ab".repeat(16), owner = "component_" + "ef".repeat(32);
  const commitment = "cd".repeat(32);
  const journal = new Journal(mkdtempSync(join(directory, "journal-")));
  journal.save({ id, owner, door: 1, commitment, opening: { id, variant: 0, salt: "01".repeat(32) },
    externalAddress: "otl_esm_testaddress", stage: "started", createdAt: new Date().toISOString() });
  let funded = true, failure = "", seals = 0, deliveries = 0, sealed = false;
  const waits: string[] = [], reserves: bigint[] = [];
  const service = new ExternalService(journal, {
    validateExternalAccount: async () => "signer",
    incubationPayments: async () => ({}),
    checkFeeFunds: async () => { if (failure === "checkpoint") throw new Error("Substate API error: checkpoint missing"); },
    recoverSeal: async () => failure === "lost-seal" ? "saved-seal" : undefined,
    chainIncubations: async () => [{ id, owner, door: 1, signer: "", commitment: sealed ? commitment : "", hatched: false }],
    wallet: async () => ({ stealthTransfer: async () => {
      deliveries++;
      if (failure === "lost-delivery") throw new Error("private memo must never be exposed");
      return { transaction_id: "delivery-" + deliveries };
    } }) as never,
    ensureSpendableAccount: async (_client, _name, _store, required = 1_000_000n) => {
      reserves.push(required);
      if (!funded) throw new InsufficientFeeFunds();
    },
    submit: async () => {
      seals++;
      if (failure === "lost-seal") throw new Error("Submission acknowledgement lost");
      if (failure === "not-submitted") throw new NotSubmitted("private provider payload");
      sealed = true;
      return { transaction_id: "seal" } as never;
    },
    waitAccepted: async (id) => {
      waits.push(id);
      if (id.startsWith("delivery") && failure === "pending") throw new PendingTransaction(id);
      if (id.startsWith("delivery") && failure === "rejected") throw new RejectedTransaction(id);
      return {} as never;
    },
  });
  return { service, journal, id, waits, reserves,
    setFunded(value: boolean) { funded = value; },
    setFailure(value: string) { failure = value; },
    get seals() { return seals; }, get deliveries() { return deliveries; },
    run: () => service["launch"](id),
  };
}

test("low operator funds keep the original secret and resume without a second player request", async () => {
  const f = fixture(), original = structuredClone(f.journal.get(f.id)!);
  f.setFunded(false);
  await f.run();
  assert.equal(f.seals, 0);
  assert.equal(f.deliveries, 0);
  assert.equal(f.journal.get(f.id)?.stage, "started");
  assert.match(f.journal.get(f.id)!.error!, /game's delivery wallet needs test Tari/);
  f.setFunded(true);
  await f.run();
  assert.equal(f.journal.get(f.id)?.stage, "ready");
  assert.deepEqual(f.journal.get(f.id)?.opening, original.opening);
  assert.equal(f.journal.get(f.id)?.commitment, original.commitment);
  assert.ok(f.reserves.includes(1_000_001n));
  await f.run();
  assert.equal(f.seals, 1);
  assert.equal(f.deliveries, 1);
});

test("lost delivery acknowledgement remains blocked and never leaks provider payloads", async () => {
  const f = fixture();
  f.setFailure("lost-delivery");
  await f.run();
  assert.equal(f.journal.get(f.id)?.stage, "delivering");
  assert.equal(f.journal.get(f.id)?.deliveryTx, undefined);
  assert.doesNotMatch(f.journal.get(f.id)!.error!, /private memo/);
  f.setFailure("");
  await f.run();
  assert.equal(f.deliveries, 1);
  assert.equal(f.journal.get(f.id)?.stage, "delivering");
});

test("pending delivery checks the saved receipt and does not send another transfer", async () => {
  const f = fixture();
  f.setFailure("pending");
  await f.run();
  assert.match(f.journal.get(f.id)!.error!, /network confirmation/);
  f.setFailure("");
  await f.run();
  assert.equal(f.journal.get(f.id)?.stage, "ready");
  assert.equal(f.deliveries, 1);
  assert.deepEqual(f.waits, ["seal", "delivery-1", "delivery-1"]);
});

test("network rejection preserves the original transaction and never sends a replacement", async () => {
  const f = fixture();
  f.setFailure("not-submitted");
  await f.run();
  assert.equal(f.journal.get(f.id)?.stage, "started");
  assert.doesNotMatch(f.journal.get(f.id)!.error!, /private provider/);
  f.setFailure("rejected");
  await f.run();
  assert.equal(f.journal.get(f.id)?.stage, "delivering");
  assert.equal(f.journal.get(f.id)?.deliveryTx, "delivery-1");
  await f.run();
  assert.equal(f.journal.get(f.id)?.stage, "delivering");
  assert.equal(f.seals, 2);
  assert.equal(f.deliveries, 1);
});

test("lost seal acknowledgement recovers the saved transaction without another submission", async () => {
  const f = fixture();
  f.setFailure("lost-seal");
  await f.run();
  assert.equal(f.journal.get(f.id)?.sealTx, "saved-seal");
  assert.equal(f.journal.get(f.id)?.stage, "ready");
  assert.equal(f.seals, 1);
  assert.ok(f.waits.includes("saved-seal"));
});

test("restart reconciles sealing records, and absent matches never authorize resubmission", async () => {
  const f = fixture();
  f.journal.save({ ...f.journal.get(f.id)!, stage: "sealing" });
  await f.run();
  assert.equal(f.seals, 0);
  assert.equal(f.journal.get(f.id)?.stage, "sealing");
  f.setFailure("lost-seal");
  await f.run();
  assert.equal(f.seals, 0);
  assert.equal(f.journal.get(f.id)?.sealTx, "saved-seal");
  assert.equal(f.journal.get(f.id)?.stage, "ready");
});


test("deferred activation blocks new approvals before any chain call", async () => {
  const previous = process.env.KENNEL_ACTIVATE_INCUBATION_TREASURY;
  process.env.KENNEL_ACTIVATE_INCUBATION_TREASURY = "true";
  try {
    const f = fixture();
    await assert.rejects(f.service.prepare({ account: "", component: "", paymentAddress: "", door: 0, nonce: "" }), /New incubations are paused/);
    assert.equal(f.seals, 0);
    assert.equal(f.deliveries, 0);
    await f.run();
    assert.equal(f.journal.get(f.id)?.stage, "ready");
  } finally {
    if (previous === undefined) delete process.env.KENNEL_ACTIVATE_INCUBATION_TREASURY;
    else process.env.KENNEL_ACTIVATE_INCUBATION_TREASURY = previous;
  }
});


test("paid incubations cannot skip verified delivery readiness", async () => {
  const f = fixture();
  const fee = { component: "component_" + "34".repeat(32), treasury: "component_" + "12".repeat(32), amount: 20_000_000 };
  const path = join(directory, "incubation-treasury-v1.json");
  writeFileSync(path, JSON.stringify({ ...fee, network: "esmeralda", game: component, template: "56".repeat(32) }));
  const intent = { account: "component_" + "78".repeat(32), component, paymentAddress: "otl_esm_testaddress", door: 0, nonce: "aa".repeat(32), fee };
  try {
    f.setFailure("checkpoint");
    await assert.rejects(f.service.prepare(intent), /Unable to check the game's delivery wallet/);
    assert.equal(f.seals, 0);
    assert.equal(f.deliveries, 0);
    f.setFailure("");
    assert.deepEqual(await f.service.prepare(intent), { ok: true });
  } finally { unlinkSync(path); }
});
