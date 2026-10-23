import { test } from "node:test";
import assert from "node:assert/strict";
import { breedingInputs, confirmedMissingParentFailure } from "../shared/breeding.ts";
const resource = "resource_" + "ab".repeat(32), account = "component_" + "cd".repeat(32);
const config = { component: account, current: resource, legacy: resource, resource, fee: 1_000_000 };
const action = { kind: "breed" as const, first: { resource, id: "01".repeat(16) }, second: { resource, id: "02".repeat(16) } };
test("breeding declares both string NFT substates, with fresh version resolution", () => {
  assert.deepEqual(breedingInputs(config, account, action), [action.first, action.second].map(p => ({ substate_id: `nft_${resource.slice(9)}_str_${p.id}`, version: null, is_write: true })));
  assert.throws(() => breedingInputs(config, account, { ...action, second: action.first }));
});
test("replacement approval needs the exact finalized fee-only failure for a selected parent", () => {
  const tx = "99".repeat(32);
  const receipt = { result: { Finalized: { final_decision: "Commit", execution_result: { finalize: {
    transaction_hash: tx, result: { AcceptFeeRejectRest: [{}, { SubstateNotFound: `At instruction #7: nft_${resource.slice(9)}_str_${action.first.id} not found` }] },
  } } } } };
  assert.equal(confirmedMissingParentFailure(receipt, tx, action), true);
  assert.equal(confirmedMissingParentFailure(receipt, "88".repeat(32), action), false);
  assert.equal(confirmedMissingParentFailure({ result: "Pending" }, tx, action), false);
  assert.equal(confirmedMissingParentFailure({}, tx, action), false);
  const accepted = structuredClone(receipt) as any;
  accepted.result.Finalized.execution_result.finalize.result = { Accept: {} };
  assert.equal(confirmedMissingParentFailure(accepted, tx, action), false);
  const other = structuredClone(receipt);
  other.result.Finalized.execution_result.finalize.result.AcceptFeeRejectRest[1] = { SubstateNotFound: "At instruction #7: vault_" + "ab".repeat(32) + " not found" };
  assert.equal(confirmedMissingParentFailure(other, tx, action), false);
});
