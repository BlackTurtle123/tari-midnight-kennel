import { randomBytes } from 'node:crypto';
import { stringLiteral, componentAddressLiteral, intLiteral } from '@tari-project/ootle';
import type { ResourceAddress } from '@tari-project/ootle-ts-bindings';
import { VARIANTS, type Canine, type Opening, type GameState } from '../shared/game.ts';
import { createOpening, commitmentFor, decodeMemo, encodeMemo } from './crypto.ts';
import { Journal, publicRecord, type Incubation } from './journal.ts';
import { wallet, getAccount, submit, callInstructions, waitAccepted } from './wallet.ts';
import { deployment, OPERATOR_NAME, PLAYER_NAME, TARI_RESOURCE } from './config.ts';

export class GameService {
  readonly journal = new Journal();
  private busy = new Set<string>();
  private walletQueue: Promise<unknown> = Promise.resolve();

  async state(): Promise<GameState> {
    const player = await getAccount(PLAYER_NAME);
    const base: GameState = { connected: true, network: 'Esmeralda', account: player.account.component_address, paymentAddress: player.address, incubations: this.journal.list(player.account.component_address).map(publicRecord), canines: [] };
    const w = await wallet();
    const balances = await w.accountsGetBalances({ account: { Name: PLAYER_NAME }, refresh: false });
    const native = balances.balances.find(b => b.resource_address === TARI_RESOURCE);
    base.balance = ((Number(native?.balance ?? 0) + Number(native?.confidential_balance ?? 0)) / 1_000_000).toFixed(3);
    try {
      const d = deployment(); base.component = d.component; base.resource = d.resource;
      for (let offset = 0; ; offset += 100) {
        const page = await w.nftsList({ account: { Name: PLAYER_NAME }, limit: 100, offset });
        for (const nft of page.nfts) {
          if (nft.is_burnt || nft.resource_address !== d.resource) continue;
          const data = nft.data as unknown as Record<string, string>;
          const variant = Number(data.variant);
          if (!Number.isInteger(variant) || !VARIANTS[variant] || !data.incubation_id) continue;
          base.canines.push({ id: data.incubation_id, variant, name: data.name, genes: data.genes, generation: Number(data.generation), resource: d.resource } satisfies Canine);
        }
        if (page.nfts.length < 100) break;
      }
    } catch (error) { base.setupError = message(error); }
    return base;
  }

  async start(door: number, clientId: string) {
    deployment();
    const owner = (await getAccount(PLAYER_NAME)).account.component_address;
    const existing = this.journal.get(clientId);
    if (existing) {
      if (existing.owner !== owner || existing.door !== door) throw new Error('Request ID belongs to another incubation');
      this.launch(existing.id); return publicRecord(existing);
    }
    if (this.journal.list(owner).filter(r => r.stage !== 'hatched').length >= 1) throw new Error('Finish your current incubation before starting another');
    const opening = createOpening(clientId);
    const record: Incubation = { id: clientId, door, owner, opening, commitment: commitmentFor(opening), stage: 'reserved', createdAt: new Date().toISOString() };
    this.journal.save(record); this.launch(record.id); return publicRecord(record);
  }

  async resume(id: string) { await this.owned(id); this.launch(id); }
  private launch(id: string) {
    if (this.busy.has(id)) return;
    this.busy.add(id);
    // Serialize wallet writes; avoid competing fee inputs from parallel operations.
    const run = this.walletQueue.catch(() => undefined).then(() => this.advance(id));
    this.walletQueue = run;
    void run.catch(e => { const record = this.journal.get(id)!; this.journal.save({ ...record, error: message(e) }); }).finally(() => this.busy.delete(id));
  }

