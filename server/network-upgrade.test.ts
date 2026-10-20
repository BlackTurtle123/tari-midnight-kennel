import { checkpointNotReadyError } from "./submission-errors.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { liveSubstate } from "./external-chain.ts";

test("Ootle 0.47 reads only proven live substates and rejects spent or unverified answers", () => {
  const substate = { Component: {} } as never;
  assert.deepEqual(
    liveSubstate({ version: 1, verified: true, state: { up: { substate } } }),
    { substate },
  );
  assert.throws(
    () =>
      liveSubstate({
        version: 1,
        verified: false,
        state: { up: { substate } },
      }),
    /verified live/,
  );
  assert.throws(
    () => liveSubstate({ version: 1, verified: true, state: { down: {} } }),
    /verified live/,
  );
});

test("only the exact wallet pre-signing epoch-checkpoint error is safe to retry", () => {
  const message =
    "The indexer proved substate component_" +
    "a".repeat(64) +
    " at a block of Epoch(12509), but has not yet served the checkpoint that hands over to that epoch's validator set. Retry shortly, once the indexer serves it.";
  const cause = {
    method: "transactions.submit_instruction",
    code: 500,
    message,
  };
  assert.equal(checkpointNotReadyError(new Error(message, { cause })), true);
  assert.equal(checkpointNotReadyError(new Error(message)), false);
  assert.equal(
    checkpointNotReadyError(
      new Error(message, {
        cause: { ...cause, method: "transactions.wait_result" },
      }),
    ),
    false,
  );
  assert.equal(
    checkpointNotReadyError(
      new Error("Connection lost", {
        cause: { ...cause, message: "Connection lost" },
      }),
    ),
    false,
  );
});
