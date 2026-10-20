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