  private async advance(id: string) {
    let r = structuredClone(this.journal.get(id)!);
    if (r.stage === 'hatched') return;
    const d = deployment();
    const save = () => { delete r.error; this.journal.save(r); };
    if (!r.startTx) {
      r.stage = 'starting'; save();
      const sent = await submit(PLAYER_NAME, callInstructions(d.component, 'begin_incubation', [stringLiteral(r.id), componentAddressLiteral(r.owner), intLiteral(BigInt(r.door))]));
      r.startTx = sent.transaction_id; save();
    }
    await waitAccepted(r.startTx);
    if (!r.sealTx) {
      r.stage = 'sealing'; save();
      const sent = await submit(OPERATOR_NAME, callInstructions(d.component, 'seal_incubation', [stringLiteral(r.id), stringLiteral(r.commitment)]));
      r.sealTx = sent.transaction_id; save();
    }
    await waitAccepted(r.sealTx);
    if (!r.deliveryTx) {
      r.stage = 'delivering'; save();
      const player = await getAccount(PLAYER_NAME);
      const result = await (await wallet()).stealthTransfer({
        owner_account: { Name: OPERATOR_NAME },
        fee_params: { input_selection: 'PreferRevealed', pay_fee_with_swap: null },
        input_selection: 'RevealedOnly', resource_address: TARI_RESOURCE as ResourceAddress,
        max_fee: 1_000_000, dry_run: false,
        transfers: [{ destination_address: player.address, blinded_output_amount: 1, revealed_output_amount: '0', output_memo: { Message: encodeMemo(r.opening) }, pay_to: 'StealthPublicKey', attach_sender_address: false }],
      });
      r.deliveryTx = result.transaction_id; save();
    }
    await waitAccepted(r.deliveryTx);
    r.stage = 'ready'; save();
    if (r.hatchTx) { await waitAccepted(r.hatchTx); r.stage = 'hatched'; save(); }
  }

  private async owned(id: string) {
    const r = this.journal.get(id);
    const owner = (await getAccount(PLAYER_NAME)).account.component_address;
    if (!r || r.owner !== owner) throw new Error('Incubation not found for this account');
    return r;
  }

  async preview(id: string): Promise<Opening> {
    const r = await this.owned(id);
    if (!r.deliveryTx) throw new Error('Your secret is still being delivered');
    const result = await (await wallet()).stealthUtxosList({ resource_address: TARI_RESOURCE as ResourceAddress, account_address: r.owner as `component_${string}`, filter_by_status: null });
    for (const utxo of result.utxos) {
      if (!utxo.is_on_chain || !utxo.memo || !('Message' in utxo.memo)) continue;
      const opening = decodeMemo(utxo.memo.Message);
      if (opening?.id === id && commitmentFor(opening) === r.commitment) return opening;
    }
    // Never fall back to the operator's stored plaintext. The memo must reach the wallet.
    throw new Error('The wallet is still scanning for your encrypted secret. Try opening it again shortly.');
  }

  async hatch(id: string) {
    if (this.busy.has(id)) throw new Error('This incubation is still processing');
    const r = structuredClone(await this.owned(id));
    if (r.stage === 'hatched') return publicRecord(r);
    if (r.hatchTx) { this.launch(id); return publicRecord(r); }
    const o = await this.preview(id);
    this.busy.add(id);
    try {
      r.stage = 'hatching'; delete r.error; this.journal.save(r);
      const sent = await submit(PLAYER_NAME, callInstructions(deployment().component, 'hatch', [stringLiteral(id), intLiteral(BigInt(o.variant)), stringLiteral(o.salt)]));
      r.hatchTx = sent.transaction_id; this.journal.save(r);
      await waitAccepted(sent.transaction_id);
      r.stage = 'hatched'; this.journal.save(r);
      await (await wallet()).accountsGetBalances({ account: { Name: PLAYER_NAME }, refresh: true });
      return publicRecord(r);
    } catch (e) { r.error = message(e); this.journal.save(r); throw e; }
    finally { this.busy.delete(id); }
  }
}
function message(error: unknown) { return error instanceof Error ? error.message.slice(0, 500) : 'Operation failed'; }
