import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Journal, type Incubation } from "./journal.ts";
import { createOpening, commitmentFor } from "./crypto.ts";
import {
  reconcileMissingAccount,
  recoverableMissingAccount,
} from "./reconciliation.ts";
import { missingSubstateError } from "./submission-errors.ts";
import type { Deployment } from "./config.ts";
const owner = "component_" + "a".repeat(64),
  id = "d".repeat(32);
function fixture() {
  const journal = new Journal(mkdtempSync(join(tmpdir(), "kennel-reconcile-"))),
    opening = createOpening(id);
  const record: Incubation = {
    id,
    owner,
    opening,
    commitment: commitmentFor(opening),
    door: 0,
    stage: "starting",
    createdAt: new Date().toISOString(),
  };
  journal.save(record);
  journal.save({
    ...record,
    error: `RPC Error 404: Application error: 404: Not found: Substate ${owner} does not exist`,
  });
  journal.save({
    ...record,
    error:
      "Submission acknowledgement was lost. Developer reconciliation is required before retrying; no duplicate request was sent.",
  });
  const deployed = {
    component: "component_" + "b".repeat(64),
    template: "template_" + "c".repeat(64),
  } as Deployment;
  const chain = {
    substate_from_remote: {
      substate: {
        Component: {
          header: { template_address: "c".repeat(64) },
          body: { state: [{}, {}, {}, {}, 100, 0] },
        },
      },
    },
  };
  const client: any = {
    transactionsList: async () => ({ transactions: [] }),
    substatesGet: async () => chain,
  };
  return { journal, record: journal.get(id)!, deployed, chain, client };
}
test("legacy missing-account recovery preserves id/secret/commitment and all original records", async () => {
  const f = fixture();
  const before = f.journal.recordsFor(id);
  const after = await reconcileMissingAccount(
    f.client,
    f.journal,
    f.record,
    f.deployed,
  );
  assert.equal(after.stage, "reserved");
  assert.equal(after.id, id);
  assert.deepEqual(after.opening, f.record.opening);
  assert.equal(after.commitment, f.record.commitment);
  assert.deepEqual(f.journal.recordsFor(id).slice(0, 3), before);
  assert.equal(f.journal.recordsFor(id).length, 4);
});
test("recovery refuses chain claims, matching wallet receipts and unfamiliar chain schemas", async () => {
  for (const mode of ["chain", "receipt", "schema"]) {
    const f = fixture();
    if (mode === "chain")
      (f.chain.substate_from_remote.substate.Component.body.state[2] as any)[
        id
      ] = [];
    if (mode === "receipt")
      f.client.transactionsList = async () => ({
        transactions: [
          { transaction: { V1: { args: Buffer.from(id).toString("hex") } } },
        ],
      });
    if (mode === "schema")
      f.chain.substate_from_remote.substate.Component.header.template_address =
        "different";
    await assert.rejects(
      reconcileMissingAccount(f.client, f.journal, f.record, f.deployed),
    );
    assert.equal(f.journal.recordsFor(id).length, 3);
  }
});
test("unknown lost acknowledgements never qualify as pre-submission failures", () => {
  const f = fixture();
  assert.equal(recoverableMissingAccount(f.journal.recordsFor(id)), true);
  assert.equal(recoverableMissingAccount([f.record]), false);
  assert.equal(
    recoverableMissingAccount([
      ...f.journal.recordsFor(id),
      { ...f.record, startTx: "known" },
    ]),
    false,
  );
  const rpc = new Error("missing", {
    cause: {
      method: "transactions.submit_instruction",
      code: 404,
      message: `Application error: 404: Not found: Substate ${owner} does not exist`,
    },
  });
  assert.equal(missingSubstateError(rpc), true);
  assert.equal(missingSubstateError(new Error("fetch failed")), false);
  assert.equal(
    missingSubstateError(
      new Error("missing", {
        cause: {
          method: "stealth.transfer",
          code: 404,
          message: (rpc.cause as any).message,
        },
      }),
    ),
    false,
  );
});
