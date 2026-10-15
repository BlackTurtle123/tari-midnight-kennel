import { parseCanine } from "./nft.ts";
import {
  stringLiteral,
  componentAddressLiteral,
  intLiteral,
} from "@tari-project/ootle";
import type { ResourceAddress } from "@tari-project/ootle-ts-bindings";
import {
  VARIANTS,
  type Canine,
  type Opening,
  type GameState,
} from "../shared/game.ts";
import {
  createOpening,
  commitmentFor,
  decodeMemo,
  encodeMemo,
} from "./crypto.ts";
import { Journal, publicRecord, type Incubation } from "./journal.ts";
import {
  wallet,
  getAccount,
  submit,
  callInstructions,
  waitAccepted,
  RejectedTransaction,
} from "./wallet.ts";
import {
  deployment,
  OPERATOR_NAME,
  PLAYER_NAME,
  TARI_RESOURCE,
} from "./config.ts";

const sharedJournal = new Journal();
const busyIncubations = new Set<string>();
let walletQueue: Promise<unknown> = Promise.resolve();
export class GameService {
  constructor(
    private readonly playerName = PLAYER_NAME,
    readonly journal = sharedJournal,
  ) {}
  private busy = busyIncubations;

  async state(): Promise<GameState> {
    const player = await getAccount(this.playerName);
    const base: GameState = {
      connected: true,
      network: "Esmeralda",
      account: player.account.component_address,
      paymentAddress: player.address,
      incubations: this.journal
        .list(player.account.component_address)
        .map(publicRecord),
      canines: [],
    };
    const w = await wallet();
    const balances = await w.accountsGetBalances({
      account: { Name: this.playerName },
      refresh: false,
    });
    const native = balances.balances.find(
      (b) => b.resource_address === TARI_RESOURCE,
    );
    base.balance = (
      (Number(native?.balance ?? 0) +
        Number(native?.confidential_balance ?? 0)) /
      1_000_000
    ).toFixed(3);
    try {
      const d = deployment();
      base.component = d.component;
      base.resource = d.resource;
      for (let offset = 0; ; offset += 100) {
        const page = await w.nftsList({
          account: { Name: this.playerName },
          limit: 100,
          offset,
        });
        for (const nft of page.nfts) {
          if (nft.is_burnt || nft.resource_address !== d.resource) continue;
          const canine = parseCanine(nft.data, d.resource);
          if (canine) base.canines.push(canine);
        }
        if (page.nfts.length < 100) break;
      }
    } catch (error) {
      base.setupError = message(error);
    }
    return base;
  }

  async start(door: number, clientId: string) {
    deployment();
    const owner = (await getAccount(this.playerName)).account.component_address;
    const existing = this.journal.get(clientId);
    if (existing) {
      if (existing.owner !== owner || existing.door !== door)
        throw new Error("Request ID belongs to another incubation");
      this.launch(existing.id);
      return publicRecord(existing);
    }
    if (
      this.journal.list(owner).filter((r) => r.stage !== "hatched").length >= 1
    )
      throw new Error("Finish your current incubation before starting another");
    const opening = createOpening(clientId);
    const record: Incubation = {
      id: clientId,
      door,
      owner,
      opening,
      commitment: commitmentFor(opening),
      stage: "reserved",
      createdAt: new Date().toISOString(),
    };
    this.journal.save(record);
    this.launch(record.id);
    return publicRecord(record);
  }

  async resume(id: string) {
    await this.owned(id);
    this.launch(id);
  }
  private launch(id: string) {
    if (this.busy.has(id)) return;
    this.busy.add(id);
    // Serialize wallet writes; avoid competing fee inputs from parallel operations.
    const run = walletQueue.catch(() => undefined).then(() => this.advance(id));
    walletQueue = run;
    void run
      .catch((e) => this.recordFailure(id, e))
      .finally(() => this.busy.delete(id));
  }

