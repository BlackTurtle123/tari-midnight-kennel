import { economySnapshot, breedingSnapshot } from "./external-chain.ts";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { stringLiteral } from "@tari-project/ootle";
import { intentMessage, type WalletIntent } from "../shared/external-wallet.ts";
import type { GameState } from "../shared/game.ts";
import {
  DATA_DIR,
  deployment,
  breedingDeployment,
  activeRebirthDeployment,
  recoveryRebirthDeployments,
  OPERATOR_NAME,
  TARI_RESOURCE,
  incubationTreasury,
  incubationTreasuryPending,
} from "./config.ts";
import { Journal, publicRecord, type Incubation } from "./journal.ts";
import {
  chainIncubations,
  validateExternalAccount,
  publicInventory,
  type ChainIncubation,
  incubationPayments,
} from "./external-chain.ts";
import { commitmentFor, createOpening, encodeMemo } from "./crypto.ts";
import {
  callInstructions,
  submit,
  wallet,
  waitAccepted,
  RejectedTransaction,
  PendingTransaction,
} from "./wallet.ts";
import { serializeWallet, activations } from "./wallet-queue.ts";
import { checkFeeFunds, ensureSpendableAccount, InsufficientFeeFunds } from "./account-readiness.ts";
import { NotSubmitted } from "./submission-errors.ts";
import { sameIncubationFee } from "../shared/incubation-fee.ts";

export function verifyAuthorizedIntent(
  intent: WalletIntent,
  id: string,
  signer: string,
  chain?: ChainIncubation,
) {
  const expected = createHash("sha256")
    .update(intentMessage(intent))
    .digest("hex")
    .slice(0, 32);
  if (expected !== id)
    throw new Error("Payment address does not match the signed incubation ID");
  if (
    !chain ||
    chain.id !== id ||
    chain.signer !== signer ||
    chain.owner !== intent.account ||
    chain.door !== intent.door
  )
    throw new Error(
      "Waiting for your wallet's authorized incubation to confirm on Esmeralda. Check progress shortly.",
    );
}

