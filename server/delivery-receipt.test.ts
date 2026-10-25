import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryCommitments } from "./delivery-receipt.ts";
const tx = "ab".repeat(32), output = "cd".repeat(32);
function accepted() {
  return { transaction_id: tx, status: "Accepted", timed_out: false, result: {
    transaction_hash: tx, logs: ["not public"], result: { Accept: { up_substates: [
      ["utxo_" + "01".repeat(32) + "_" + output, { substate: { Utxo: { encrypted_data: "not returned" } }, version: 0 }],
      ["vault_" + "ef".repeat(32), { substate: { Vault: {} }, version: 3 }],
    ] } },
  } };
}
test("delivery recovery returns only native output commitments from the exact accepted receipt", () => {
  assert.deepEqual(deliveryCommitments(accepted(), tx), [output]);
  assert.throws(() => deliveryCommitments(accepted(), "00".repeat(32)));
  const other = accepted(); other.result.transaction_hash = "11".repeat(32);
  assert.throws(() => deliveryCommitments(other, tx));
  assert.throws(() => deliveryCommitments({ ...accepted(), status: "Rejected" }, tx));
  assert.throws(() => deliveryCommitments({ ...accepted(), timed_out: true }, tx));
  const absent = accepted(); absent.result.result.Accept.up_substates = [];
  assert.throws(() => deliveryCommitments(absent, tx));
});
