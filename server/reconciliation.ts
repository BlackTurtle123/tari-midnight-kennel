import type { WalletDaemonClient } from "@tari-project/wallet_jrpc_client";
import type { Journal, Incubation } from "./journal.ts";
import type { Deployment } from "./config.ts";
export function recoverableMissingAccount(history: Incubation[]): boolean {
  const current = history.at(-1);
  if (
    !current ||
    current.stage !== "starting" ||
    current.startTx ||
    current.sealTx ||
    current.deliveryTx ||
    current.hatchTx
  )
    return false;
  let marker = -1;
  for (let i = history.length - 1; i >= 0; i--)
    if (history[i].stage === "starting" && !history[i].error) {
      marker = i;
      break;
    }
  if (marker < 0) return false;
  const failed = history[marker + 1];
  const expected = `RPC Error 404: Application error: 404: Not found: Substate ${current.owner} does not exist`;
  if (failed?.error !== expected) return false;
  return history
    .slice(marker)
    .every(
      (r) =>
        r.stage === "starting" &&
        !r.startTx &&
        !r.sealTx &&
        !r.deliveryTx &&
        !r.hatchTx &&
        r.owner === current.owner &&
        r.commitment === current.commitment &&
        JSON.stringify(r.opening) === JSON.stringify(current.opening),
    );
}
export async function reconcileMissingAccount(
  client: Pick<WalletDaemonClient, "transactionsList" | "substatesGet">,
  journal: Journal,
  record: Incubation,
  deployed: Deployment,
) {
  if (!recoverableMissingAccount(journal.recordsFor(record.id))) return record;
  const transactions = await client.transactionsList({
    account: record.owner as `component_${string}`,
    status: null,
  });
  const encodedId = Buffer.from(record.id).toString("hex");
  for (const tx of transactions.transactions) {
    if (!tx.transaction || !("V1" in tx.transaction))
      throw new Error(
        "Unrecognized wallet receipt; automatic reconciliation stopped.",
      );
    const contents = JSON.stringify(tx.transaction);
    if (contents.includes(record.id) || contents.includes(encodedId))
      throw new Error(
        "An incubation receipt may exist. Developer reconciliation is required; no duplicate was sent.",
      );
  }
  const response = await client.substatesGet({
    substate_id: deployed.component,
  });
  const remote = response.substate_from_remote?.substate;
  if (!remote || !("Component" in remote))
    throw new Error("Unable to verify incubation state; retry later.");
  const component = remote.Component;
  const state = component.body.state;
  if (
    component.header.template_address !==
      deployed.template.replace(/^template_/, "") ||
    !Array.isArray(state) ||
    state.length !== 6 ||
    !state[2] ||
    typeof state[2] !== "object" ||
    Array.isArray(state[2]) ||
    "@cbor" in state[2]
  )
    throw new Error(
      "Unrecognized incubation state; automatic reconciliation stopped.",
    );
  if (Object.hasOwn(state[2], record.id))
    throw new Error(
      "This incubation already exists on chain. Developer reconciliation is required; no duplicate was sent.",
    );
  const recovered = {
    ...record,
    stage: "reserved" as const,
    reconciliation: {
      at: new Date().toISOString(),
      reason:
        "Verified account-missing pre-submission failure; no wallet receipt or on-chain request",
    },
  };
  delete recovered.error;
  journal.save(recovered);
  return recovered;
}