  private async advance(id: string) {
    let r = structuredClone(this.journal.get(id)!);
    if (r.stage === "hatched") return;
    const d = deployment();
    const save = () => {
      delete r.error;
      this.journal.save(r);
    };
    if (!r.startTx) {
      if (r.stage === "starting")
        throw new Error(
          "Submission acknowledgement was lost. Developer reconciliation is required before retrying; no duplicate request was sent.",
        );
      r.stage = "starting";
      save();
      const sent = await submit(
        this.playerName,
        callInstructions(d.component, "begin_incubation", [
          stringLiteral(r.id),
          componentAddressLiteral(r.owner),
          intLiteral(BigInt(r.door)),
        ]),
      );
      r.startTx = sent.transaction_id;
      save();
    }
    await waitAccepted(r.startTx);
    if (!r.sealTx) {
      if (r.stage === "sealing")
        throw new Error(
          "Seal acknowledgement was lost. Developer reconciliation is required before retrying.",
        );
      r.stage = "sealing";
      save();
      const sent = await submit(
        OPERATOR_NAME,
        callInstructions(d.component, "seal_incubation", [
          stringLiteral(r.id),
          stringLiteral(r.commitment),
        ]),
      );
      r.sealTx = sent.transaction_id;
      save();
    }
    await waitAccepted(r.sealTx);
    if (!r.deliveryTx) {
      if (r.stage === "delivering")
        throw new Error(
          "Secret delivery acknowledgement was lost. Developer reconciliation is required before retrying.",
        );
      r.stage = "delivering";
      save();
      const player = await getAccount(this.playerName);
      const result = await (
        await wallet()
      ).stealthTransfer({
        owner_account: { Name: OPERATOR_NAME },
        fee_params: {
          input_selection: "PreferRevealed",
          pay_fee_with_swap: null,
        },
        input_selection: "RevealedOnly",
        resource_address: TARI_RESOURCE as ResourceAddress,
        max_fee: 1_000_000,
        dry_run: false,
        transfers: [
          {
            destination_address: player.address,
            blinded_output_amount: 1,
            revealed_output_amount: "0",
            output_memo: { Message: encodeMemo(r.opening) },
            pay_to: "StealthPublicKey",
            attach_sender_address: false,
          },
        ],
      });
      r.deliveryTx = result.transaction_id;
      save();
    }
    await waitAccepted(r.deliveryTx);
    r.stage = "ready";
    save();
    if (r.hatchTx) {
      await waitAccepted(r.hatchTx);
      r.stage = "hatched";
      save();
    }
  }

  private recordFailure(id: string, error: unknown) {
    const record = structuredClone(this.journal.get(id)!);
    if (error instanceof RejectedTransaction) {
      const resets = {
        startTx: "reserved",
        sealTx: "started",
        deliveryTx: "sealed",
        hatchTx: "ready",
      } as const;
      for (const [key, stage] of Object.entries(resets)) {
        const field = key as keyof typeof resets;
        if (record[field] === error.transactionId) {
          delete record[field];
          record.stage = stage;
        }
      }
    }
    record.error = message(error);
    this.journal.save(record);
  }

  private async owned(id: string) {
    const r = this.journal.get(id);
    const owner = (await getAccount(this.playerName)).account.component_address;
    if (!r || r.owner !== owner)
      throw new Error("Incubation not found for this account");
    return r;
  }

  async preview(id: string): Promise<Opening> {
    const r = await this.owned(id);
    if (!r.deliveryTx) throw new Error("Your secret is still being delivered");
    const result = await (
      await wallet()
    ).stealthUtxosList({
      resource_address: TARI_RESOURCE as ResourceAddress,
      account_address: r.owner as `component_${string}`,
      filter_by_status: null,
    });
    for (const utxo of result.utxos) {
      if (!utxo.is_on_chain || !utxo.memo || !("Message" in utxo.memo))
        continue;
      const opening = decodeMemo(utxo.memo.Message);
      if (opening?.id === id && commitmentFor(opening) === r.commitment)
        return opening;
    }
    // Never fall back to the operator's stored plaintext. The memo must reach the wallet.
    throw new Error(
      "The wallet is still scanning for your encrypted secret. Try opening it again shortly.",
    );
  }

  async hatch(id: string) {
    if (this.busy.has(id))
      throw new Error("This incubation is still processing");
    this.busy.add(id);
    const run = walletQueue
      .catch(() => undefined)
      .then(async () => {
        const r = structuredClone(await this.owned(id));
        if (r.stage === "hatched") return publicRecord(r);
        if (!r.hatchTx) {
          if (r.stage === "hatching")
            throw new Error(
              "Hatch acknowledgement was lost. Developer reconciliation is required before retrying.",
            );
          const o = await this.preview(id);
          r.stage = "hatching";
          delete r.error;
          this.journal.save(r);
          const sent = await submit(
            this.playerName,
            callInstructions(deployment().component, "hatch", [
              stringLiteral(id),
              intLiteral(BigInt(o.variant)),
              stringLiteral(o.salt),
            ]),
          );
          r.hatchTx = sent.transaction_id;
          this.journal.save(r);
        }
        await waitAccepted(r.hatchTx);
        r.stage = "hatched";
        delete r.error;
        this.journal.save(r);
        await (
          await wallet()
        ).accountsGetBalances({
          account: { Name: this.playerName },
          refresh: true,
        });
        return publicRecord(r);
      });
    walletQueue = run;
    try {
      return await run;
    } catch (e) {
      if (this.journal.get(id)) this.recordFailure(id, e);
      throw e;
    } finally {
      this.busy.delete(id);
    }
  }
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "Operation failed";
}
