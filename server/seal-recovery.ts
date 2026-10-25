import { isDeepStrictEqual } from "node:util";
import { stringLiteral } from "@tari-project/ootle";
import type { WalletTransaction } from "@tari-project/ootle-ts-bindings";
import type { WalletDaemonClient } from "@tari-project/wallet_jrpc_client";
import { OPERATOR_NAME } from "./config.ts";

// walletd may persist a signed transaction and then lose the submission reply.
// Recover its identity from exact public intent, never from time or status alone.
export function matchingSeal(
  transactions: WalletTransaction[], component: string, id: string,
  commitment: string, account: string, publicKey: string,
): string | undefined {
  const matches = transactions.filter(tx => {
    const sealed = tx.transaction.V1;
    const body = sealed.body.transaction;
    const expected = { CallMethod: {
      call: { Address: component }, method: "seal_incubation",
      args: [stringLiteral(id), stringLiteral(commitment)],
    } };
    const fee = body.fee_instructions[0];
    return !tx.is_dry_run && !body.dry_run && body.network === 0x26 &&
      body.is_seal_signer_authorized && sealed.seal_signature.public_key === publicKey &&
      body.blob_hashes.length === 0 && sealed.body.signatures.length === 0 &&
      isDeepStrictEqual(body.instructions, [expected]) && body.fee_instructions.length === 1 &&
      typeof fee === "object" && fee !== null && "CallMethod" in fee && fee.CallMethod.method === "pay_fee" &&
      isDeepStrictEqual(fee.CallMethod.args, [{ Literal: "1a000f4240" }]) &&
      isDeepStrictEqual(fee.CallMethod.call, { Address: account }) &&
      /^[a-f0-9]{64}$/.test(tx.id);
  });
  if (matches.length > 1) throw new Error("More than one saved seal matches this incubation");
  return matches[0]?.id;
}

export async function recoverSeal(
  client: Pick<WalletDaemonClient, "accountsGet" | "transactionsList">,
  component: string, id: string, commitment: string,
) {
  const { account } = await client.accountsGet({ name_or_address: { Name: OPERATOR_NAME } });
  const { transactions } = await client.transactionsList({ status: null, account: account.component_address });
  return matchingSeal(transactions, component, id, commitment, account.component_address, account.owner_public_key);
}
