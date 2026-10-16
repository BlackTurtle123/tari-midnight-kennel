import {
  mkdirSync,
  existsSync,
  readFileSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { WalletDaemonClient } from "@tari-project/wallet_jrpc_client";
import { DATA_DIR, TARI_RESOURCE } from "./config.ts";

type Client = Pick<
  WalletDaemonClient,
  | "accountsGet"
  | "accountsGetBalances"
  | "stealthTransfer"
  | "waitForTransactionResult"
>;
interface Activation {
  owner: string;
  stage: "submitting" | "submitted" | "accepted" | "ready" | "rejected";
  transactionId?: string;
  amount: string;
}
// Durable submission intent prevents duplicate self-transfers after timeout/restart.
export class ActivationStore {
  private records = new Map<string, Activation>();
  private tail = "";
  private path: string;
  constructor(directory = DATA_DIR) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.path = join(directory, "account-activation.jsonl");
    if (existsSync(this.path))
      for (const line of readFileSync(this.path, "utf8")
        .split("\n")
        .filter(Boolean)) {
        const entry = JSON.parse(line);
        const { hash, ...body } = entry;
        if (body.previous !== this.tail || digest(body) !== hash)
          throw new Error("Account activation journal integrity failure");
        this.tail = hash;
        this.records.set(body.record.owner, body.record);
      }
  }
  get(owner: string) {
    return this.records.get(owner);
  }
  save(record: Activation) {
    const body = {
      previous: this.tail,
      timestamp: new Date().toISOString(),
      record,
    };
    const hash = digest(body);
    const fd = openSync(this.path, "a", 0o600);
    try {
      writeSync(fd, JSON.stringify({ ...body, hash }) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.tail = hash;
    this.records.set(record.owner, structuredClone(record));
  }
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function ensureSpendableAccount(
  client: Client,
  name: string,
  store: ActivationStore,
  required = 1_000_000n,
) {
  const account = await client.accountsGet({ name_or_address: { Name: name } });
  const owner = account.account.component_address;
  let activation = store.get(owner);
  if (activation?.stage === "submitting")
    throw new Error(
      "Wallet activation acknowledgement is missing. Developer reconciliation is required; no duplicate transfer was sent.",
    );
  if (activation?.stage === "submitted") {
    await finishActivation(client, store, activation);
    activation = store.get(owner);
  }
  const balances = await client.accountsGetBalances({
    account: { Name: name },
    refresh: true,
  });
  const native = balances.balances.find(
    (b) => b.resource_address === TARI_RESOURCE,
  );
  const revealed = BigInt(native?.balance ?? 0),
    confidential = BigInt(native?.confidential_balance ?? 0);
  const refreshed = await client.accountsGet({
    name_or_address: { Name: name },
  });
  if (refreshed.account.is_confirmed_on_chain && revealed >= required) {
    if (activation?.stage === "accepted")
      store.save({ ...activation, stage: "ready" });
    return;
  }
  if (activation?.stage === "accepted")
    throw new Error(
      "Wallet activation is confirmed; waiting for the balance to sync. Check progress shortly.",
    );
  // Reveal only a small fee reserve, to the SAME wallet. No operator subsidy or external recipient.
  const amount = required + 1_000_000n - revealed;
  if (amount <= 0n)
    throw new Error(
      "Your wallet is still syncing its on-chain account. Check progress shortly.",
    );
  const fee = 50_000;
  if (confidential < amount + BigInt(fee))
    throw new Error(
      "This wallet needs test Tari for network fees. Receive test coins, then check progress to retry the same incubation.",
    );
  const request = {
    owner_account: { Name: name },
    fee_params: {
      input_selection: "PreferConfidential" as const,
      pay_fee_with_swap: null,
    },
    input_selection: "ConfidentialOnly" as const,
    resource_address: TARI_RESOURCE as `resource_${string}`,
    max_fee: fee,
    transfers: [
      {
        destination_address: account.address,
        blinded_output_amount: 0,
        revealed_output_amount: amount.toString(),
        output_memo: null,
        pay_to: "StealthPublicKey" as const,
        attach_sender_address: false,
      },
    ],
  };
  const dry = await client.stealthTransfer({ ...request, dry_run: true });
  const checked = await client.waitForTransactionResult({
    transaction_id: dry.transaction_id,
    timeout_secs: 30,
  });
  if (
    checked.timed_out ||
    !checked.result ||
    !("Accept" in checked.result.result)
  )
    throw new Error(
      "Wallet activation check did not succeed. No activation was submitted; check progress to retry.",
    );
  activation = { owner, amount: amount.toString(), stage: "submitting" };
  store.save(activation);
  const sent = await client.stealthTransfer({ ...request, dry_run: false });
  activation = {
    ...activation,
    stage: "submitted",
    transactionId: sent.transaction_id,
  };
  store.save(activation);
  await finishActivation(client, store, activation);
  const funded = await client.accountsGetBalances({
    account: { Name: name },
    refresh: true,
  });
  const active = await client.accountsGet({ name_or_address: { Name: name } });
  if (
    !active.account.is_confirmed_on_chain ||
    BigInt(
      funded.balances.find((b) => b.resource_address === TARI_RESOURCE)
        ?.balance ?? 0,
    ) < required
  )
    throw new Error(
      "Wallet activation is confirmed; waiting for the balance to sync. Check progress shortly.",
    );
  store.save({ ...activation, stage: "ready" });
}
async function finishActivation(
  client: Client,
  store: ActivationStore,
  activation: Activation,
) {
  const result = await client.waitForTransactionResult({
    transaction_id: activation.transactionId!,
    timeout_secs: 30,
  });
  if (result.timed_out || !result.result)
    throw new Error(
      "Your wallet activation is still confirming. Check progress to resume the same transaction.",
    );
  if (result.status !== "Accepted" || !("Accept" in result.result.result)) {
    store.save({ ...activation, stage: "rejected" });
    throw new Error(
      "Wallet activation was rejected. Check progress to retry after checking your test balance.",
    );
  }
  store.save({ ...activation, stage: "accepted" });
}
