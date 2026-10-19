import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transfers, TransferStore } from "./transfers.ts";
import { microTari, type TransferInput } from "../shared/transfers.ts";
import type { GameState } from "../shared/game.ts";
import { TARI_RESOURCE } from "./config.ts";

const source = "component_" + "11".repeat(32),
  resource = "resource_" + "22".repeat(32),
  nft = "33".repeat(16);
const input: TransferInput = {
  destination: "otl_esm_recipient",
  asset: { kind: "tari", amount: "0.123456" },
};
function setup() {
  const directory = mkdtempSync(join(tmpdir(), "kennel-transfer-test-"));
  const calls: { method: string; request: any }[] = [];
  let result: "pending" | "accepted" | "rejected" = "accepted",
    failSubmit = false,
    failDryRun = false;
  const state: GameState = {
    connected: true,
    network: "Esmeralda",
    account: source,
    incubations: [],
    canines: [
      {
        id: nft,
        resource,
        name: "Test canine",
        variant: 0,
        genes: "EEEEEEEE",
        generation: 0,
      },
    ],
  };
  const client = {
    accountsGet: async () => ({
      account: { component_address: source },
      address: "otl_esm_sender",
    }),
    accountsGetBalances: async () => ({
      balances: [
        {
          resource_address: TARI_RESOURCE,
          balance: "3000000",
          confidential_balance: "4000000",
        },
      ],
    }),
    stealthTransfer: async (r: any) => {
      calls.push({ method: "tari", request: r });
      if (r.dry_run && failDryRun) throw new Error("Simulation rejected");
      if (!r.dry_run && failSubmit) throw new Error("Lost response");
      return { transaction_id: "44".repeat(32) };
    },
    nftTransfer: async (r: any) => {
      calls.push({ method: "nft", request: r });
      return {
        transaction_id: "55".repeat(32),
        result: { result: { Accept: {} } },
      };
    },
    waitForTransactionResult: async () => ({
      timed_out: result === "pending",
      status: result === "accepted" ? "Accepted" : "Rejected",
      result:
        result === "pending"
          ? null
          : { result: result === "accepted" ? { Accept: {} } : { Reject: {} } },
    }),
  };
  const create = () =>
    new Transfers(
      async () => client as any,
      new TransferStore(directory),
      async () => structuredClone(state),
      async (fn) => fn(),
      (a) => {
        if (!/^otl_esm_/.test(a)) throw new Error("Wrong network");
        return a;
      },
    );
  return {
    directory,
    calls,
    state,
    create,
    setResult: (r: typeof result) => {
      result = r;
    },
    loseSubmission: () => {
      failSubmit = true;
    },
    rejectDryRun: () => {
      failDryRun = true;
    },
  };
}
test("amount parsing uses exact microtari and rejects rounding, zero, exponents and negatives", () => {
  assert.equal(microTari("0.000001"), 1n);
  assert.equal(microTari("123.456789"), 123456789n);
  for (const x of [
    "0",
    "-1",
    "1e6",
    "1.0000001",
    "NaN",
    "+1",
    "01",
    "1 ",
    "99999999999",
  ])
    assert.throws(() => microTari(x));
});
test("review only simulates; explicit confirmation binds exact destination, amount and source; retries never send twice", async () => {
  const f = setup(),
    service = f.create();
  const review = await service.prepare("alice", input);
  assert.equal(review.status, "prepared");
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].request.dry_run, true);
  const accepted = await service.confirm("alice", review.id);
  assert.equal(accepted.status, "accepted");
  assert.equal(
    f.calls[1].request.transfers[0].destination_address,
    input.destination,
  );
  assert.equal(f.calls[1].request.transfers[0].blinded_output_amount, "123456");
  assert.deepEqual(f.calls[1].request.owner_account, { Name: "alice" });
  assert.equal(f.calls[1].request.max_fee, 1000000);
  await f.create().confirm("alice", review.id);
  assert.equal(f.calls.filter((c) => !c.request.dry_run).length, 1);
  assert.equal(service.list("bob").length, 0);
  await assert.rejects(service.confirm("bob", review.id), /not found/);
  assert.equal("accountName" in accepted, false);
});
test("lost acknowledgement survives restart and blocks all new sends without duplicating", async () => {
  const f = setup(),
    service = f.create();
  const review = await service.prepare("alice", input);
  f.loseSubmission();
  const uncertain = await service.confirm("alice", review.id);
  assert.equal(uncertain.status, "submitting");
  assert.match(uncertain.error!, /reconciliation/);
  const restarted = f.create();
  await restarted.confirm("alice", review.id);
  await restarted.check("alice", review.id);
  await assert.rejects(restarted.prepare("alice", input), /previous transfer/);
  assert.equal(f.calls.filter((c) => !c.request.dry_run).length, 1);
  const history = readFileSync(
    join(f.directory, "wallet-transfers-v1.jsonl"),
    "utf8",
  )
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l).record.status);
  assert.deepEqual(history, ["prepared", "submitting", "submitting"]);
});
test("pending receipt resumes after restart; a confirmed rejection is not mislabeled successful", async () => {
  const f = setup(),
    service = f.create(),
    review = await service.prepare("alice", input);
  f.setResult("pending");
  assert.equal((await service.confirm("alice", review.id)).status, "submitted");
  f.setResult("rejected");
  assert.equal((await f.create().check("alice", review.id)).status, "rejected");
  assert.equal(f.calls.filter((c) => !c.request.dry_run).length, 1);
});
test("NFT transfer checks current ownership and uses only the selected token and sender fee account", async () => {
  const f = setup(),
    service = f.create();
  const review = await service.prepare("alice", {
    destination: input.destination,
    asset: { kind: "canine", id: nft, resource },
  });
  await service.confirm("alice", review.id);
  assert.equal(f.calls[1].method, "nft");
  assert.deepEqual(f.calls[1].request.nfts, [{ String: nft }]);
  assert.deepEqual(f.calls[1].request.fee_payer_account, { Name: "alice" });
  assert.equal(f.calls[1].request.target_account_address, input.destination);
  const second = await service.prepare("alice", {
    destination: input.destination,
    asset: { kind: "canine", id: nft, resource },
  });
  f.state.canines = [];
  await assert.rejects(service.confirm("alice", second.id), /not held/);
  assert.equal(f.calls.filter((c) => !c.request.dry_run).length, 1);
});
test("wrong network, self-send, insufficient reserve, pending incubation and failed simulation never send", async () => {
  const f = setup(),
    service = f.create();
  await assert.rejects(
    service.prepare("alice", { ...input, destination: "otl_igor_wrong" }),
    /network/,
  );
  await assert.rejects(
    service.prepare("alice", { ...input, destination: "otl_esm_sender" }),
    /different/,
  );
  await assert.rejects(
    service.prepare("alice", {
      ...input,
      asset: { kind: "tari", amount: "7" },
    }),
    /fee/,
  );
  f.state.incubations = [
    { id: nft, door: 0, stage: "ready", commitment: "", createdAt: "" },
  ];
  await assert.rejects(service.prepare("alice", input), /Finish/);
  f.state.incubations = [];
  f.setResult("pending");
  await assert.rejects(
    service.prepare("alice", input),
    /simulation did not succeed/,
  );
  f.setResult("rejected");
  await assert.rejects(
    service.prepare("alice", input),
    /simulation did not succeed/,
  );
  f.setResult("accepted");
  f.rejectDryRun();
  await assert.rejects(service.prepare("alice", input), /Simulation/);
  assert.equal(f.calls.filter((c) => !c.request.dry_run).length, 0);
  assert.equal(service.list("alice").length, 0);
});