// Separate append-only journal. Existing wallet seeds, accounts, cookies and
// hosted incubation histories are never migrated or replaced by this service.
export class ExternalService {
  constructor(
    readonly journal = new Journal(join(DATA_DIR, "external-wallets")),
    private readonly delivery = { chainIncubations, wallet, ensureSpendableAccount, submit, waitAccepted },
  ) {}
  private busy = new Set<string>();
  config(): { component: string; resource: string; network: string; incubationFee?: import("../shared/incubation-fee.ts").IncubationFee } {
    const d = deployment();
    return { component: d.component, resource: d.resource, network: d.network, incubationFee: incubationTreasury() };
  }
  async prepare(intent: WalletIntent) {
    if (incubationTreasuryPending())
      throw new Error("New incubations are paused while the operator activates the 20 tTARI treasury. No approval or payment was requested.");
    if (intent.component !== deployment().component)
      throw new Error("Game deployment changed; reconnect your wallet");
    intentMessage(intent);
    await validateExternalAccount(intent.account, intent.paymentAddress);
    if (
      (await chainIncubations()).some(
        (r) => r.owner === intent.account && !r.hatched,
      )
    )
      throw new Error(
        "Finish the incubation already owned by this wallet first",
      );
    const fee = incubationTreasury();
    if (!sameIncubationFee(intent.fee, fee))
      throw new Error("Incubation fee changed. Reconnect to review the current price before approving.");
    if (fee) {
      // Verify the immutable fee destination before approval. The player's
      // atomic payment supplies the public reserve needed for delivery.
      await incubationPayments(fee);
      return { ok: true };
    }
    // Reserve both maximum network fees and the encrypted delivery's one
    // microTari before asking the player to approve a paid incubation.
    try {
      await checkFeeFunds(await this.delivery.wallet(), OPERATOR_NAME, 2_000_001n);
    } catch (error) {
      if (error instanceof InsufficientFeeFunds)
        throw new Error("The game's delivery wallet needs test Tari for network fees. Please try again after it is funded; no new incubation approval was requested.");
      throw new Error("Unable to check the game's delivery wallet. Please try again shortly; no new incubation approval was requested.");
    }
    return { ok: true };
  }
  async register(intent: WalletIntent, id: string) {
    if (intent.component !== deployment().component)
      throw new Error("Incorrect game deployment");
    const signer = await validateExternalAccount(
      intent.account,
      intent.paymentAddress,
    );
    const chain = (await chainIncubations()).find((r) => r.id === id);
    verifyAuthorizedIntent(intent, id, signer, chain);
    const prior = this.journal.get(id);
    if (prior) {
      if (
        prior.owner !== intent.account ||
        prior.externalAddress !== intent.paymentAddress
      )
        throw new Error("Incubation recipient is fixed");
    } else {
      if (incubationTreasuryPending())
        throw new Error("Treasury activation is pending. Your existing wallet request is preserved; do not pay again.");
      const fee = incubationTreasury();
      if (!sameIncubationFee(intent.fee, fee))
        throw new Error("This incubation needs operator review of its original approval; no additional payment was requested.");
      if (fee && (await incubationPayments(fee))[id] !== intent.account)
        throw new Error("Waiting for the same incubation's treasury payment to confirm. No additional payment was requested.");
      if (chain!.hatched || chain!.commitment)
        throw new Error(
          "This incubation needs its original recovery record; no new secret was generated",
        );
      const opening = createOpening(id);
      this.journal.save({
        id,
        owner: intent.account,
        externalAddress: intent.paymentAddress,
        door: intent.door,
        opening,
        commitment: commitmentFor(opening),
        stage: "started",
        createdAt: new Date().toISOString(),
      });
    }
    void this.launch(id);
    return publicRecord(this.journal.get(id)!);
  }
  async resume(account: string, id: string) {
    const r = this.journal.get(id);
    if (!r || r.owner !== account)
      throw new Error(
        "Reconnect the original wallet and resume its saved approval request",
      );
    // No recipient or signing keys can be changed by this public, idempotent trigger.
    void this.launch(id);
    return { ok: true };
  }
  async state(account: string): Promise<GameState> {
    const chain = (await chainIncubations()).filter((r) => r.owner === account);
    const d = deployment();
    const state: GameState = {
      connected: true,
      network: "Esmeralda",
      account,
      component: d.component,
      resource: d.resource,
      incubationFee: incubationTreasury(),
      incubationFeePending: incubationTreasuryPending(),
      rebirth: activeRebirthDeployment(),
      recoveryEconomies: recoveryRebirthDeployments().map((config) => ({
        config,
      })),
      breedingConfig: breedingDeployment(),
      canines: [],
      incubations: chain.map((c) => {
        const saved = this.journal.get(c.id);
        if (saved)
          return {
            ...publicRecord(saved),
            ...(c.hatched ? { stage: "hatched" as const } : {}),
          };
        return {
          id: c.id,
          door: c.door,
          commitment: c.commitment,
          stage: c.hatched ? "hatched" : "started",
          createdAt: "",
          error: c.hatched
            ? undefined
            : "Resume the saved wallet request in the browser that began this incubation.",
        };
      }),
    };
    try {
      Object.assign(state, await publicInventory(account));
      if (state.rebirth)
        state.economy = await economySnapshot(account, state.rebirth);
      for (const recovery of state.recoveryEconomies ?? [])
        recovery.state = await economySnapshot(account, recovery.config);
      if (state.breedingConfig)
        state.breeding = await breedingSnapshot(account);
    } catch {
      state.setupError =
        "Unable to read this wallet's public holdings. Fund and activate the account in Sapient, or retry when the indexer is available.";
    }
    return state;
  }
  private launch(id: string) {
    if (this.busy.has(id)) return;
    this.busy.add(id);
    return serializeWallet(() => this.advance(id))
      .catch((error) => {
        const r = structuredClone(this.journal.get(id)!);
        if (error instanceof NotSubmitted && r.stage === "sealing" && !r.sealTx)
          r.stage = "started";
        if (error instanceof RejectedTransaction) {
          if (r.sealTx === error.transactionId) {
            delete r.sealTx;
            r.stage = "started";
          }
          if (r.deliveryTx === error.transactionId) {
            delete r.deliveryTx;
            r.stage = "sealed";
          }
        }
        // Never reflect wallet/provider payloads: the delivery call contains a plaintext memo.
        r.error = error instanceof InsufficientFeeFunds
          ? "The game's delivery wallet needs test Tari for network fees. Your incubation is saved. Once the operator funds it, use Check progress to continue the same incubation; do not start or pay for another one."
          : error instanceof PendingTransaction
            ? "Delivery is waiting for network confirmation. Check progress to check the same transaction; it will not be submitted again."
            : error instanceof NotSubmitted || error instanceof RejectedTransaction
              ? "The last delivery step was not submitted or was rejected by the network. Check progress to retry that step of your saved incubation."
              : "Delivery needs an operator check of the saved transaction and network status. Your incubation is saved. Check progress safely; an uncertain submission will not be repeated.";
        this.journal.save(r);
      })
      .finally(() => this.busy.delete(id));
  }
  private async advance(id: string) {
    const r = structuredClone(this.journal.get(id)!);
    const c = (await this.delivery.chainIncubations()).find((c) => c.id === id);
    if (!c || c.owner !== r.owner || c.door !== r.door)
      throw new Error("Incubation mismatch");
    const save = () => {
      delete r.error;
      this.journal.save(r);
    };
    if (c.hatched) {
      r.stage = "hatched";
      save();
      return;
    }
    if (c.commitment && c.commitment !== r.commitment)
      throw new Error("Commitment mismatch");
    if (!c.commitment) {
      if (!r.sealTx) {
        if (r.stage === "sealing") throw new Error("Unknown seal submission");
        await this.delivery.ensureSpendableAccount(
          await this.delivery.wallet(),
          OPERATOR_NAME,
          activations,
        );
        r.stage = "sealing";
        save();
        r.sealTx = (
          await this.delivery.submit(
            OPERATOR_NAME,
            callInstructions(deployment().component, "seal_incubation", [
              stringLiteral(id),
              stringLiteral(r.commitment),
            ]),
          )
        ).transaction_id;
        save();
      }
      await this.delivery.waitAccepted(r.sealTx);
    }
    if (!r.deliveryTx) {
      if (r.stage === "delivering")
        throw new Error("Unknown delivery submission");
      r.stage = "sealed";
      save();
      await this.delivery.ensureSpendableAccount(await this.delivery.wallet(), OPERATOR_NAME, activations, 1_000_001n);
      r.stage = "delivering";
      save();
      r.deliveryTx = (
        await (
          await this.delivery.wallet()
        ).stealthTransfer({
          owner_account: { Name: OPERATOR_NAME },
          fee_params: {
            input_selection: "PreferRevealed",
            pay_fee_with_swap: null,
          },
          input_selection: "RevealedOnly",
          resource_address: TARI_RESOURCE as `resource_${string}`,
          max_fee: 1_000_000,
          dry_run: false,
          transfers: [
            {
              destination_address: r.externalAddress!,
              blinded_output_amount: 1,
              revealed_output_amount: "0",
              output_memo: { Message: encodeMemo(r.opening) },
              pay_to: "StealthPublicKey",
              attach_sender_address: false,
            },
          ],
        })
      ).transaction_id;
      save();
    }
    await this.delivery.waitAccepted(r.deliveryTx);
    r.stage = "ready";
    save();
  }
}
