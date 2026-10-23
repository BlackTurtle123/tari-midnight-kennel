import {
  missingSubstateError,
  checkpointNotReadyError,
  NotSubmitted,
} from "./submission-errors.ts";
import { WalletDaemonClient } from "@tari-project/wallet_jrpc_client";
import { TransactionBuilder, Network } from "@tari-project/ootle";
import type {
  InstructionArg,
  ComponentAddress,
  PublishedTemplateAddress,
} from "@tari-project/ootle-ts-bindings";
import { WALLET_URL } from "./config.ts";

let connection: Promise<WalletDaemonClient> | undefined;
let refresh: Promise<void> | undefined;
let authenticateAfter = 0;
async function authenticate(client: WalletDaemonClient) {
  if (process.env.TARI_WALLET_TOKEN) {
    client.setToken(process.env.TARI_WALLET_TOKEN);
    return;
  }
  if (!refresh)
    refresh = (async () => {
      const token = await client.authRequest(["Admin"], "None");
      client.setToken(token);
      let expires = Date.now() + 60_000;
      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString(),
        );
        if (typeof payload.exp === "number") expires = payload.exp * 1000;
      } catch {
        /* Short refresh interval if token format changes. */
      }
      authenticateAfter = Math.max(Date.now(), expires - 60_000);
    })().finally(() => {
      refresh = undefined;
    });
  await refresh;
}
export async function wallet(): Promise<WalletDaemonClient> {
  if (!connection)
    connection = (async () => {
      const url = new URL(WALLET_URL);
      if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
        throw new Error("This PoC connects only to a local test wallet");
      const client = WalletDaemonClient.usingFetchTransport(WALLET_URL);
      // Node fetch has no browser cookie jar for the SDK's automatic auth.refresh.
      client.setReauthenticationEnabled(false);
      await authenticate(client);
      const info = await client.walletGetInfo();
      if (info.network_byte !== 0x26)
        throw new Error("Esmeralda testnet is required; mainnet is refused");
      return client;
    })().catch((e) => {
      connection = undefined;
      throw e;
    });
  const client = await connection;
  if (!process.env.TARI_WALLET_TOKEN && Date.now() >= authenticateAfter)
    await authenticate(client);
  return client;
}
export async function getAccount(name: string) {
  return (await wallet()).accountsGet({ name_or_address: { Name: name } });
}
export async function waitAccepted(transactionId: string) {
  const result = await (
    await wallet()
  ).waitForTransactionResult({
    transaction_id: transactionId,
    timeout_secs: 30,
  });
  if (result.timed_out || !result.result)
    throw new PendingTransaction(transactionId);
  if (result.status !== "Accepted" || !("Accept" in result.result.result))
    throw new RejectedTransaction(transactionId);
  return result;
}
export class RejectedTransaction extends Error {
  constructor(public transactionId: string) {
    super(
      `Transaction ${transactionId} was rejected. Retry after checking the wallet balance.`,
    );
  }
}
export class PendingTransaction extends Error {
  constructor(public transactionId: string) {
    super(
      "Transaction is still confirming. Resume this incubation to check again.",
    );
  }
}
export function callInstructions(
  component: string,
  method: string,
  args: InstructionArg[],
) {
  return TransactionBuilder.new(Network.Esmeralda, 0)
    .callMethod(
      { componentAddress: component as ComponentAddress, methodName: method },
      args,
    )
    .buildUnsignedTransaction().instructions;
}
export function constructorInstructions(
  template: string,
  args: InstructionArg[],
  functionName = "new",
) {
  return TransactionBuilder.new(Network.Esmeralda, 0)
    .callFunction(
      {
        templateAddress: template as PublishedTemplateAddress,
        functionName,
      },
      args,
    )
    .buildUnsignedTransaction().instructions;
}
export async function submit(
  name: string,
  instructions: ReturnType<typeof callInstructions>,
) {
  try {
    return await (
      await wallet()
    ).submitInstruction({
      instructions,
      fee_account: { Name: name },
      max_fee: 1_000_000,
      inputs: [],
      override_inputs: true,
      new_outputs: null,
      proof_ids: [],
      min_epoch: null,
      max_epoch: null,
    });
  } catch (error) {
    if (checkpointNotReadyError(error))
      throw new NotSubmitted(
        "Tari is synchronizing its epoch checkpoint. Nothing was submitted; try again shortly.",
        { cause: error },
      );
    if (missingSubstateError(error))
      throw new NotSubmitted(
        "A required on-chain account or game component is unavailable. No transaction was submitted; check progress to retry.",
        { cause: error },
      );
    throw error;
  }
}
