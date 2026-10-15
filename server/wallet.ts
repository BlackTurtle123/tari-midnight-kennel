import { WalletDaemonClient } from '@tari-project/wallet_jrpc_client';
import { TransactionBuilder, Network } from '@tari-project/ootle';
import type { InstructionArg, ComponentAddress, PublishedTemplateAddress } from '@tari-project/ootle-ts-bindings';
import { WALLET_URL } from './config.ts';

let connection: Promise<WalletDaemonClient> | undefined;
export async function wallet(): Promise<WalletDaemonClient> {
  if (!connection) connection = (async () => {
    const url = new URL(WALLET_URL);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('This PoC connects only to a local test wallet');
    const client = WalletDaemonClient.usingFetchTransport(WALLET_URL);
    if (process.env.TARI_WALLET_TOKEN) client.setToken(process.env.TARI_WALLET_TOKEN);
    else client.setToken(await client.authRequest(['Admin'], 'None'));
    const info = await client.walletGetInfo();
    if (info.network_byte !== 0x26) throw new Error('Esmeralda testnet is required; mainnet is refused');
    return client;
  })().catch(e => { connection = undefined; throw e; });
  return connection;
}
export async function getAccount(name: string) { return (await wallet()).accountsGet({ name_or_address: { Name: name } }); }
export async function waitAccepted(transactionId: string) {
  const result = await (await wallet()).waitForTransactionResult({ transaction_id: transactionId, timeout_secs: 30 });
  if (result.timed_out || !result.result) throw new PendingTransaction(transactionId);
  if (result.status !== 'Accepted' || !('Accept' in result.result.result)) throw new Error(`Transaction ${transactionId} did not commit: ${JSON.stringify(result.result.result)}`);
  return result;
}
export class PendingTransaction extends Error { constructor(public transactionId: string) { super('Transaction is still confirming. Resume this incubation to check again.'); } }
export function callInstructions(component: string, method: string, args: InstructionArg[]) {
  return TransactionBuilder.new(Network.Esmeralda, 0).callMethod({ componentAddress: component as ComponentAddress, methodName: method }, args).buildUnsignedTransaction().instructions;
}
export function constructorInstructions(template: string, args: InstructionArg[]) {
  return TransactionBuilder.new(Network.Esmeralda, 0).callFunction({ templateAddress: template as PublishedTemplateAddress, functionName: 'new' }, args).buildUnsignedTransaction().instructions;
}
export async function submit(name: string, instructions: ReturnType<typeof callInstructions>) {
  return (await wallet()).submitInstruction({ instructions, fee_account: { Name: name }, max_fee: 1_000_000, inputs: [], override_inputs: true, new_outputs: null, proof_ids: [], min_epoch: null, max_epoch: null });
}
