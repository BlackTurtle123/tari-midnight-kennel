import { NotSubmitted } from "./submission-errors.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TransactionBuilder,
  Network,
  resourceAddressLiteral,
  componentAddressLiteral,
  intLiteral,
} from "@tari-project/ootle";
import { Rebirths, RebirthStore } from "./rebirth.ts";
import { RejectedTransaction } from "./wallet.ts";
import {
  HALLOWEEN_REWARDS,
  rebirthInstructions,
  economyInstructions,
} from "../shared/rebirth.ts";
import { parseHalloween } from "./nft.ts";
import type { GameState } from "../shared/game.ts";

const component = `component_${"aa".repeat(32)}` as const,
  account = `component_${"bb".repeat(32)}` as const,
  resource = `resource_${"cc".repeat(32)}` as const,
  id = "dd".repeat(16);
const config = {
  component,
  resource: `resource_${"ee".repeat(32)}`,
  current: resource,
  legacy: resource,
  staking: `component_${"fa".repeat(32)}`,
  fee: 8_000_000,
};
const input = { resource, id, reward: 0 };
test("rebirth instructions match SDK workspace and address encoding, with Rust-verified NFT CBOR", () => {
  const expected = TransactionBuilder.new(Network.Esmeralda, 0)
    .callMethod(
      { componentAddress: account, methodName: "withdraw_non_fungible" },
      [
        resourceAddressLiteral(resource),
        { Literal: "8201817820" + Buffer.from(id).toString("hex") },
      ],
    )
    .saveVar("canine")
    .callMethod({ componentAddress: account, methodName: "withdraw" }, [
      resourceAddressLiteral(
        ("resource_" + "01".repeat(32)) as `resource_${string}`,
      ),
      intLiteral(8_000_000n),
    ])
    .saveVar("fee")
    .callMethod({ componentAddress: component, methodName: "begin_rebirth" }, [
      { Workspace: "canine" },
      { Workspace: "fee" },
      componentAddressLiteral(account),
    ])
    .buildUnsignedTransaction().instructions;
  assert.deepEqual(rebirthInstructions(config, account, input), expected);

  assert.throws(() =>
    rebirthInstructions(config, account, {
      ...input,
      resource: config.resource,
    }),
  );
});
function fixture(mode: "ok" | "lost" | "rejected" | "checkpoint" = "ok") {
  const dir = mkdtempSync(join(tmpdir(), "rebirth-test-")),
    store = new RebirthStore(dir);
  let sends = 0,
    owned = true;
  const state = async (): Promise<GameState> => ({
    connected: true,
    network: "Esmeralda",
    incubations: [],
    canines: owned
      ? [
          {
            id,
            resource,
            name: "PoodlOS Echelon",
            genes: "HHHHHHHH",
            variant: 3,
            generation: 0,
          },
        ]
      : [],
  });
  const chain = {
    getAccount: async () =>
      ({ account: { component_address: account } }) as Awaited<
        ReturnType<typeof import("./wallet.ts").getAccount>
      >,
    submit: async (name: string, instructions: unknown) => {
      sends++;
      assert.equal(name, "alice");
      assert.deepEqual(
        instructions,
        rebirthInstructions(config, account, input),
      );
      if (mode === "lost") throw new Error("Connection lost");
      if (mode === "checkpoint" && sends === 1)
        throw new NotSubmitted("Epoch checkpoint not ready");
      return { transaction_id: "ff".repeat(32) } as Awaited<
        ReturnType<typeof import("./wallet.ts").submit>
      >;
    },
    waitAccepted: async () => {
      if (mode === "rejected") throw new RejectedTransaction("ff".repeat(32));
      return {} as Awaited<
        ReturnType<typeof import("./wallet.ts").waitAccepted>
      >;
    },
  };
  const service = () =>
    new Rebirths(
      state,
      new RebirthStore(dir),
      chain,
      () => config,
      async (f) => f(),
    );
  return {
    service,
    dir,
    sends: () => sends,
    unown: () => {
      owned = false;
    },
  };
}
test("accepted rebirth survives restart, uses fixed owner, rejects cross-account checks and never resends", async () => {
  const f = fixture(),
    first = await f.service().confirm("alice", input);
  assert.equal(first.status, "accepted");
  f.unown();
  assert.equal((await f.service().confirm("alice", input)).status, "accepted");
  assert.equal(f.sends(), 1);
  await assert.rejects(f.service().check("bob", first.key), /not found/);
  assert.equal(f.service().list("bob").length, 0);
});
test("lost acknowledgement survives restart and blocks another rebirth", async () => {
  const f = fixture("lost");
  await assert.rejects(f.service().confirm("alice", input), /Connection lost/);
  await assert.rejects(f.service().confirm("alice", input), /acknowledgement/);
  await assert.rejects(
    f.service().confirm("alice", { ...input, id: "01".repeat(16) }),
    /previous wallet action/,
  );
  assert.equal(f.sends(), 1);
});
test("ownership is revalidated before signing, rejected receipts are explicit and journal tampering fails closed", async () => {
  const f = fixture();
  f.unown();
  await assert.rejects(
    f.service().confirm("alice", input),
    /no longer verified/,
  );
  assert.equal(f.sends(), 0);
  const reject = fixture("rejected");
  assert.equal(
    (await reject.service().confirm("alice", input)).status,
    "rejected",
  );
  const path = join(reject.dir, "rebirth-requests-v1.jsonl"),
    data = readFileSync(path, "utf8");
  appendFileSync(path, data.split("\n")[0] + "\n");
  assert.throws(() => new RebirthStore(reject.dir), /integrity failure/);
});
test("Halloween metadata retains original art identity and canine lineage without invented feline genetics", () => {
  for (let reward = 0; reward < HALLOWEEN_REWARDS.length; reward++) {
    const spec = HALLOWEEN_REWARDS[reward],
      data = {
        name: spec.name,
        original: spec.original,
        reward: String(reward),
        edition: "tari-halloween-2026",
        art_version: "arkimals-halloween-v1",
        rebirth_id: "ee".repeat(32),
        source_resource: resource,
        source_id: "str_" + id,
      };
    const parsed = parseHalloween(data, config.resource)!;
    assert.equal(parsed.name, spec.name);
    assert.equal(parsed.sourceId, id);
    assert.equal("genes" in parsed, false);
    assert.equal(
      parseHalloween({ ...data, original: "fake" }, config.resource),
      null,
    );
  }
});

