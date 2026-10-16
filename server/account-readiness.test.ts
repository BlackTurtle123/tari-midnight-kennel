import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ActivationStore,
  ensureSpendableAccount,
} from "./account-readiness.ts";
import { TARI_RESOURCE } from "./config.ts";
const owner = "component_" + "a".repeat(64);
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "kennel-activation-"));
  let confirmed = false,
    revealed = 0n,
    confidential = 1_000_000_000n,
    timeout = false,
    lost = false,
    sync = true;
  const requests: any[] = [];
  const waits: string[] = [];
  const client: any = {
    accountsGet: async () => ({
      account: { component_address: owner, is_confirmed_on_chain: confirmed },
      address: "own-test-address",
    }),
    accountsGetBalances: async () => ({
      balances: [
        {
          resource_address: TARI_RESOURCE,
          balance: String(revealed),
          confidential_balance: String(confidential),
        },
      ],
    }),
    stealthTransfer: async (r: any) => {
      requests.push(r);
      if (!r.dry_run && lost) throw new Error("connection reset");
      return { transaction_id: r.dry_run ? "dry" : "actual" };
    },
    waitForTransactionResult: async ({ transaction_id: id }: any) => {
      waits.push(id);
      if (id === "actual" && timeout) return { timed_out: true };
      if (id === "actual" && sync) {
        confirmed = true;
        revealed = 3_000_000n;
      }
      return {
        status: id === "dry" ? "DryRun" : "Accepted",
        timed_out: false,
        result: { result: { Accept: {} } },
      };
    },
  };
  return {
    dir,
    client,
    requests,
    waits,
    set: (value: {
      timeout?: boolean;
      lost?: boolean;
      sync?: boolean;
      confidential?: bigint;
      revealed?: bigint;
      confirmed?: boolean;
    }) => {
      timeout = value.timeout ?? timeout;
      lost = value.lost ?? lost;
      sync = value.sync ?? sync;
      confidential = value.confidential ?? confidential;
      revealed = value.revealed ?? revealed;
      confirmed = value.confirmed ?? confirmed;
    },
  };
}
test("confidential-only account activates with a bounded self-transfer before spending", async () => {
  const f = fixture(),
    store = new ActivationStore(f.dir);
  await ensureSpendableAccount(f.client, "alice", store, 2_000_000n);
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[0].dry_run, true);
  assert.equal(f.requests[1].dry_run, false);
  assert.equal(
    f.requests[1].transfers[0].destination_address,
    "own-test-address",
  );
  assert.equal(f.requests[1].transfers[0].revealed_output_amount, "3000000");
  assert.equal(f.requests[1].max_fee, 50_000);
  assert.equal(store.get(owner)?.stage, "ready");
  await ensureSpendableAccount(
    f.client,
    "alice",
    new ActivationStore(f.dir),
    2_000_000n,
  );
  assert.equal(f.requests.length, 2);
});
test("activation timeout/restart resumes the existing receipt without transferring twice", async () => {
  const f = fixture();
  f.set({ timeout: true });
  await assert.rejects(
    ensureSpendableAccount(
      f.client,
      "alice",
      new ActivationStore(f.dir),
      2_000_000n,
    ),
    /still confirming/,
  );
  assert.equal(new ActivationStore(f.dir).get(owner)?.transactionId, "actual");
  f.set({ timeout: false });
  await ensureSpendableAccount(
    f.client,
    "alice",
    new ActivationStore(f.dir),
    2_000_000n,
  );
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.waits, ["dry", "actual", "actual"]);
});
test("lost activation acknowledgement and delayed balance sync both fail closed", async () => {
  const f = fixture();
  f.set({ lost: true });
  await assert.rejects(
    ensureSpendableAccount(f.client, "alice", new ActivationStore(f.dir)),
    /connection reset/,
  );
  f.set({ lost: false });
  await assert.rejects(
    ensureSpendableAccount(f.client, "alice", new ActivationStore(f.dir)),
    /acknowledgement/,
  );
  assert.equal(f.requests.length, 2);
  const delayed = fixture();
  delayed.set({ sync: false });
  await assert.rejects(
    ensureSpendableAccount(
      delayed.client,
      "bob",
      new ActivationStore(delayed.dir),
    ),
    /waiting for the balance/,
  );
  await assert.rejects(
    ensureSpendableAccount(
      delayed.client,
      "bob",
      new ActivationStore(delayed.dir),
    ),
    /waiting for the balance/,
  );
  assert.equal(delayed.requests.length, 2);
});
test("unfunded wallets do not submit or leave an activation marker; ready wallets need no transfer", async () => {
  const f = fixture();
  f.set({ confidential: 0n });
  const store = new ActivationStore(f.dir);
  await assert.rejects(
    ensureSpendableAccount(f.client, "alice", store),
    /needs test Tari/,
  );
  assert.equal(store.get(owner), undefined);
  assert.equal(f.requests.length, 0);
  f.set({ revealed: 2_000_000n, confirmed: true });
  await ensureSpendableAccount(f.client, "alice", store);
  assert.equal(f.requests.length, 0);
});
