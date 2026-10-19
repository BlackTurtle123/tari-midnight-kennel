import { createHash, randomUUID } from "node:crypto";
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
import type { WalletDaemonClient } from "@tari-project/wallet_jrpc_client";
import type { GameState } from "../shared/game.ts";
import {
  microTari,
  type TransferInput,
  type TransferReceipt,
} from "../shared/transfers.ts";
import { DATA_DIR, TARI_RESOURCE } from "./config.ts";
import { addressOwner } from "./external-chain.ts";

type Client = Pick<
  WalletDaemonClient,
  | "accountsGet"
  | "accountsGetBalances"
  | "stealthTransfer"
  | "nftTransfer"
  | "waitForTransactionResult"
>;
interface Record extends TransferReceipt {
  accountName: string;
}
function hash(v: unknown) {
  return createHash("sha256").update(JSON.stringify(v)).digest("hex");
}
export class TransferStore {
  private records = new Map<string, Record>();
  private tail = "";
  private path: string;
  constructor(directory = DATA_DIR) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.path = join(directory, "wallet-transfers-v1.jsonl");
    if (existsSync(this.path))
      for (const line of readFileSync(this.path, "utf8")
        .split("\n")
        .filter(Boolean)) {
        const { digest, ...body } = JSON.parse(line);
        if (body.previous !== this.tail || hash(body) !== digest)
          throw new Error(
            "Transfer journal integrity failure; original preserved",
          );
        this.records.set(body.record.id, body.record);
        this.tail = digest;
      }
  }
  get(id: string) {
    const r = this.records.get(id);
    return r && structuredClone(r);
  }
  list(account: string) {
    return [...this.records.values()]
      .filter((r) => r.accountName === account)
      .map((r) => structuredClone(r));
  }
  save(record: Record) {
    const body = { previous: this.tail, at: new Date().toISOString(), record },
      digest = hash(body);
    const fd = openSync(this.path, "a", 0o600);
    try {
      writeSync(fd, JSON.stringify({ ...body, digest }) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.records.set(record.id, structuredClone(record));
    this.tail = digest;
  }
}
function view(r: Record): TransferReceipt {
  const { accountName: _, ...receipt } = r;
  return receipt;
}
export class Transfers {
  constructor(
    private client: () => Promise<Client>,
    readonly store: TransferStore,
    private state: (account: string) => Promise<GameState>,
    private serial: <T>(fn: () => Promise<T>) => Promise<T>,
    private validateAddress = addressOwner,
  ) {}
  list(account: string) {
    return this.store.list(account).reverse().map(view);
  }
  private owned(account: string, id: string) {
    const r = this.store.get(id);
    if (!r || r.accountName !== account)
      throw new Error("Transfer not found for this wallet");
    return r;
  }
  private async validate(account: string, input: TransferInput) {
    const destinationOwner = this.validateAddress(input.destination);
    const w = await this.client(),
      sender = await w.accountsGet({ name_or_address: { Name: account } });
    if (destinationOwner === this.validateAddress(sender.address))
      throw new Error("Choose a different recipient wallet");
    const state = await this.state(account);
    if (state.setupError)
      throw new Error(
        "Wallet holdings could not be verified; retry when the wallet is synced",
      );
    if (state.incubations.some((r) => r.stage !== "hatched"))
      throw new Error(
        "Finish your current incubation with this wallet before moving its assets",
      );
    if (
      this.store
        .list(account)
        .some((r) => ["submitting", "submitted"].includes(r.status))
    )
      throw new Error("Check the previous transfer before sending another");
    const balances = await w.accountsGetBalances({
      account: { Name: account },
      refresh: true,
    });
    const native = balances.balances.find(
      (b) => b.resource_address === TARI_RESOURCE,
    );
    const revealed = BigInt(native?.balance ?? 0),
      total = revealed + BigInt(native?.confidential_balance ?? 0);
    if (input.asset.kind === "tari") {
      if (total < microTari(input.asset.amount) + 1_000_000n)
        throw new Error(
          "Leave at least 1 tTARI for this transfer's maximum network fee. Transfer NFTs before sending your remaining coins.",
        );
    } else {
      const asset = input.asset;
      if (
        !state.canines.some(
          (n) => n.id === asset.id && n.resource === asset.resource,
        )
      )
        throw new Error("This canine is not held by your wallet");
      if (revealed < 1_000_000n)
        throw new Error(
          "NFT transfer needs a public fee reserve of 1 tTARI in the sending wallet",
        );
    }
    return sender.account.component_address;
  }
  private async send(r: Record, dry_run: boolean) {
    const w = await this.client();
    if (r.asset.kind === "tari")
      return w.stealthTransfer({
        owner_account: { Name: r.accountName },
        fee_params: {
          input_selection: "PreferConfidential",
          pay_fee_with_swap: null,
        },
        input_selection: "PreferConfidential",
        resource_address: TARI_RESOURCE as `resource_${string}`,
        max_fee: 1_000_000,
        dry_run,
        transfers: [
          {
            destination_address: r.destination,
            blinded_output_amount:
              r.asset.visibility === "public"
                ? "0"
                : microTari(r.asset.amount).toString(),
            revealed_output_amount:
              r.asset.visibility === "public"
                ? microTari(r.asset.amount).toString()
                : "0",
            output_memo: null,
            attach_sender_address: false,
            pay_to: "StealthPublicKey",
          },
        ],
      });
    return w.nftTransfer({
      source_account: { Name: r.accountName },
      fee_payer_account: { Name: r.accountName },
      target_account_address: r.destination,
      resource_address: r.asset.resource as `resource_${string}`,
      nfts: [{ String: r.asset.id }],
      max_fee: 1_000_000,
      dry_run,
    });
  }
  prepare(account: string, input: TransferInput) {
    return this.serial(async () => {
      const source = await this.validate(account, input);
      const r: Record = {
        ...input,
        accountName: account,
        source,
        id: randomUUID().replaceAll("-", ""),
        status: "prepared",
        maxFee: "1.000000",
        createdAt: new Date().toISOString(),
      };
      const simulated = await this.send(r, true); // Simulate the exact recipient/asset before offering confirmation.
      if ("result" in simulated) {
        const result = simulated.result;
        if (
          !result ||
          typeof result !== "object" ||
          !("result" in result) ||
          !result.result ||
          typeof result.result !== "object" ||
          !("Accept" in result.result)
        )
          throw new Error(
            "Transfer simulation was rejected; no transfer was sent",
          );
      } else {
        const checked = await (
          await this.client()
        ).waitForTransactionResult({
          transaction_id: simulated.transaction_id,
          timeout_secs: 30,
        });
        if (
          checked.timed_out ||
          !checked.result ||
          !("Accept" in checked.result.result)
        )
          throw new Error(
            "Transfer simulation did not succeed; no transfer was sent",
          );
      }
      this.store.save(r);
      return view(r);
    });
  }
  confirm(account: string, id: string) {
    return this.serial(async () => {
      const r = this.owned(account, id);
      if (r.status !== "prepared") return this.checkInside(r);
      if (Date.now() - Date.parse(r.createdAt) > 10 * 60_000)
        throw new Error("Transfer review expired; review a fresh transfer");
      await this.validate(account, r); // Recheck holdings immediately before submission.
      r.status = "submitting";
      this.store.save(r);
      try {
        const sent = await this.send(r, false);
        r.transactionId = sent.transaction_id;
        r.status = "submitted";
        this.store.save(r);
      } catch {
        r.error =
          "Submission acknowledgement is missing. Do not send again; developer reconciliation is required.";
        this.store.save(r);
        return view(r);
      }
      return this.checkInside(r);
    });
  }
  check(account: string, id: string) {
    return this.serial(() => this.checkInside(this.owned(account, id)));
  }
  private async checkInside(r: Record) {
    if (r.status !== "submitted" || !r.transactionId) return view(r);
    const result = await (
      await this.client()
    ).waitForTransactionResult({
      transaction_id: r.transactionId,
      timeout_secs: 10,
    });
    if (result.timed_out || !result.result) return view(r);
    if (result.status === "Accepted" && "Accept" in result.result.result) {
      r.status = "accepted";
      delete r.error;
    } else {
      r.status = "rejected";
      r.error =
        "Transfer rejected. Network fees may have been charged; review your balance before a new attempt.";
    }
    this.store.save(r);
    return view(r);
  }
}
