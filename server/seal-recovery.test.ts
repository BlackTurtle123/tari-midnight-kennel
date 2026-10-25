import { test } from "node:test";
import assert from "node:assert/strict";
import { stringLiteral } from "@tari-project/ootle";
import type { WalletTransaction } from "@tari-project/ootle-ts-bindings";
import { matchingSeal } from "./seal-recovery.ts";

const component = "component_" + "ab".repeat(32), account = "component_" + "cd".repeat(32);
const id = "01".repeat(16), commitment = "02".repeat(32), publicKey = "03".repeat(32);
function transaction(): WalletTransaction {
  return { id: "04".repeat(32), status: "New", is_dry_run: false,
    transaction: { V1: { seal_signature: { public_key: publicKey }, body: { signatures: [], transaction: {
      network: 38, dry_run: false, is_seal_signer_authorized: true, blob_hashes: [],
      fee_instructions: [{ CallMethod: { call: { Address: account }, method: "pay_fee", args: [{ Literal: "1a000f4240" }] } }],
      instructions: [{ CallMethod: { call: { Address: component }, method: "seal_incubation", args: [stringLiteral(id), stringLiteral(commitment)] } }],
    } } } } } as unknown as WalletTransaction;
}
const match = (txs: WalletTransaction[]) => matchingSeal(txs, component, id, commitment, account, publicKey);

test("recover a New or rejected seal by exact public intent, never by status or time", () => {
  const tx = transaction();
  assert.equal(match([tx]), tx.id);
  tx.status = "Rejected";
  assert.equal(match([tx]), tx.id);
  assert.equal(match([]), undefined);
  assert.throws(() => match([tx, { ...tx, id: "05".repeat(32) }]), /More than one/);
});

test("wrong signer, component, commitment, extra instructions and dry runs cannot match", () => {
  for (const change of [
    (tx: WalletTransaction) => { tx.is_dry_run = true; },
    (tx: WalletTransaction) => { tx.transaction.V1.seal_signature.public_key = "06".repeat(32); },
    (tx: WalletTransaction) => { tx.transaction.V1.body.transaction.network = 1; },
    (tx: WalletTransaction) => { tx.transaction.V1.body.transaction.instructions.push(tx.transaction.V1.body.transaction.instructions[0]); },
    (tx: WalletTransaction) => { (tx.transaction.V1.body.transaction.instructions[0] as any).CallMethod.call.Address = account; },
    (tx: WalletTransaction) => { (tx.transaction.V1.body.transaction.instructions[0] as any).CallMethod.args[1] = stringLiteral("wrong"); },
  ]) {
    const tx = transaction(); change(tx); assert.equal(match([tx]), undefined);
  }
});
