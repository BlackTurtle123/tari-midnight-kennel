import { createHash } from "node:crypto";
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
import { DATA_DIR, rebirthDeployment } from "./config.ts";
import {
  rebirthInstructions,
  economyInstructions,
  type EconomyAction,
  validateRebirth,
  type RebirthInput,
  type RebirthReceipt,
  type RebirthConfig,
} from "../shared/rebirth.ts";
import type { GameState } from "../shared/game.ts";
import {
  getAccount,
  submit,
  waitAccepted,
  RejectedTransaction,
} from "./wallet.ts";
import { serializeWallet } from "./wallet-queue.ts";

type Saved = RebirthReceipt & { accountName: string };
const hash = (data: unknown) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
export class RebirthStore {
  private records = new Map<string, Saved>();
  private tail = "";
  private path: string;
  constructor(directory = DATA_DIR) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.path = join(directory, "rebirth-requests-v1.jsonl");
    if (existsSync(this.path))
      for (const line of readFileSync(this.path, "utf8")
        .split("\n")
        .filter(Boolean)) {
        const { digest, ...body } = JSON.parse(line);
        if (body.previous !== this.tail || hash(body) !== digest)
          throw new Error(
            "Rebirth journal integrity failure; original preserved",
          );
        this.records.set(body.record.key, body.record);
        this.tail = digest;
      }
  }
  list(account: string) {
    return [...this.records.values()]
      .filter((r) => r.accountName === account)
      .map((r) => structuredClone(r));
  }
  get(key: string) {
    const r = this.records.get(key);
    return r && structuredClone(r);
  }
  save(record: Saved) {
    const body = { previous: this.tail, record },
      digest = hash(body);
    const fd = openSync(this.path, "a", 0o600);
    try {
      writeSync(fd, JSON.stringify({ ...body, digest }) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.records.set(record.key, structuredClone(record));
    this.tail = digest;
  }
}
function view(r: Saved): RebirthReceipt {
  const { accountName: _, ...publicRecord } = r;
  return publicRecord;
}
export class Rebirths {
  constructor(
    private state: (name: string) => Promise<GameState>,
    readonly store = new RebirthStore(),
    private chain = { getAccount, submit, waitAccepted },
    private config: () => RebirthConfig | undefined = rebirthDeployment,
    private serial = serializeWallet,
  ) {}
  list(account: string) {
    return this.store.list(account).map(view);
  }
  confirm(accountName: string, input: RebirthInput) {
    return this.act(
      accountName,
      { kind: "begin", resource: input.resource, id: input.id },
      hash([input.resource, input.id]).slice(0, 32),
    );
  }
  act(accountName: string, action: EconomyAction, nonce: string) {
    return this.serial(async () => {
      if (!/^[a-f0-9]{32}$/.test(nonce))
        throw new Error("Invalid request nonce");
      const config = this.config();
      if (!config)
        throw new Error("The economy contracts are not deployed yet");
      const key = hash([config.component, accountName, action, nonce]);
      const existing = this.store.get(key);
      if (existing) return this.checkInside(existing);
      if (
        this.store
          .list(accountName)
          .some((r) => ["submitting", "submitted"].includes(r.status))
      )
        throw new Error(
          "Check the previous wallet action before submitting another",
        );
      const state = await this.state(accountName);
      if (state.setupError)
        throw new Error("Wallet holdings are not verified yet");
      if (action.kind === "begin" || action.kind === "stake") {
        if (
          !state.canines.some(
            (c) => c.id === action.id && c.resource === action.resource,
          )
        )
          throw new Error("This canine is no longer verified in your wallet");
        if (
          action.kind === "begin" &&
          state.economy?.requests.some(
            (r) => r.token === action.id && r.resource === action.resource,
          )
        )
          throw new Error(
            "This canine already has a rebirth record in this event",
          );
      } else if (action.kind === "claim" || action.kind === "unstake") {
        if (!state.economy?.stakes.some((p) => p.id === action.id))
          throw new Error("Stake not found for this wallet");
      } else if (
        !state.economy?.requests.some(
          (r) => r.id === action.id && r.status === 0,
        )
      )
        throw new Error("Pending rebirth not found for this wallet");
      const account = (await this.chain.getAccount(accountName)).account
        .component_address;
      const instructions = economyInstructions(config, account, action);
      const r: Saved = {
        key,
        accountName,
        account,
        component: config.component,
        operation: action,
        id: action.id,
        resource: "resource" in action ? action.resource : "",
        status: "submitting",
        createdAt: new Date().toISOString(),
      };
      this.store.save(r);
      const sent = await this.chain.submit(accountName, instructions);
      r.transactionId = sent.transaction_id;
      r.status = "submitted";
      this.store.save(r);
      return this.checkInside(r);
    });
  }
  check(account: string, key: string) {
    return this.serial(async () => {
      const r = this.store.get(key);
      if (!r || r.accountName !== account)
        throw new Error("Rebirth not found for this wallet");
      return this.checkInside(r);
    });
  }
  private async checkInside(r: Saved) {
    if (r.status === "submitting")
      throw new Error(
        "Rebirth acknowledgement is missing. Developer reconciliation is required; no duplicate exchange was sent.",
      );
    if (r.status === "submitted") {
      try {
        await this.chain.waitAccepted(r.transactionId!);
        r.status = "accepted";
      } catch (error) {
        if (error instanceof RejectedTransaction) r.status = "rejected";
        else throw error;
      }
      this.store.save(r);
    }
    return view(r);
  }
}