test("proven pre-submission checkpoint failures can retry the same request after restart", async () => {
  const f = fixture("checkpoint");
  await assert.rejects(f.service().confirm("alice", input), /checkpoint/);
  assert.equal((await f.service().confirm("alice", input)).status, "accepted");
  assert.equal(f.sends(), 2);
  await f.service().confirm("alice", input);
  assert.equal(f.sends(), 2);
});

test("offspring IDs work throughout economy instructions without admitting unsupported collections", () => {
  const child = "ab".repeat(32);
  for (const kind of ["begin", "stake"] as const) {
    assert.ok(
      economyInstructions(config, account, { kind, resource, id: child })
        .length,
    );
    assert.throws(() =>
      economyInstructions(config, account, {
        kind,
        resource: config.resource,
        id: child,
      }),
    );
    assert.throws(() =>
      economyInstructions(config, account, {
        kind,
        resource,
        id: child + "aa",
      }),
    );
  }
  for (const kind of ["claim", "unstake"] as const) {
    assert.ok(
      economyInstructions(config, account, {
        kind,
        id: `${resource}|str_${child}`,
      }).length,
    );
    assert.throws(() =>
      economyInstructions(config, account, {
        kind,
        id: `${resource}|str_${child}aa`,
      }),
    );
  }
  const spec = HALLOWEEN_REWARDS[0];
  assert.equal(
    parseHalloween(
      {
        name: spec.name,
        original: spec.original,
        reward: "0",
        edition: "tari-halloween-2026",
        art_version: "arkimals-halloween-v1",
        rebirth_id: "cd".repeat(32),
        source_resource: resource,
        source_id: "str_" + child,
      },
      config.resource,
    )?.sourceId,
    child,
  );
});

test("incubated and bred canines route staking and rebirth to the same shared economy", () => {
  const unified = { ...config, offspring: "resource_" + "ee".repeat(32) };
  for (const source of [unified.current, unified.legacy, unified.offspring]) {
    for (const kind of ["stake", "begin"] as const) {
      const instructions = economyInstructions(unified, account, {
        kind,
        resource: source,
        id,
      });
      const last = instructions.at(-1)!;
      assert.ok(typeof last === "object" && "CallMethod" in last);
      assert.deepEqual(last.CallMethod.call, {
        Address: kind === "stake" ? unified.staking : unified.component,
      });
    }
  }
  assert.throws(
    () =>
      economyInstructions(unified, account, {
        kind: "stake",
        resource: "resource_" + "ff".repeat(32),
        id,
      }),
    /Unsupported canine/,
  );
});
